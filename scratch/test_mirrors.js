const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function testMirrors() {
  const mirrors = [
    'https://samehadaku.pro/',
    'https://samehadaku.email/',
    'https://samehadaku.care/',
    'https://samehadaku.mba/',
    'https://samehadaku.win/',
    'https://samehadaku.in/'
  ];

  for (const m of mirrors) {
    try {
      const res = await axios.get(m, { headers, timeout: 5000 });
      const $ = cheerio.load(res.data);
      const nontonCount = $('a[href*="/nonton/"]').length;
      const animeCount = $('a[href*="/anime/"]').length;
      console.log(`[${m}] Status: ${res.status}, nonton links: ${nontonCount}, anime links: ${animeCount}, title: ${$('title').text().slice(0, 40)}`);
      if (nontonCount > 0) {
        const firstNonton = $('a[href*="/nonton/"]').first().attr('href');
        console.log(` Sample nonton: ${firstNonton}`);
      }
    } catch (e) {
      console.log(`[${m}] Failed: ${e.message}`);
    }
  }
}

testMirrors();
