import { createClient } from '@supabase/supabase-js';
import { DOMParser } from '@xmldom/xmldom';
import { XMLParser } from 'fast-xml-parser';
import yauzl from 'yauzl'; // "yet another unzip library" for node
import { parse } from 'csv-parse';
import { asyncBatch, asyncToArray, asyncMap } from 'iter-tools';
import { format } from 'date-fns';

// Environment variables
const {
  BGG_USERNAME,
  BGG_PASSWORD,
  BGG_API_AUTH_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, // Optional, probably shouldn't be used anyway since it ignores all RLS.
  SUPABASE_ANON_KEY, // Used for normal login if SUPABASE_SERVICE_ROLE_KEY env var doesn't exist
  SUPABASE_EMAIL,
  SUPABASE_PASSWORD,
} = process.env;

const BGG_LOGIN_URL = 'https://boardgamegeek.com/login/api/v1';
const BGG_CSV_URL = 'https://boardgamegeek.com/data_dumps/bg_ranks';
const BGG_API_URL = 'https://boardgamegeek.com/xmlapi2/thing?stats=1&id=';
const SLEEP_TIME = 5; // seconds to wait before retrying BGG API & other fetch requests
const DASH = '–'; // NOT the hyphen character on the keyboard
const TAXONOMY_DELIMITER = '|';
const BGG_API_BATCH_SIZE = 20; // 20 is the maximum number of games allowed by https://boardgamegeek.com/xmlapi2/thing
const SUPABASE_BATCH_SIZE = 1000; // number of rows per INSERT/UPSERT requests
  // (expansions will usually be slightly higher since we batch by base game)
const STAGING_TO_PROD_RETRIES = 10; // Number of retries for (games_staging -> games)
  // and (expansions_staging -> expansions) (Games is somewhat likely to timeout, which may need to be adjusted.)

const timestamp = () => 
  format(new Date(), 'Pppp');

const log = text =>
  console.log(`${timestamp()}: ${text}`)

const cError = text =>
  console.error(`${timestamp()}: ${text}`)

const arrayify = (x) => {
  if (!Array.isArray(x)) {x = [x];}
  return x;
};

const getZipUrl = async () => {
  
  // Need to be logged in to BGG to get the oh-so-secret zipfile link
  log(`Logging ${BGG_USERNAME} in to BGG...`);
  const loginResponse = await fetch(
    BGG_LOGIN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credentials: {
        username: BGG_USERNAME,
        password: BGG_PASSWORD,
      }}),
    }
  );
  if (loginResponse.ok) {
    log('Successfully logged in.');
  } else {
    throw new Error(`Failed to log in: ${loginResponse.status} - ${loginResponse.statusText}`);
  }
  const cookie = loginResponse.headers.getSetCookie();

  log(`Fetching BGG zip URL from ${BGG_CSV_URL}...`);
  let csvResponse;
  while (1) {
    try {
      csvResponse = await fetch(
        BGG_CSV_URL, {
          method: 'GET',
          headers: { cookie: cookie.join(';') },
        }
      );
    } catch (error) {
      cError(`Network error: ${error}`);
      continue;
    }
    if (csvResponse.ok) {
      break;
    } else {
      cError(`Failed to fetch URL: ${csvResponse.status} - ${csvResponse.statusText}`);
      continue;
    }
  }
  const html = await csvResponse.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const hyperlink = doc
    .getElementById('maincontent')
    .getElementsByTagName('a')[0];
  
  const url = hyperlink.getAttribute('href');
  const filename = hyperlink.getAttribute('download');
  
  return [url, filename];
}

const hasTaxonomy = (game, type, value) => {
  let links = arrayify(game.link);
  return links.some(link =>
    link?.type === type && link?.value === value
  );
};

const parseSuggestedPlayers = (text) => text
  .replaceAll(DASH, '-')
  .split('')
  .filter(c => '0123456789,+-'.includes(c))
  .join('')

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

