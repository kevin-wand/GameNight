import os
import re
# import shutil
import json
import glob
# import git
import pprint
import requests
from bs4 import BeautifulSoup

URL_PREFIX = 'https://github.com'
EMPTY_DIR = './empty'
JSON_FILENAME = '../licenses.json'
OUTPUT_FILENAME = '../licenses.md'

def make_link(text, prefix=URL_PREFIX):
  if text.startswith(('http://', 'https://')):
    return text
  elif text.startswith('/'):
    return f'{prefix}{text}'
  else:
    return f'{prefix}/{text}'

def get_license_from_github_url(url):
  # TODO: Get the license from the correct version (some package versions are ancient)
  lics = []
  response = requests.get(make_link(url))
  soup = BeautifulSoup(response.text, 'lxml')
  for td in soup.find_all('td', class_='react-directory-row-name-cell-large-screen'):
    anchor = td.find('a', attrs={
      'title': re.compile(r'LICENSE', re.IGNORECASE),
      'aria-label': re.compile(r'\(File\)'), # exclude directories
    })
    if anchor:
      link = make_link(anchor['href'])
      response = requests.get(link)
      license_soup = BeautifulSoup(response.text, 'lxml')
      license_json = license_soup.find('script', attrs={'data-target': 'react-app.embeddedData'}).string
      blob = json.loads(license_json)['payload']['blob']
      # pprint.pp(blob)
      lics.append({
        'content': '\n'.join(blob['rawLines']) if blob['rawLines'] else blob['richText'],
        'file': blob['displayName'],
      })
  return {
    'content': '\n\n'.join(lic['content'] for lic in lics),
    'file': ', '.join(lic['file'] for lic in lics),
  }

def make_license_md(package):
  return (
f'''## {package['name']}

Version: {package['version']}
{f'\nURL: {package.get('url')}' if package.get('url') else ''}
{f'\nAuthor: {package.get('author')}' if package.get('author') else ''}
{f'\n\n{package.get('content')}\n\n' if package.get('content') else ''}
Description: {package.get('description')}
{f'\nFile: {package.get('file')}\n' if package.get('file') else ''}
Type: {package.get('type') or 'N/A'}


---

''')

def main2():
   pprint.pp(get_license_from_github_url('https://github.com/facebook/react-native'))

def main():
  failures = []
  output_file = open(OUTPUT_FILENAME, 'w', encoding='utf-8')
  # license_count = 0
  # no_license_count = 0
  packages = json.load(open(JSON_FILENAME, encoding='utf-8'))
  for key, package in sorted(packages.items()):
    print(package['name'])
    # if package.get('content'):
    #   yield package
    if not package.get('content'):
      # package['content'] = ''
      # package['file'] = []
      package_dir = f'../node_modules/{package['name']}'
      matches = glob.glob(f'{package_dir}/*LICENSE*')
      if matches:
        package['content'] = '\n\n'.join(open(match).read() for match in matches)
        package['file'] = ', '.join(os.path.basename(match) for match in matches)
      else:
        if package.get('url'):
          package.update(get_license_from_github_url(package['url']))
        else:
          failures.append(key)
          print('*** NO URL ***')
    output_file.write(make_license_md(package))
  if failures:
    print('FAILURES:')
    for failure in failures:
      print(failure)
        # if os.path.exists(EMPTY_DIR):
        #   shutil.rmtree(EMPTY_DIR)
        # empty_repo = git.Repo.init(EMPTY_DIR)
        # origin = empty_repo.create_remote('origin', package['url'])
        # origin.fetch()
        # if origin and origin.refs:
        #   print(package['url'], 'success')
        #   for blob in origin.refs.HEAD.commit.tree.blobs:
        #     pass
        # else:
        #   print(package['url'])
        #   pprint.pp(origin.refs)
          # if 'license' in 
    # else:
    #   no_license_count += 1
    #   print(key)
  # print(license_count)
  # print(no_license_count)

if __name__ == '__main__':
  main()