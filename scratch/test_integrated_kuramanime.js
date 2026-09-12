const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const dns = require('dns');

const dohCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dohCache.has(hostname)) return dohCache.get(hostname);
  const dnsServers = ['8.8.8.8', '1.1.1.1', '9.9.9.9'];
  const agent = new https.Agent({ rejectUnauthorized: false });
  for (const dnsIp of dnsServers) {
    try {
      const hostHeader = dnsIp === '8.8.8.8' ? 'dns.google' : (dnsIp === '1.1.1.1' ? 'cloudflare-dns.com' : 'dns.quad9.net');
      const res = await axios.get(`https://${dnsIp}/resolve?name=${hostname}&type=A`, {
        httpsAgent: agent,
        headers: { 'Host': hostHeader },
        timeout: 3000
      });
      if (res.data && res.data.Answer) {
        const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
        if (ips.length > 0) {
          dohCache.set(hostname, ips[0]);
          return ips[0];
        }
      }
    } catch (err) {}
  }
  return null;
}

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('kuramanime') || hostname.includes('nekopoi') || hostname.includes('nyomo')) {
    resolveDnsDoH(hostname).then(ip => {
      if (ip) {
        if (options.all) {
          callback(null, [{ address: ip, family: 4 }]);
        } else {
          callback(null, ip, 4);
        }
      } else {
        dns.lookup(hostname, options, callback);
      }
    }).catch(err => {
      dns.lookup(hostname, options, callback);
    });
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

const KURAMANIME_MIRRORS = [
  'https://kuramanime.pro',
  'https://v20.kuramanime.ing',
  'https://kuramanime.run',
  'https://v7.kuramanime.run',
  'https://kuramanime.top'
];

async function fetchKuramanime(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let lastErr = null;
  for (const domain of KURAMANIME_MIRRORS) {
    try {
      const url = `${domain}${cleanPath}`;
      const res = await axios.get(url, {
        httpsAgent: dohAgent,
        headers,
        timeout: 6000
      });
      if (res && res.data) {
        return { data: res.data, url, domain };
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`Kuramanime fetch failed for ${cleanPath}`);
}

function parseCards(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seenUrls = new Set();

  $('.product__item, .anime__item').each((i, el) => {
    const $el = $(el);
    const href = $el.find('.product__item__text h5 a, .anime__item__text h5 a, a[href*="/anime/"]').first().attr('href') || '';
    if (!href.includes('/anime/') || seenUrls.has(href)) return;
    seenUrls.add(href);

    let title = $el.find('.product__item__text h5 a, .anime__item__text h5 a, h5 a, h5').first().text().trim();
    if (!title) {
      const slugParts = href.replace(/\/$/, '').split('/');
      title = slugParts[slugParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    let image = $el.find('[data-setbg]').attr('data-setbg') || $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    if (image && image.startsWith('//')) image = `https:${image}`;

    const score = $el.find('.ep span, .ep').first().text().replace(/[^\d\.]/g, '').trim() || '8.5';
    const type = $el.find('.product__item__text ul li').first().text().trim() || 'TV';
    const statusText = $el.text().toLowerCase();
    const status = statusText.includes('selesai') || statusText.includes('completed') ? 'Completed' : 'Ongoing';

    const cleanUrl = href.startsWith('http') ? new URL(href).pathname : href;

    if (title && cleanUrl) {
      items.push({
        title,
        url: cleanUrl,
        image: image || '/placeholder.jpg',
        episode: status === 'Completed' ? 'Tamat' : 'Ongoing',
        score: score || '8.5',
        type: type || 'TV',
        status
      });
    }
  });

  return items;
}

// 1. ANIMETERBARU
async function animeterbaru(page = 1) {
  try {
    const res = await fetchKuramanime(`/anime?order_by=updated&page=${page}`);
    const cards = parseCards(res.data);
    if (cards.length > 0) return cards;
  } catch (e) {
    console.warn('[Kuramanime] animeterbaru failed, falling back...');
  }
  return [];
}

// 2. POPULER
async function populer(page = 1) {
  try {
    const res = await fetchKuramanime(`/anime?order_by=popular&page=${page}`);
    const cards = parseCards(res.data);
    if (cards.length > 0) return cards;
  } catch (e) {
    console.warn('[Kuramanime] populer failed, falling back...');
  }
  return [];
}

// 3. SCHEDULE
async function schedule() {
  try {
    const res = await fetchKuramanime(`/schedule`);
    const cards = parseCards(res.data);
    if (cards.length > 0) return cards;
  } catch (e) {
    console.warn('[Kuramanime] schedule failed, falling back...');
  }
  return [];
}

// 4. SEARCH
async function searchAnime(q) {
  try {
    const res = await fetchKuramanime(`/anime?search=${encodeURIComponent(q)}`);
    const cards = parseCards(res.data);
    if (cards.length > 0) return cards;
  } catch (e) {
    console.warn('[Kuramanime] search failed, falling back...');
  }
  return [];
}

// 5. DETAIL
async function detail(animePath) {
  const cleanPath = animePath.replace(/^\/+|\/+$/g, '');
  const res = await fetchKuramanime(`/${cleanPath}`);
  const $ = cheerio.load(res.data);

  const title = $('.anime__details__title h3').first().text().trim() || $('title').text().split(' - Kuramanime')[0].trim();
  const altTitle = $('.anime__details__title span').first().text().trim();
  const synopsis = $('.anime__details__text p').text().trim() || $('meta[name="description"]').attr('content') || 'Nonton anime sub indo gratis di ZUNIME.';
  
  let image = $('.anime__details__pic, [data-setbg]').first().attr('data-setbg') || $('.anime__details__pic img').attr('src') || '';
  if (image && image.startsWith('//')) image = `https:${image}`;

  const info = {};
  const genres = [];
  $('.anime__details__widget ul li').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.includes('Tipe:')) info.type = text.replace('Tipe:', '').trim();
    else if (text.includes('Status:')) info.status = text.replace('Status:', '').trim();
    else if (text.includes('Studio:')) info.studio = text.replace('Studio:', '').trim();
    else if (text.includes('Skor:')) info.skor = text.replace('Skor:', '').trim().split('/')[0].trim();
    else if (text.includes('Musim:')) info.season = text.replace('Musim:', '').trim();
    else if (text.includes('Durasi:')) info.duration = text.replace('Durasi:', '').trim();
    else if (text.includes('Genre:')) {
      $(el).find('a').each((_, a) => {
        const g = $(a).text().trim().replace(/,/g, '');
        if (g && !genres.includes(g)) genres.push(g);
      });
    }
  });

  const episodes = [];
  const epContent = $('#episodeLists').attr('data-content') || '';
  if (epContent) {
    const $ep = cheerio.load(epContent);
    $ep('a').each((i, el) => {
      const epHref = $ep(el).attr('href') || '';
      const epText = $ep(el).text().trim();
      const epPath = epHref.startsWith('http') ? new URL(epHref).pathname : epHref;
      episodes.push({
        title: epText || `Episode ${i + 1}`,
        url: epPath,
        date: 'Terbaru'
      });
    });
  }

  return {
    title,
    altTitle,
    image: image || '/placeholder.jpg',
    description: synopsis,
    episodes: episodes.reverse(),
    genres: genres.length > 0 ? genres : ['Action', 'Fantasy'],
    info: {
      status: info.status || 'Ongoing',
      studio: info.studio || 'Kuramanime',
      skor: info.skor || '8.5',
      type: info.type || 'TV',
      season: info.season || '2026'
    },
    totalEpisodes: episodes.length
  };
}

async function runTest() {
  console.log('Testing animeterbaru...');
  const latest = await animeterbaru(1);
  console.log(`animeterbaru: ${latest.length} items. 1st: "${latest[0]?.title}" -> ${latest[0]?.url}`);

  console.log('\nTesting populer...');
  const pop = await populer(1);
  console.log(`populer: ${pop.length} items. 1st: "${pop[0]?.title}" -> ${pop[0]?.url}`);

  console.log('\nTesting search("naruto")...');
  const naruto = await searchAnime('naruto');
  console.log(`search: ${naruto.length} items. 1st: "${naruto[0]?.title}" -> ${naruto[0]?.url}`);

  console.log('\nTesting detail(naruto[0].url)...');
  const d = await detail(naruto[0].url);
  console.log(`detail: title="${d.title}", eps=${d.episodes.length}, 1st ep=${d.episodes[0]?.title}`);
}

runTest();
