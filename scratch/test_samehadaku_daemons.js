const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
};

async function testQuery(q) {
  console.log(`\nSearching Samehadaku for: "${q}"`);
  try {
    const res = await axios.get(`https://ww2.samehadaku.pro/?s=${encodeURIComponent(q)}`, { httpsAgent: agent, headers, timeout: 4000 });
    const $ = cheerio.load(res.data);
    const items = [];
    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const h = $(el).attr('href');
      const t = $(el).find('.j, .sh-nm').text().trim() || $(el).text().trim();
      if (h && h.includes('/anime/') && !items.some(x => x.h === h)) {
        items.push({ t, h });
      }
    });
    console.log(`Found ${items.length} items:`, items);
    return items;
  } catch (e) {
    console.error('Search error:', e.message);
  }
  return [];
}

async function run() {
  await testQuery('daemons of the shadow realm');
  await testQuery('yomi no tsugai');
  await testQuery('tsuioku no suishou');
}

run().catch(console.error);