const parseXml = function* (text) {
  
  let games = arrayify(xmlParser.parse(text).items.item);
  for (const game of games) {
    try {
      const row = { id: game.id };
      
      let names = arrayify(game.name);
      for (const { type, value } of names) {
        if (type === 'primary') {
          row.name = value;
        }
      }
      
      for (const poll of arrayify(game.poll)) {
        if (poll?.name === 'suggested_playerage') {
          // Avoid division by zero
          if (poll.totalvotes === '0') {
            row.suggested_playerage = null;
          } else {
            let ageSum = 0;
            let voteSum = 0;
            for (const { value, numvotes } of poll.results.result) {
              const age = parseInt(value);
              const voteCount = parseInt(numvotes);
              ageSum += age * voteCount;
              voteSum += voteCount;
            }
            row.suggested_playerage = ageSum / voteSum; // weighted average
          }
        }
      }
      
      let summaries = arrayify(game['poll-summary']);
      for (const summary of summaries) {
        if (summary?.name === 'suggested_numplayers') {
          for (const { name, value } of summary.result) {
            if (name === 'bestwith') {
              row.best_players = parseSuggestedPlayers(value);
            } else if (name === 'recommmendedwith') {
              row.rec_players = parseSuggestedPlayers(value);
            }
          }
        }
      }
      row.is_expansion = game.type === 'boardgameexpansion';
      const expansions = [];
      let links = arrayify(game.link);
      // Don't get expansions of expansions, just of base games
      if (!row.is_expansion) {
        for (const link of links) {
          if (link?.type === 'boardgameexpansion') {
            expansions.push({
              base_id: row.id,
              expansion_id: link.id,
            });
          }
        }
      }
      const ratings = game.statistics?.ratings;
      let ranks = ratings?.ranks?.rank;
      if (ranks) {
        for (const { type, name, value } of arrayify(ranks)) {
          if (type === 'subtype' && name === 'boardgame') {
            row.rank = parseInt(value) || null;
          }
        }
      }
      // NULL out 0 for filtering purposes (0 means no value)
      row.average = parseFloat(ratings?.average.value) || null;
      row.bayesaverage = parseFloat(ratings?.bayesaverage.value) || null;
      row.complexity = parseFloat(ratings?.averageweight.value) || null;
      row.year_published = parseInt(game.yearpublished?.value) || null;
      row.minplaytime = parseInt(game.minplaytime?.value) || null;
      row.maxplaytime = parseInt(game.maxplaytime?.value) || null;
      row.playing_time = parseInt(game.playingtime?.value) || null;
      row.min_players = parseInt(game.minplayers?.value) || null;
      row.max_players = parseInt(game.maxplayers?.value) || null;
      row.min_age = parseInt(game.minage?.value) || null;
      row.image_url = game.image;
      row.thumbnail = game.thumbnail;
      row.audio_url = null; // We will probably never use this column
      row.description = null; // Leaving blank until we have more database storage
      row.is_cooperative = hasTaxonomy(game, 'boardgamemechanic', 'Cooperative Game');
      row.is_teambased = hasTaxonomy(game, 'boardgamemechanic', 'Team-Based Game');
      // BGG taxonomy
      for (const type of ['boardgamecategory', 'boardgamemechanic', 'boardgamefamily']) {
        row[type] = links
          .filter(link => link?.type === type)
          .map(link => link?.value)
          .join(TAXONOMY_DELIMITER);
      }
      yield {
        game: row,
        expansions: expansions,
      };
    } catch (error) {
      cError(error);
      log('Game:')
      log(game);
      log('Full XML response:');
      log(text);
    }
  }
};

