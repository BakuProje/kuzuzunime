const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    let ip = '172.67.179.173';
    if (options && options.all) callback(null, [{ address: ip, family: 4 }]);
    else callback(null, ip, 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
};

async function dumpKuraScripts() {
  const res = await axios.get('https://kuramanime.pro/anime/4624/baby-music/episode/1', { httpsAgent: agent, headers, timeout: 6000 });
  const $ = cheerio.load(res.data);
  $('script').each((i, el) => {
    const src = $(el).attr('src');
    const text = $(el).html() || '';
    if (src) console.log('Script src:', src);
    if (text.length > 50) {
      console.log(`Script inline (${text.length} chars):`, text.substring(0, 400));
    }
  });
}

dumpKuraScripts().catch(console.error);
