const axios = require('axios');

async function testKitsuGenre(genre) {
  try {
    const url = `https://kitsu.io/api/edge/anime?filter[categories]=${encodeURIComponent(genre)}&sort=-userCount&page[limit]=20`;
    const res = await axios.get(url, {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 5000
    });
    const items = res.data?.data || [];
    console.log(`[Genre: ${genre}] found ${items.length} items`);
    if (items.length > 0) {
      console.log('Sample:', items[0].attributes.canonicalTitle, items[0].attributes.posterImage?.small);
    }
  } catch (e) {
    console.error(`[Genre: ${genre}] error:`, e.message);
  }
}

async function run() {
  const testList = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gore', 'Harem', 
    'Historical', 'Isekai', 'Josei', 'Loli', 'Magic', 'Martial Arts', 'Mecha', 'Milf', 'Military', 
    'Music', 'Mystery', 'Psychological', 'Romance', 'School', 'Sci-Fi', 'Seinen', 'Shoujo', 
    'Shounen', 'Slice of Life', 'Sports', 'Super Power', 'Supernatural', 'Suspense', 'Thriller', 'Yuri'
  ];
  for (const g of testList) {
    await testKitsuGenre(g);
  }
}

run();