const createSupabaseClient = async () => {
  /* Use the service_role key (which bypasses RLS)
  if we're running this as a Supabase edge function.
  Otherwise, login as a normal user */
  const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const supabase = createClient(
    SUPABASE_URL,
    supabaseKey,
    { auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    }}
  );
  if (SUPABASE_SERVICE_ROLE_KEY) {
    log('Created Supabase client using SUPABASE_SERVICE_ROLE_KEY.');
  } else {
    log('Created Supabase client using SUPABASE_ANON_KEY.');
    log(`Logging ${SUPABASE_EMAIL} in to Supabase...`);
    const { error } = await supabase.auth.signInWithPassword({
      email: SUPABASE_EMAIL,
      password: SUPABASE_PASSWORD,
    });
    if (error) {
      throw new Error(`Failed to log in: ${error.message}`);
    } else {
      log('Successfully logged in.')
    };
  }
  return supabase;
};

const bggApiCaller = async function* (csvParser) {
  // Make API calls in batches of 20 (or whatever the max that BGG allows is) games at a time
  for await (const bggBatch of asyncBatch(BGG_API_BATCH_SIZE, csvParser)) {
    
    const ids = await asyncToArray(asyncMap((game => game.id), bggBatch));
    let bggResponse;
    while (1) {
      try {
        bggResponse = await fetch(
          `${BGG_API_URL}${ids.join(',')}`,
          { headers: { 'Authorization': `Bearer ${BGG_API_AUTH_TOKEN}` }},
        );
      } catch (error) {
        cError(`Network error: ${error} - Waiting ${SLEEP_TIME} seconds before resubmitting request...`);
        await new Promise(resolve => setTimeout(resolve, SLEEP_TIME * 1000));
        continue;
      }
      const status = `${bggResponse.status} - ${bggResponse.statusText}`;
      if (bggResponse.ok) {
        break;
      } else if (
        bggResponse.status === 429 // Too many requests
        || (bggResponse.status >= 500 && bggResponse.status < 600) // Server error
      ) {
        if (bggResponse.status !== 429) { // 429 happens so frequently that it's not worth logging.
          cError(`${status}: Waiting ${SLEEP_TIME} seconds before resubmitting request...`);
        }
        await new Promise(resolve => setTimeout(resolve, SLEEP_TIME * 1000));
      } else {
        throw new Error(status);
      }
    }
    
    const xmlText = await bggResponse.text()
    for (const row of parseXml(xmlText)) {
      yield row;
    }
  }
};

const updateFromStaging = async (supabase) => {
  if (!supabase) {
    supabase = await createSupabaseClient();
  }
  log('Updating games from games_staging...');
  let attempts = 0;
  while (1) {
    try {
      const gamesResponse = await supabase.rpc('update_games_from_games_staging');
      if (gamesResponse.error) {
        throw new Error(`Failed to update games: ${gamesResponse.error.message}`);
      } else {
        log('Updated games successfully!');
        break;
      }
    } catch (err) {
      attempts++;
      if (attempts > STAGING_TO_PROD_RETRIES) {
        throw err;
      } else {
        cError(`${err} - Attempt ${attempts} of ${STAGING_TO_PROD_RETRIES}`);
      }
    }
  }
  log('Updating expansions from expansions_staging...');
  attempts = 0;
  while (1) {
    try {
      const expResponse = await supabase.rpc('update_expansions_from_expansions_staging');
      if (expResponse.error) {
        throw new Error(`Failed to update expansions: ${expResponse.error.message}`);
      } else {
        log('Updated expansions successfully!');
        break;
      }
    } catch (err) {
      attempts++;
      if (attempts > STAGING_TO_PROD_RETRIES) {
        throw err;
      } else {
        cError(`${err} - Attempt ${attempts} of ${STAGING_TO_PROD_RETRIES}`);
      }
    }
  }
}

