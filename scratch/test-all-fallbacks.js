import axios from 'axios';

async function testAllFallbacks() {
  console.log('--- 1. Testing Latest Fallback (Jikan Seasons Now) ---');
  const jikanRes = await axios.get('https://api.jikan.moe/v4/seasons/now?limit=28', { timeout: 4000 });
  const latestList = (jikanRes.data?.data || []).map(item => ({
    title: item.title,
    url: `/anime/${(item.title_english || item.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`,
    image: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
    episode: item.episodes ? `Episode ${item.episodes}` : 'Ongoing',
    score: item.score ? item.score.toString() : '8.5',
    released: 'Terbaru',
    postedBy: 'Admin'
  }));
  console.log(`Latest Fallback returned: ${latestList.length} items`);
  console.log('Sample Latest:', latestList[0]);

  console.log('\n--- 2. Testing Popular Fallback (Kitsu Trending) ---');
  const kitsuRes = await axios.get('https://kitsu.io/api/edge/trending/anime?limit=20', {
    headers: { 'Accept': 'application/vnd.api+json' },
    timeout: 4000
  });
  const popList = (kitsuRes.data?.data || []).map(item => ({
    title: item.attributes?.canonicalTitle,
    url: `/anime/${item.attributes?.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`,
    image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium,
    score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
    episode: item.attributes?.episodeCount ? `${item.attributes.episodeCount} Eps` : 'Ongoing',
    status: item.attributes?.status === 'finished' ? 'Completed' : 'Ongoing',
    type: item.attributes?.showType || 'TV'
  }));
  console.log(`Popular Fallback returned: ${popList.length} items`);
  console.log('Sample Popular:', popList[0]);

  console.log('\n--- 3. Testing Search Fallback (Kitsu Search) ---');
  const searchRes = await axios.get('https://kitsu.io/api/edge/anime?filter[text]=' + encodeURIComponent('mecha') + '&page[limit]=15', {
    headers: { 'Accept': 'application/vnd.api+json' },
    timeout: 4000
  });
  const searchList = (searchRes.data?.data || []).map(item => ({
    title: item.attributes?.canonicalTitle,
    url: `/anime/${item.attributes?.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`,
    image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium,
    score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
    episode: item.attributes?.episodeCount ? `Ep ${item.attributes.episodeCount}` : 'Ongoing',
    status: item.attributes?.status === 'finished' ? 'Completed' : 'Ongoing',
    type: item.attributes?.showType || 'TV',
    synopsis: item.attributes?.synopsis
  }));
  console.log(`Search Fallback for "mecha" returned: ${searchList.length} items`);
  console.log('Sample Search:', searchList[0]);
}

testAllFallbacks();
