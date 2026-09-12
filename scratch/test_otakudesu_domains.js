const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'
};

async function testDomains() {
  const domains = [
    'https://otakudesu.cloud',
    'https://otakudesu.best',
    'https://otakudesu.cda.moe',
    'https://otakudesu.cam',
    'https://otakudesu.asia'
  ];

  for (const d of domains) {
    try {
      console.log('Testing:', d);
      const res = await axios.get(d, { httpsAgent: agent, headers, timeout: 3000 });
      console.log(`[SUCCESS] Connected to ${d}! Title: ${res.data.match(/<title>([^<]+)<\/title>/i)?.[1]}`);
    } catch (e) {
      console.log(`[FAIL] ${d} -> ${e.message}`);
    }
  }
}

testDomains().catch(console.error);
