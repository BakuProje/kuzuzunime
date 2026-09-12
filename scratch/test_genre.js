const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const genres = ['action', 'romance', 'isekai', 'fantasy', 'mecha', 'comedy'];
  for (const g of genres) {
    try {
      const url = 'https://samehadaku.email/genre/' + g + '/';
      const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
      const $ = cheerio.load(res.data);
      const count = $('.animpost, .animepost, article').length;
      console.log(g, 'Samehadaku count:', count, 'Status:', res.status);
    } catch (e) {
      console.log(g, 'Samehadaku err:', e.response?.status || e.message);
    }
  }
}
test();
