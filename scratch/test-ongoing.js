import axios from 'axios';

async function testOngoing() {
  const url = 'https://kitsu.io/api/edge/anime?filter[status]=current&sort=-userCount&page[limit]=20';
  const res = await axios.get(url, { headers: { 'Accept': 'application/vnd.api+json' } });
  const items = res.data?.data || [];
  console.log('SUCCESS! Total ongoing anime from Kitsu:', items.length);
  items.slice(0, 5).forEach((item, i) => {
    console.log(`[${i+1}] ${item.attributes?.canonicalTitle} | Poster: ${item.attributes?.posterImage?.large} | Status: ${item.attributes?.status}`);
  });
}
testOngoing();