const main = async () => {

  const supabase = await createSupabaseClient();

  log('Truncating games_staging...');
  const delGamesResponse = await supabase.rpc('truncate_games_staging')
  if (delGamesResponse.error) {
    throw new Error(delGamesResponse.error.message);
  } else {
    log('Successfully truncated games_staging.');
  };

  log('Truncating expansions_staging...');
  const delExpResponse = await supabase.rpc('truncate_expansions_staging')
  if (delExpResponse.error) {
    throw new Error(delExpResponse.error.message);
  } else {
    log('Successfully truncated expansions_staging.');
  };

  const [zipUrl, zipFilename] = await getZipUrl();

  log(`Downloading ${zipFilename}...`);
  const zipResponse = await fetch(zipUrl);
  if (!zipResponse.ok) {
    throw new Error(`Failed to download ${zipFilename}: ${zipResponse.status} - ${zipResponse.statusText}`);
  }
  const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());

  const csvParser = parse({ columns: true });

  // Unzip boardgames_ranks_YYYY-MM-DD.zip and pipe to csvParser
  yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
    log(`Extracting ${zipFilename}...`);
    if (err) throw err;
    zipfile.readEntry();
    zipfile.on('entry', entry => {
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) throw err;
        readStream.pipe(csvParser);
      });
    });
  });

  let gameCount = 0;
  let expansionCount = 0;
  let games = [];
  let expansions = [];
  for await (const row of bggApiCaller(csvParser)) {
    if (gameCount === 0) {
      log('Processing boardgames_ranks.csv...');
    }  
    games.push(row.game);
    gameCount++;
    expansions = expansions.concat(row.expansions);
    expansionCount += row.expansions.length;
    if (games.length >= SUPABASE_BATCH_SIZE) {
      while (1) {
        try {
          const gamesResponse = await supabase
            .from('games_staging')
            .insert(games);
          if (gamesResponse.error) {
            throw new Error(`Failed to insert games: ${gamesResponse.error.message}`)
          } else {
            log(`Inserted ${gameCount} games so far...`);
            games = [];
            break;
          }
        } catch (err) {
          cError(`${err} - Waiting ${SLEEP_TIME} seconds to insert games...`);
          await new Promise(resolve => setTimeout(resolve, SLEEP_TIME * 1000));
        }
      }
    }
    if (expansions.length >= SUPABASE_BATCH_SIZE) {
      while (1) {
        try {
          const expResponse = await supabase
            .from('expansions_staging')
            .insert(expansions);
          if (expResponse.error) {
            throw new Error(`Failed to insert expansions: ${expResponse.error.message}`)
          } else {
            log(`Inserted ${expansionCount} expansions so far...`);
            expansions = [];
            break;
          }
        } catch (err) {
          cError(`${err} - Waiting ${SLEEP_TIME} seconds to insert expansions...`);
          await new Promise(resolve => setTimeout(resolve, SLEEP_TIME * 1000));
        }
      }
    }
  }
  // Insert the leftovers
  if (games.length) {
    while (1) {
      try {
        const gamesResponse = await supabase
          .from('games_staging')
          .insert(games);
        if (gamesResponse.error) {
          throw new Error(`Failed to insert games: ${gamesResponse.error.message}`)
        } else {
          log(`Inserted ${gameCount} games so far...\nSuccessfully inserted all games!`);
          break;
        }
      } catch (err) {
        cError(`${err} - Waiting ${SLEEP_TIME} seconds to insert games...`);
        await new Promise(resolve => setTimeout(resolve, SLEEP_TIME * 1000));
      }
    }
  } else {
    log('Successfully inserted all games!');
  }
  if (expansions.length) {
    while (1) {
      try {
        const expResponse = await supabase
          .from('expansions_staging')
          .insert(expansions);
        if (expResponse.error) {
          throw new Error(`Failed to insert expansions: ${expResponse.error.message}`)
        } else {
          log(`Inserted ${expansionCount} expansions so far...\nSuccessfully inserted all expansions!`);
          break;
        }
      } catch (err) {
        cError(`${err} - Waiting ${SLEEP_TIME} seconds to insert games...`);
        await new Promise(resolve => setTimeout(resolve, SLEEP_TIME * 1000));
      }
    }
  } else {
    log('Successfully inserted all expansions!');
  }
  await updateFromStaging(supabase);  
};

await main();