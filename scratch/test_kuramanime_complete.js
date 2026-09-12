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
  $('.product__item, .anime__item, .col-lg-4, .col-6').each((i, el) => {
    const $el = $(el);
    const href = $el.find('a').attr('href') || '';
    if (!href.includes('/anime/')) return;

    // Extract title
    let title = $el.find('h5, h6, .product__item__text h5, .anime__item__text h5').text().trim();
    if (!title) {
      const slugParts = href.replace(/\/$/, '').split('/');
      title = slugParts[slugParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Extract image
    let image = $el.find('[data-setbg]').attr('data-setbg') || $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    if (image && image.startsWith('//')) image = `https:${image}`;

    // Extract score / episode
    const epText = $el.find('.ep, .episode').first().text().trim();
    const scoreText = $el.find('.rate, .view, .comment').first().text().trim().replace(/[^\d\.]/g, '');

    // Extract status
    const statusText = $el.find('.text-white, .badge, .status').text().toLowerCase();
    const status = statusText.includes('selesai') || statusText.includes('completed') ? 'Completed' : 'Ongoing';

    const slug = href.startsWith('http') ? new URL(href).pathname : href;

    if (title && href) {
      items.push({
        title,
        url: slug,
        image: image || '/placeholder.jpg',
        episode: epText ? `Ep ${epText}` : 'Ongoing',
        score: scoreText || '8.5',
        status
      });
    }
  });

  return items;
}

// 1. LATEST
async function getLatest(page = 1) {
  const res = await fetchKuramanime(`/anime?order_by=updated&page=${page}`);
  return parseCards(res.data);
}

// 2. POPULAR
async function getPopular(page = 1) {
  const res = await fetchKuramanime(`/anime?order_by=popular&page=${page}`);
  return parseCards(res.data);
}

// 3. SEARCH
async function searchAnime(q) {
  const res = await fetchKuramanime(`/anime?search=${encodeURIComponent(q)}`);
  return parseCards(res.data);
}

// 4. DETAIL
async function getDetail(animePath) {
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
        if (g) genres.push(g);
      });
    }
  });

  // Parse Episodes from #episodeLists
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

  // Reverse if oldest first to put newest on top
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

async function test() {
  console.log('--- Testing Kuramanime Latest ---');
  const latest = await getLatest(1);
  console.log(`Latest count: ${latest.length}, Sample:`, latest[0]);

  console.log('\n--- Testing Kuramanime Popular ---');
  const pop = await getPopular(1);
  console.log(`Popular count: ${pop.length}, Sample:`, pop[0]);

  console.log('\n--- Testing Kuramanime Search ("solo leveling") ---');
  const searchResults = await searchAnime('solo leveling');
  console.log(`Search count: ${searchResults.length}, Sample:`, searchResults[0]);

  if (searchResults.length > 0) {
    console.log('\n--- Testing Kuramanime Detail for:', searchResults[0].url);
    const detailRes = await getDetail(searchResults[0].url);
    console.log('Detail Title:', detailRes.title);
    console.log('Detail Genres:', detailRes.genres);
    console.log('Detail Episodes count:', detailRes.episodes.length);
    console.log('Sample Episode:', detailRes.episodes[0]);
  }
}

test();
