import axios from 'axios';

async function testKitsuOnly() {
  console.log('--- 1. Testing Kitsu Latest Anime ---');
  const t0 = Date.now();
  const latestRes = await axios.get('https://kitsu.io/api/edge/anime?sort=-createdAt&page[limit]=20', {
    headers: { 'Accept': 'application/vnd.api+json' },
    timeout: 5000
  });
  const latestList = (latestRes.data?.data || []).map(item => ({
    title: item.attributes?.canonicalTitle,
    url: `/anime/${item.attributes?.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`,
    image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
    episode: item.attributes?.episodeCount ? `Episode ${item.attributes.episodeCount}` : 'Ongoing',
    score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
    released: 'Baru Saja',
    postedBy: 'Admin'
  }));
  console.log(`[${Date.now() - t0}ms] Latest items: ${latestList.length}`);
  console.log('Sample Latest 1:', latestList[0]);

  console.log('\n--- 2. Testing Kitsu Trending/Popular Anime ---');
  const t1 = Date.now();
  const popRes = await axios.get('https://kitsu.io/api/edge/trending/anime?limit=20', {
    headers: { 'Accept': 'application/vnd.api+json' },
    timeout: 5000
  });
  const popList = (popRes.data?.data || []).map(item => ({
    title: item.attributes?.canonicalTitle,
    url: `/anime/${item.attributes?.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`,
    image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
    score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
    episode: item.attributes?.episodeCount ? `${item.attributes.episodeCount} Eps` : 'Ongoing',
    status: item.attributes?.status === 'finished' ? 'Completed' : 'Ongoing',
    type: item.attributes?.showType || 'TV'
  }));
  console.log(`[${Date.now() - t1}ms] Trending items: ${popList.length}`);
  console.log('Sample Trending 1:', popList[0]);

  console.log('\n--- 3. Testing Kitsu Search (Action) ---');
  const t2 = Date.now();
  const searchRes = await axios.get('https://kitsu.io/api/edge/anime?filter[text]=action&page[limit]=15', {
    headers: { 'Accept': 'application/vnd.api+json' },
    timeout: 5000
  });
  const searchList = (searchRes.data?.data || []).map(item => ({
    title: item.attributes?.canonicalTitle,
    url: `/anime/${item.attributes?.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`,
    image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
    score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
    episode: item.attributes?.episodeCount ? `Ep ${item.attributes.episodeCount}` : 'Ongoing',
    status: item.attributes?.status === 'finished' ? 'Completed' : 'Ongoing',
    type: item.attributes?.showType || 'TV'
  }));
  console.log(`[${Date.now() - t2}ms] Search action items: ${searchList.length}`);
  console.log('Sample Search 1:', searchList[0]);
}

testKitsuOnly();
