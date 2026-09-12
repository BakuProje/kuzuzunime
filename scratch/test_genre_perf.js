const axios = require('axios');

async function getKitsuByGenre(genre) {
  try {
    const res = await axios.get(`https://kitsu.io/api/edge/anime?filter[categories]=${encodeURIComponent(genre)}&sort=-userCount&page[limit]=20`, {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 4000
    });
    const items = res.data?.data || [];
    return items.map(item => {
      const attr = item.attributes || {};
      const title = attr.canonicalTitle || attr.titles?.en_jp || attr.titles?.en || 'Anime';
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return {
        title,
        altTitle: attr.titles?.en && attr.titles.en !== title ? attr.titles.en : (attr.titles?.ja_jp || null),
        url: `/anime/${slug}-sub-indo/`,
        image: attr.posterImage?.large || attr.posterImage?.medium || attr.posterImage?.original || '/placeholder.jpg',
        banner: attr.coverImage?.large || attr.coverImage?.original || attr.posterImage?.large || '/placeholder.jpg',
        score: attr.averageRating ? (parseFloat(attr.averageRating) / 10).toFixed(1) : '8.5',
        episode: attr.episodeCount ? `${attr.episodeCount}` : (attr.status === 'finished' ? 'Tamat' : 'Ongoing'),
        status: attr.status === 'finished' ? 'Completed' : 'Ongoing',
        type: attr.showType?.toUpperCase() || 'TV',
        genres: [genre],
        synopsis: attr.synopsis || `Nonton streaming anime ${title} sub indo gratis hanya di ZUNIME.`
      };
    });
  } catch (err) {
    console.warn(`[Kitsu Genre Error] ${genre}:`, err.message);
    return [];
  }
}

async function test() {
  console.log('--- Testing Sample Genres ---');
  const sample = ['Action', 'Romance', 'Fantasy', 'Isekai', 'Comedy', 'Adventure', 'Mystery', 'Sports'];
  for (const g of sample) {
    const start = Date.now();
    const list = await getKitsuByGenre(g);
    console.log(`Genre [${g}]: returned ${list.length} anime in ${Date.now() - start}ms`);
  }
}

test();
