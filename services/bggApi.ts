import { XMLParser } from 'fast-xml-parser';
import { Game } from '@/types/game';

export async function fetchGames(username: string): Promise<Game[]> {
  
  let apiHost = '';
  if (typeof window === 'undefined'
    || !window.location.hostname.endsWith('.netlify.app')
  ) {
    apiHost = 'https://klack-dev.netlify.app';
  }
  let response;

  while (1) {  
    // Request to trigger collection fetch
    response = await fetch(`${apiHost}/.netlify/functions/bgg-api/collection?username=${encodeURIComponent(username)}&subtype=boardgame&own=1&stats=1`);
    const status = response.status;

    if ([
        202, // "BGG has queued your request and you need to keep retrying (hopefully w/some delay between tries) until the status is not 202."
        429, // Too many requests
      ].includes(status) ||
      (status >= 500 && status < 600) // Server error
    ) {
      console.log(`Received ${status} status, retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (!response.ok) {
      throw new Error(`Failed to fetch collection: ${status} - ${response.statusText}`);
    } else {
      break;
    }
  }

  let xmlText = await response.text();

  // Parse the XML response
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: 'value',
  });

  const result = parser.parse(xmlText);

  // Check if the collection exists and has items
  if (!result.items) {
    return [];
  }

  // Handle empty collection
  if (!result.items.item) {
    return [];
  }

  // Ensure we have an array even if there's only one item
  const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item];

  // Map the raw data to our Game type
  return items.map((item: any) => {
    // Find the name - it could be in different formats depending on the XML structure
    let name = '';
    if (item.name) {
      if (typeof item.name === 'string') {
        name = item.name;
      } else if (Array.isArray(item.name)) {
        const primaryName = item.name.find((n: any) => n.type === 'primary') || item.name[0];
        name = primaryName.value || primaryName;
      } else if (item.name.value) {
        name = item.name.value;
      }
    }

    // Extract stats from the XML
    const stats = item.stats || {};

    const game = {
      id: parseInt(item.objectid),
      name: name,
      yearPublished: parseInt(item.yearpublished) || null,
      thumbnail: item.thumbnail,
      image: item.image,
      min_players: parseInt(stats.minplayers) || null,
      max_players: parseInt(stats.maxplayers) || null,
      playing_time: parseInt(stats.playingtime) || null,
      minPlaytime: parseInt(stats.minplaytime) || null,
      maxPlaytime: parseInt(stats.maxplaytime) || null,
      description: '',
    };
    
    return game;
  });
}
