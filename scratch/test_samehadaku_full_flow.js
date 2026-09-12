const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const dns = require('dns');

const SAMEHADAKU_MIRRORS = [
  'https://ww2.samehadaku.pro/',
  'https://samehadaku.care/',
  'https://v2.samehadaku.how/',
  'https://samehadaku.how/'
];

const dnsCache = new Map([
  ['samehadaku.pro', '104.21.89.196'],
  ['ww2.samehadaku.pro', '104.21.89.196'],
  ['samehadaku.care', '172.67.143.205']
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

async function fetchSamehadaku(path = '') {
  const cleanPath = path.replace(/^\//, '');
  for (const domain of SAMEHADAKU_MIRRORS) {
    try {
      const fullUrl = `${domain}${cleanPath}`;
      const res = await axios.get(fullUrl, { httpsAgent: dohAgent, headers, timeout: 4000 });
      if (res && res.data && res.data.length > 500) {
        return { data: res.data, domain, url: fullUrl };
      }
    } catch (e) {}
  }
  throw new Error('All Samehadaku mirrors failed');
}

async function testFullFlow() {
  console.log('--- 1. TESTING LATEST ANIME (SAMEHADAKU) ---');
  const latestRes = await fetchSamehadaku('');
  const $l = cheerio.load(latestRes.data);
  const latestItems = [];
  $l('a[href*="/nonton/"]').each((i, el) => {
    const href = $l(el).attr('href');
    const text = $l(el).find('h3').text().trim() || $l(el).text().replace(/\s+/g, ' ').trim();
    let img = $l(el).find('img').attr('src') || $l(el).find('img').attr('data-src') || '';
    if (href && !latestItems.some(x => x.href === href)) {
      latestItems.push({ text: text.substring(0, 40), href, img });
    }
  });
  console.log(`Found ${latestItems.length} latest episodes! Top 3:`, latestItems.slice(0, 3));

  if (latestItems.length > 0) {
    const epUrl = latestItems[0].href;
    console.log('\n--- 2. TESTING WATCH PAGE FOR:', epUrl);
    const watchPath = epUrl.replace(/^https?:\/\/[^\/]+\//, '');
    const watchRes = await fetchSamehadaku(watchPath);
    const $w = cheerio.load(watchRes.data);
    console.log('Watch Page Title:', $w('title').text());
    const iframes = [];
    $w('iframe').each((i, el) => {
      const src = $w(el).attr('src') || $w(el).attr('data-src');
      if (src) iframes.push(src);
    });
    console.log('Watch Page Streams:', iframes);
  }

  console.log('\n--- 3. TESTING POPULAR ANIME (SAMEHADAKU) ---');
  const popItems = [];
  $l('a[href*="/anime/"]').each((i, el) => {
    const href = $l(el).attr('href');
    const text = $l(el).find('.sh-nm, .j').text().trim() || $l(el).text().trim();
    if (href && !popItems.some(x => x.href === href)) {
      popItems.push({ text: text.substring(0, 40), href });
    }
  });
  console.log(`Found ${popItems.length} popular anime! Top 3:`, popItems.slice(0, 3));

  if (popItems.length > 0) {
    const animeUrl = popItems[0].href;
    console.log('\n--- 4. TESTING ANIME DETAIL FOR:', animeUrl);
    const animePath = animeUrl.replace(/^https?:\/\/[^\/]+\//, '');
    const detailRes = await fetchSamehadaku(animePath);
    const $d = cheerio.load(detailRes.data);
    console.log('Detail Title:', $d('.sh-kolom h1, .entry-title').text().trim() || $d('title').text());
    const episodes = [];
    $d('a[href*="/nonton/"]').each((i, el) => {
      const href = $d(el).attr('href');
      const text = $d(el).text().trim();
      if (href && !episodes.some(x => x.href === href)) {
        episodes.push({ text, href });
      }
    });
    console.log(`Detail Episodes found: ${episodes.length}`);
  }
}

testFullFlow().catch(console.error);
