import os
import csv
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import itertools
import time
import string
from supabase import create_client
import pprint
import requests
import json
from bs4 import BeautifulSoup
import io
from zipfile import ZipFile
# from optparse import OptionParser

LOGIN_URL = 'https://boardgamegeek.com/login/api/v1'
BGG_CSV_URL = 'https://boardgamegeek.com/data_dumps/bg_ranks'
BGG_CSV_FILENAME = 'boardgames_ranks.csv'
OUTPUT_PATH = 'output.csv'
EXPANSION_OUTPUT_PATH = 'expansion_output.csv'
SLEEP_TIME = 5 # seconds to wait after receiving a urllib.request error
DASH = '–' # NOT the hyphen character on the keyboard
DESCRIPTION_NCHARS = 0 # number of description characters to store in the output, since we currently have a database size limit
INCLUDE_BGG_TAXONOMY = True
TAXONOMY_DELIMITER = '|'
USERNAME = os.environ.get('BGG_USERNAME')
PASSWORD = os.environ.get('BGG_PASSWORD')

def get_private_collection():
  session = requests.Session()
  session.post(
    LOGIN_URL,
    data = json.dumps({'credentials': {'username': USERNAME, 'password': PASSWORD}}),
    headers = {'content-type': 'application/json'},
  )
  response = session.get(
    f'https://boardgamegeek.com/xmlapi2/collection?username={USERNAME}&subtype=boardgame&own=1&stats=1&showprivate=1'
  )
  soup = BeautifulSoup(response.text, 'xml')
  print(soup.prettify())
  
def get_zip_url():
  session = requests.Session()
  session.post(
    LOGIN_URL,
    data = json.dumps({'credentials': {'username': USERNAME, 'password': PASSWORD}}),
    headers = {'content-type': 'application/json'},
  )
  response = session.get(BGG_CSV_URL)
  soup = BeautifulSoup(response.text, 'lxml')
  return soup.find(id='maincontent').a['href']

def write_bgg_csv(zip_url):
  response = requests.get(zip_url)
  bgg_zipfile = ZipFile(io.BytesIO(response.content))
  bgg_zipfile.extract(BGG_CSV_FILENAME)

def has_taxonomy(game, type, value):
  return any(
    link.attrib['type'] == type
    and link.attrib['value'] == value
    for link in game.findall('link')
  )

def parse_xml(text):
  root = ET.fromstring(text)
  for game in root:
    for poll in game.findall('poll'):
      if poll.attrib['name'] == 'suggested_playerage':
        # Avoid division by zero
        if poll.attrib['totalvotes'] == '0':
          suggested_playerage = ''
        else:
          agesum = 0
          votesum = 0
          for result in poll.find('results').findall('result'):
            age = int(''.join(char for char in result.attrib['value'] if char in string.digits)) # parse "21" from "21 and up"
            numvotes = int(result.attrib['numvotes'])
            agesum += age * numvotes
            votesum += numvotes
          suggested_playerage = agesum / votesum # weighted average
    for summary in game.findall('poll-summary'):
      if summary.attrib['name'] == 'suggested_numplayers':
        for result in summary.findall('result'):
          if result.attrib['name'] == 'bestwith':
            best_players = ''.join(char for char in result.attrib['value'] if char in (string.digits + DASH + ',+')).replace(DASH, '-')
          elif result.attrib['name'] == 'recommmendedwith':
            rec_players = ''.join(char for char in result.attrib['value'] if char in (string.digits + DASH + ',+')).replace(DASH, '-')
    
    expansions = []
    if game.attrib['type'] == 'boardgame': # Don't get expansions of expansions, just of base games
      for link in game.findall('link'):
        if link.attrib['type'] == 'boardgameexpansion':
          expansions.append({
            'id': link.attrib['id'],
            'name': link.attrib['value']
          })
            
    row = dict(
      id = game.attrib['id'],
      # NULL out 0 for filtering purposes (0 means no value)
      minplaytime = int(game.find('minplaytime').attrib['value']) or '',
      maxplaytime = int(game.find('maxplaytime').attrib['value']) or '',
      playing_time = int(game.find('playingtime').attrib['value']) or '',
      min_players = int(game.find('minplayers').attrib['value']) or '',
      max_players = int(game.find('maxplayers').attrib['value']) or '',
      best_players = best_players,
      rec_players = rec_players,
      image_url = game.findtext('image', default=''),
      thumbnail = game.findtext('thumbnail', default=''),
      # NULL out complexity=0 for filtering purposes, and in case we ever decide to do some math (0 means no votes)
      complexity = float(game.find('statistics').find('ratings').find('averageweight').attrib['value']) or '',
      description = game.findtext('description', default='')[:DESCRIPTION_NCHARS],
      is_cooperative = has_taxonomy(game, 'boardgamemechanic', 'Cooperative Game'),
      is_teambased = has_taxonomy(game, 'boardgamemechanic', 'Team-Based Game'),
      # is_legacy = has_taxonomy(game, 'boardgamemechanic', 'Legacy Game'),
      # is_childrens = has_taxonomy(game, 'boardgamecategory', "Children's Game"),
      min_age = int(game.find('minage').attrib['value']) or '',
      suggested_playerage = suggested_playerage,
      expansions = expansions,
    )
    
    if INCLUDE_BGG_TAXONOMY:
      links = game.findall('link')
      for type in ['boardgamecategory', 'boardgamemechanic', 'boardgamefamily']:
        row[type] = TAXONOMY_DELIMITER.join(
          link.attrib['value']
          for link in links
          if link.attrib['type'] == type
        )
    
    yield row

