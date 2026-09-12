const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const dns = require('dns');

const dnsCache = new Map([
  ['samehadaku.how', '104.26.6.147'],
  ['v2.samehadaku.how', '104.26.6.147'],
  ['samehadaku.pro', '104.21.89.196'],
  ['ww2.samehadaku.pro', '104.21.89.196'],
  ['samehadaku.care', '172.67.143.205']
]);

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (dnsCache.has(hostname)) {
    const ip = dnsCache.get(hostname);
    if (options && options.all) {
      callback(null, [{ address: ip, family: 4 }]);
    } else {
      callback(null, ip, 4);
    }
    return;
  }
  dns.lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

const SAMEHADAKU_MIRRORS = [
  'https://v2.samehadaku.how/',
  'https://samehadaku.how/',
  'https://ww2.samehadaku.pro/',
  'https://samehadaku.care/'
];

async function fetchSamehadakuWithMirror(path = '') {
  const cleanPath = path.replace(/^\//, '');
  for (const domain of SAMEHADAKU_MIRRORS) {
    try {
      const fullUrl = `${domain}${cleanPath}`;
      console.log(`Trying ${fullUrl}...`);
      const res = await axios.get(fullUrl, {
        httpsAgent: dohAgent,
        headers,
        timeout: 4000
      });
      if (res && res.data && res.data.length > 500) {
        console.log(`[SUCCESS] Connected to ${domain}! Title: ${res.data.match(/<title>([^<]+)<\/title>/i)?.[1]}`);
        return { data: res.data, domain, url: fullUrl };
      }
    } catch (err) {
      console.log(`[FAIL] ${domain} -> ${err.message}`);
    }
  }
  throw new Error('All Samehadaku mirrors failed');
}

async function run() {
  const latest = await fetchSamehadakuWithMirror('');
  const $ = cheerio.load(latest.data);
  const items = [];
  $('a[href*="/nonton/"]').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const href = $(el).attr('href');
    if (href && !items.some(x => x.href === href)) {
      items.push({ text: text.substring(0, 50), href });
    }
  });
  console.log('Latest episodes found from Samehadaku:', items.length);
  console.log('Top 3 items:', items.slice(0, 3));
}

run().catch(console.error);
