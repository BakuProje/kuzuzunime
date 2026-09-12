const axios = require('axios');
const cheerio = require('cheerio');

async function testAnimeDetail() {
  const url = 'https://ww2.samehadaku.pro/anime/kimetsu-no-yaiba-4qyek9j/';
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    timeout: 6000
  });
  const $ = cheerio.load(res.data);
  console.log('Title:', $('title').text());
  console.log('Episodes list:');
  $('.lstepsiode ul li, .sh-daftar-grid a, .sh-pan a, a[href*="/nonton/"]').slice(0, 10).each((i, el) => {
    console.log(`Ep ${i}: text="${$(el).text().trim()}", href="${$(el).attr('href')}"`);
  });
}

testAnimeDetail();