def urllib_error_handler(err):
  print(err)
  print(f'Waiting {SLEEP_TIME} seconds before resubmitting request...')
  time.sleep(SLEEP_TIME)

def get_game_cols():
  supabase = create_client(
    os.environ.get('SUPABASE_URL'),
    os.environ.get('SUPABASE_KEY')
  )

  response = (
    supabase.table('games')
      .select('*')
      .limit(1)
      .execute()
  )

  data = response.data[0]
  del data['created_at'] # To avoid problems when importing to supabase
  return data.keys()

def main():
  
  # parser = OptionParser()
  # parser.add_option()
  
  write_bgg_csv(get_zip_url())
  
  game_cols = get_game_cols()

  reader = csv.DictReader(
    open(BGG_CSV_FILENAME, 'r', encoding='utf-8')
  )
  writer = csv.DictWriter(
    open(OUTPUT_PATH, 'w', encoding='utf-8', newline=''),
    fieldnames=game_cols,
    extrasaction='ignore',
  )
  writer.writeheader()
  
  expansion_writer = csv.DictWriter(
    open(EXPANSION_OUTPUT_PATH, 'w', encoding='utf-8', newline=''),
    fieldnames=['base_id', 'expansion_id'],
  )
  expansion_writer.writeheader()
  
  # Make API calls in batches of 20 games at a time
  for batch in itertools.batched(reader, 20):
    games = {}
    for row in batch:
      games[row['id']] = row
      # We want 0 to show up as NULL in the database for sorting/filtering purposes
      for col in ['average', 'bayesaverage', 'rank', 'yearpublished']:
        if row[col] == '0':
          row[col] = ''
    
    ids = ','.join(games.keys())
    url = f'https://boardgamegeek.com/xmlapi2/thing?id={ids}&stats=1'
    
    while 1:
      try:
        response = urllib.request.urlopen(url)
      except urllib.error.HTTPError as err:
        if err.code in [
          429, # Too many requests
          502, # Bad gateway
        ]: 
          urllib_error_handler(err)
        else:
          raise
      except urllib.error.URLError as err:
        urllib_error_handler(err)
      else:
        break
    
    for g in parse_xml(response.read()):
      game = games[g['id']]
      game.update(g)
      game['year_published'] = game['yearpublished']
      pprint.pp(game)
      writer.writerow(game)
      
      for exp in game['expansions']:
        expansion_writer.writerow({
          'base_id': game['id'],
          'expansion_id': exp['id'],
        })
      
if __name__ == '__main__':
  main()
