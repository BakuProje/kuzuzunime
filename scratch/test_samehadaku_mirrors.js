const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

async function testAllSamehadakuMirrors() {
  const domains = [
    'https://v2.samehadaku.how',
    'https://samehadaku.how',
    'https://ww2.samehadaku.pro',
    'https://samehadaku.care',
    'https://samehadaku.email',
    'https://samehadaku.run',
    'https://samehadaku.top'
  ];

  for (const d of domains) {
    try {
      const res = await axios.get(d, {
        headers,
        httpsAgent: agent,
        timeout: 5000,
        maxRedirects: 5
      });
      const $ = cheerio.load(res.data);
      console.log(`[SUCCESS] ${d}`);
      console.log(`  Title: ${$('title').text().trim()}`);
      console.log(`  Cards: ${$('a[href*="/nonton/"], a[href*="/anime/"]').length}`);
      console.log(`  Sample: ${$('a[href*="/nonton/"]').first().text().trim() || $('a[href*="/anime/"]').first().text().trim()}`);
    } catch (err) {
      console.log(`[FAILED] ${d} -> ${err.message} (${err.response?.status || 'No Status'})`);
    }
  }
}

testAllSamehadakuMirrors().catch(console.error);
