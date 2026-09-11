import axios from 'axios';

async function testJikan() {
  console.log('--- Testing Jikan Seasonal/Latest Anime ---');
  try {
    const res = await axios.get('https://api.jikan.moe/v4/seasons/now?limit=25', { timeout: 4000 });
    const list = res.data?.data || [];
    console.log(`Jikan seasons/now returned: ${list.length} anime`);
    if (list.length > 0) {
      console.log('Sample 1:', {
        title: list[0].title,
        title_english: list[0].title_english,
        image: list[0].images?.webp?.large_image_url || list[0].images?.jpg?.large_image_url,
        score: list[0].score,
        episodes: list[0].episodes,
        status: list[0].status
      });
    }
  } catch (e) {
    console.log('Jikan failed:', e.message);
  }

  console.log('\n--- Testing Kitsu Trending Anime ---');
  try {
    const res = await axios.get('https://kitsu.io/api/edge/trending/anime?limit=20', {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 4000
    });
    const list = res.data?.data || [];
    console.log(`Kitsu trending returned: ${list.length} anime`);
    if (list.length > 0) {
      console.log('Sample 1:', {
        canonicalTitle: list[0].attributes?.canonicalTitle,
        posterImage: list[0].attributes?.posterImage?.large,
        averageRating: list[0].attributes?.averageRating,
        episodeCount: list[0].attributes?.episodeCount
      });
    }
  } catch (e) {
    console.log('Kitsu failed:', e.message);
  }

  console.log('\n--- Testing Kitsu Latest Anime ---');
  try {
    const res = await axios.get('https://kitsu.io/api/edge/anime?sort=-createdAt&page[limit]=20', {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 4000
    });
    const list = res.data?.data || [];
    console.log(`Kitsu latest returned: ${list.length} anime`);
  } catch (e) {
    console.log('Kitsu latest failed:', e.message);
  }
}

testJikan();
