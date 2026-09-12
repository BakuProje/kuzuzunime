const axios = require('axios');

async function testTitleResolution(query) {
  console.log(`\nTesting Kitsu & Jikan for: "${query}"`);
  
  // 1. Kitsu
  try {
    const kitsuRes = await axios.get(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=3`, {
      headers: { 'Accept': 'application/vnd.api+json' }
    });
    const items = kitsuRes.data?.data || [];
    console.log(`Kitsu found ${items.length} items:`);
    items.forEach((it, idx) => {
      console.log(`  [${idx}] Canonical:`, it.attributes?.canonicalTitle, 'Titles:', it.attributes?.titles, 'Synonyms:', it.attributes?.abbreviatedTitles);
    });
  } catch (e) {
    console.error('Kitsu error:', e.message);
  }

  // 2. Jikan (MyAnimeList)
  try {
    const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=3`);
    const jItems = jikanRes.data?.data || [];
    console.log(`Jikan found ${jItems.length} items:`);
    jItems.forEach((it, idx) => {
      console.log(`  [${idx}] Title:`, it.title, 'English:', it.title_english, 'Japanese:', it.title_japanese);
    });
  } catch (e) {
    console.error('Jikan error:', e.message);
  }
}

async function run() {
  await testTitleResolution('daemons of the shadow realm');
  await testTitleResolution('yomi no tsugai');
}

run().catch(console.error);
