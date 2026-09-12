const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const dns = require('dns');

const KURAMANIME_MIRRORS = [
  'https://kuramanime.pro',
  'https://v20.kuramanime.ing',
  'https://kuramanime.run',
  'https://v7.kuramanime.run',
  'https://kuramanime.top'
];

const dnsCache = new Map([
  ['kuramanime.pro', '172.67.179.173'],
  ['kuramanime.run', '104.21.83.198'],
  ['v7.kuramanime.run', '104.21.83.198'],
  ['kuramanime.top', '172.67.139.145']
]);

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (dnsCache.has(hostname)) {
    const ip = dnsCache.get(hostname);
    if (options && options.all) callback(null, [{ address: ip, family: 4 }]);
    else callback(null, ip, 4);
    return;
  }
  dns.lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({ lookup: customLookup, rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function testKuraWatch(path) {
  console.log('Testing Kuramanime watch path:', path);
  for (const domain of KURAMANIME_MIRRORS) {
    try {
      const url = `${domain}${path}`;
      console.log('Trying:', url);
      const res = await axios.get(url, { httpsAgent: dohAgent, headers, timeout: 5000 });
      if (res && res.data) {
        const $ = cheerio.load(res.data);
        console.log(`[SUCCESS] Connected to ${url}! Title:`, $('title').text());
        
        // Inspect video/iframe/source/select elements
        const streams = [];
        $('iframe, video, source, select option, #player').each((i, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('value');
          const txt = $(el).text().trim();
          if (src || txt) {
            streams.push({ tag: el.tagName, src, txt, attrs: el.attribs });
          }
        });
        console.log('Found Elements:', streams.slice(0, 10));
        return res.data;
      }
    } catch (e) {
      console.log(`[FAIL] ${domain} -> ${e.message}`);
    }
  }
}

testKuraWatch('/anime/2475/kage-no-jitsuryokusha-ni-naritakute/episode/1').catch(console.error);
