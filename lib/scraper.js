import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns';
import https from 'https';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

const dnsCache = new Map([
  ['samehadaku.pro', '104.21.89.196'],
  ['ww2.samehadaku.pro', '104.21.89.196'],
  ['samehadaku.care', '104.21.27.247'],
  ['samehadaku.li', '104.21.89.196'],
  ['otakudesu.top', '172.67.174.36'],
  ['otakudesu.lol', '104.21.83.198'],
  ['otakudesu.media', '104.21.83.198'],
  ['kuramanime.pro', '172.67.179.173'],
  ['kuramanime.run', '104.21.83.198'],
  ['v7.kuramanime.run', '104.21.83.198'],
  ['kuramanime.top', '172.67.139.145']
]);

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) return dnsCache.get(hostname);
  const dnsServers = ['8.8.8.8', '1.1.1.1', '9.9.9.9'];
  const agent = new https.Agent({ rejectUnauthorized: false });
  for (const dnsIp of dnsServers) {
    try {
      const hostHeader = dnsIp === '8.8.8.8' ? 'dns.google' : (dnsIp === '1.1.1.1' ? 'cloudflare-dns.com' : 'dns.quad9.net');
      const res = await axios.get(`https://${dnsIp}/resolve?name=${hostname}&type=A`, {
        httpsAgent: agent,
        headers: { 'Host': hostHeader },
        timeout: 2500
      });
      if (res.data && res.data.Answer) {
        const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
        if (ips.length > 0) {
          dnsCache.set(hostname, ips[0]);
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
  if (hostname.includes('kuramanime') || hostname.includes('nekopoi') || hostname.includes('nyomo') || hostname.includes('samehadaku') || hostname.includes('otakudesu')) {
    resolveDnsDoH(hostname).then(ip => {
      if (ip) {
        if (options && options.all) {
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

const defaultAgent = new https.Agent({
  rejectUnauthorized: false
});

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

const KURAMANIME_MIRRORS = [
  'https://kuramanime.pro',
  'https://v20.kuramanime.ing',
  'https://kuramanime.run',
  'https://v7.kuramanime.run',
  'https://kuramanime.top'
];

const SAMEHADAKU_MIRRORS = [
  'https://samehadaku.li/',
  'https://ww2.samehadaku.pro/',
  'https://samehadaku.care/'
];

const OTAKUDESU_MIRRORS = [
  'https://otakudesu.top/',
  'https://otakudesu.lol/',
  'https://otakudesu.media/',
  'https://otakudesu.info/'
];

async function axiosGetFast(url, config = {}, timeoutMs = 6000) {
  const proxyBase = process.env.SCRAPER_PROXY_URL || process.env.NEXT_PUBLIC_SCRAPER_PROXY_URL;
  const fetchUrl = proxyBase ? `${proxyBase.replace(/\/+$/, '')}?url=${encodeURIComponent(url)}` : url;

  try {
    return await axios.get(fetchUrl, {
      httpsAgent: defaultAgent,
      headers,
      timeout: timeoutMs,
      ...config
    });
  } catch (err) {
    try {
      return await axios.get(fetchUrl, {
        httpsAgent: dohAgent,
        headers,
        timeout: timeoutMs,
        ...config
      });
    } catch (dohErr) {
      throw dohErr;
    }
  }
}

async function fetchKuramanimeWithMirror(path = '', config = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let lastError = null;

  for (const domain of KURAMANIME_MIRRORS) {
    try {
      const fullUrl = `${domain}${cleanPath}`;
      const res = await axiosGetFast(fullUrl, config, 4500);
      if (res && res.data) {
        return { data: res.data, domain, url: fullUrl };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`All Kuramanime mirrors failed for ${cleanPath}`);
}

async function fetchSamehadakuWithMirror(path = '', config = {}) {
  const cleanPath = path.replace(/^\//, '');
  let lastError = null;

  for (const domain of SAMEHADAKU_MIRRORS) {
    try {
      const fullUrl = `${domain}${cleanPath}`;
      const res = await axiosGetFast(fullUrl, config, 4500);
      if (res && res.data) {
        return { data: res.data, domain, url: fullUrl };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`All Samehadaku mirrors failed for ${cleanPath}`);
}

export function getSimilarity(str1, str2) {
  if (!str1 || !str2) return 0.0;
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const bigram of b1) {
    if (b2.has(bigram)) intersection++;
  }

  return (2.0 * intersection) / (b1.size + b2.size);
}

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/Subtitle\s+Indonesia/gi, '')
    .replace(/Sub\s+Indo/gi, '')
    .replace(/Sub-Indo/gi, '')
    .replace(/Episode\s*\d+/gi, '')
    .replace(/Ep\s*\d+/gi, '')
    .replace(/Eps\s*\d+/gi, '')
    .replace(/BD/gi, '')
    .replace(/Uncensored/gi, '')
    .replace(/Batch/gi, '')
    .replace(/\(\w+\)/g, '')
    .replace(/\[\w+\]/g, '')
    .replace(/\b(?:Kecil|Jadul|Lawas|Lengkap|Dub|Dubbing|Dub-Indo)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRelativeUrl(fullUrl) {
  if (!fullUrl) return '';
  try {
    if (fullUrl.startsWith('/')) return fullUrl;
    const parsed = new URL(fullUrl);
    return parsed.pathname + parsed.search;
  } catch (e) {
    return fullUrl.replace(/^https?:\/\/[^\/]+/, '');
  }
}

const posterCache = new Map();

export async function getAnimePoster(title, fallbackImage = '') {
  if (fallbackImage && !fallbackImage.includes('placeholder') && fallbackImage.startsWith('http')) {
    return fallbackImage;
  }
  if (!title) return fallbackImage || '/placeholder.jpg';

  const cacheKey = title.toLowerCase().trim();
  if (posterCache.has(cacheKey)) {
    return posterCache.get(cacheKey);
  }

  const clean = cleanTitle(title)
    .replace(/[♥☆◎★♪×…\.]/g, ' ')
    .replace(/\b(?:Ova|Special|Specials|Dub|Sub|Indo|Batch|The Animation|Season\s*\d+|\d+(?:st|nd|rd|th)?\s*Season|S\d+|2nd|3rd|4th|Part\s*\d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const queries = [clean, title];
  const words = clean.split(' ').filter(Boolean);
  if (words.length > 3) {
    queries.push(words.slice(0, 4).join(' '));
  }
  const uniqueQueries = [...new Set(queries.filter(q => q && q.length >= 2))];

  for (const q of uniqueQueries) {
    try {
      const res = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=1`, {
        headers: { 'Accept': 'application/vnd.api+json' }
      }, 2500);
      const anime = res.data?.data?.[0]?.attributes;
      const poster = anime?.posterImage?.large || anime?.posterImage?.medium || anime?.posterImage?.original;
      if (poster) {
        posterCache.set(cacheKey, poster);
        return poster;
      }
    } catch (e) {}
  }

  return fallbackImage || '/placeholder.jpg';
}

// Parallel Poster Enrichment Helper for card collections
async function enrichCardsWithPosters(cards = []) {
  if (!cards || cards.length === 0) return [];
  return await Promise.all(
    cards.map(async (card) => {
      if (!card.image || card.image === '/placeholder.jpg' || card.image.includes('placeholder')) {
        const poster = await getAnimePoster(card.title, card.image);
        return { ...card, image: poster };
      }
      return card;
    })
  );
}

function extractParentAnimeSlug(inputUrl) {
  if (!inputUrl) return '';
  return decodeURIComponent(inputUrl)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\d+\//, '') // strip leading numeric ID like 2475/ or 4624/
    .replace(/(?:-episode-|-eps-|-ep-|\/episode\/)\d+.*$/i, '')
    .replace(/\/episode\/\d+.*$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function extractWatchSlug(inputUrl) {
  if (!inputUrl) return '';
  return decodeURIComponent(inputUrl)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\/+|\/+$/g, '');
}

export async function getAniListData(title) {
  if (!title) return null;
  const cacheKey = title.toString().toLowerCase().trim();
  if (posterCache.has(`anilist_${cacheKey}`)) {
    return posterCache.get(`anilist_${cacheKey}`);
  }

  try {
    const res = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`, {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 2500);
    const anime = res.data?.data?.[0]?.attributes;
    if (anime) {
      const result = {
        title: anime.canonicalTitle || title,
        rating: anime.averageRating ? (parseFloat(anime.averageRating) / 10).toFixed(1) : '8.5',
        banner: anime.coverImage?.large || anime.posterImage?.large,
        poster: anime.posterImage?.large || anime.posterImage?.medium,
        genres: ['Action', 'Fantasy'],
        totalEpisodes: anime.episodeCount || 12,
        status: anime.status === 'finished' ? 'Completed' : 'Ongoing',
        format: anime.showType?.toUpperCase() || 'TV',
        description: anime.synopsis || '',
        studio: 'Zunime'
      };
      posterCache.set(`anilist_${cacheKey}`, result);
      return result;
    }
  } catch (e) {}

  return null;
}

function parseKuramanimeCards(html) {
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

    let image = $el.find('[data-setbg]').attr('data-setbg') || 
                $el.find('img').attr('src') || 
                $el.find('img').attr('data-src') || 
                $el.find('img').attr('data-original') || 
                $el.find('img').attr('data-cfsrc') || '';
    if (image && image.startsWith('//')) image = `https:${image}`;
    if (image.includes('placeholder.svg')) image = '';

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

// 1. ANIMETERBARU (LATEST) - SAMEHADAKU PRIMARY WITH KITSU FALLBACK + PARALLEL COVER ENRICHMENT
export async function animeterbaru(page = 1) {
  // Primary: Samehadaku Latest
  try {
    const path = page > 1 ? `page/${page}/` : '';
    const res = await fetchSamehadakuWithMirror(path);
    const $ = cheerio.load(res.data);
    const rawUpdates = [];
    const seenUrls = new Set();

    $('a[href*="/nonton/"]').each((i, el) => {
      const $el = $(el);
      const originalUrl = $el.attr('href');
      if (!originalUrl || seenUrls.has(originalUrl)) return;
      seenUrls.add(originalUrl);

      const fullText = $el.text().replace(/\s+/g, ' ').trim();
      const cleanName = $el.find('h3').text().trim() || fullText.split(' Episode ')[0] || fullText;

      let image = $el.find('img').attr('src') || 
                  $el.find('img').attr('data-src') || 
                  $el.find('img').attr('data-original') || 
                  $el.find('img').attr('data-cfsrc') || '';
      if (image.includes('placeholder.svg')) image = '';

      let episode = 'Ongoing';
      const epMatch = $el.find('p:contains("Episode") b').text().trim() || fullText.match(/Episode\s*(\d+)/i)?.[1];
      if (epMatch) episode = epMatch;

      rawUpdates.push({
        title: cleanName,
        url: getRelativeUrl(originalUrl),
        image: image || '/placeholder.jpg',
        episode: `Episode ${episode}`,
        score: '8.5',
        status: 'Ongoing'
      });
    });

    if (rawUpdates.length > 0) {
      return await enrichCardsWithPosters(rawUpdates);
    }
  } catch (error) {
    console.warn("[scraper.js] Samehadaku animeterbaru failed, triggering Kitsu fallback...", error.message);
  }

  // Backup: Kitsu Latest Ongoing Anime
  try {
    const p1 = await axiosGetFast('https://kitsu.io/api/edge/anime?filter[status]=current&sort=-userCount&page[limit]=20&page[offset]=0', {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 3500);
    const items = p1.data?.data || [];
    return items.map((item, idx) => {
      const title = item.attributes?.canonicalTitle || `Anime ${idx + 1}`;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return {
        title,
        url: `/anime/${slug}-sub-indo/`,
        image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
        episode: item.attributes?.episodeCount ? `Episode ${item.attributes.episodeCount}` : 'Ongoing',
        score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
        status: 'Ongoing'
      };
    });
  } catch (kitsuErr) {
    return [];
  }
}

// 2. POPULER - SAMEHADAKU PRIMARY WITH KITSU FALLBACK + PARALLEL COVER ENRICHMENT
export async function populer(page = 1) {
  // Primary: Samehadaku Popular
  try {
    const res = await fetchSamehadakuWithMirror('');
    const $ = cheerio.load(res.data);
    const topList = [];
    const seen = new Set();

    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href || href.includes('anime-list') || seen.has(href)) return;
      if (!href.includes('/anime/')) return;
      seen.add(href);

      const title = $(el).find('.sh-nm').text().trim() || $(el).find('.j').text().trim() || $(el).text().trim();
      let image = $(el).find('img').attr('src') || 
                  $(el).find('img').attr('data-src') || 
                  $(el).find('img').attr('data-original') || 
                  $(el).find('img').attr('data-cfsrc') || '';
      if (image.includes('placeholder.svg')) image = '';

      const eps = $(el).find('.jarvis-eps').text().trim() || 'Ongoing';
      const score = $(el).find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

      if (title && title.length > 1) {
        topList.push({
          title,
          image: image || '/placeholder.jpg',
          score,
          episode: eps,
          status: eps.toLowerCase().includes('tamat') ? 'Completed' : 'Ongoing',
          type: 'TV',
          url: getRelativeUrl(href)
        });
      }
    });

    if (topList.length > 0) {
      return await enrichCardsWithPosters(topList);
    }
  } catch (samehadakuErr) {}

  // Backup: Kitsu Trending
  try {
    const kitsuRes = await axiosGetFast('https://kitsu.io/api/edge/trending/anime?limit=20', {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 3500);
    const items = kitsuRes.data?.data || [];
    return items.map(item => ({
      title: item.attributes?.canonicalTitle,
      image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
      score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
      episode: item.attributes?.episodeCount ? `Episode ${item.attributes.episodeCount}` : 'Ongoing',
      status: 'Ongoing',
      type: item.attributes?.showType?.toUpperCase() || 'TV',
      url: `/anime/${(item.attributes?.canonicalTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`
    }));
  } catch (e) {
    return [];
  }
}

// 3. SEARCH - SAMEHADAKU + KITSU + PARALLEL COVER ENRICHMENT
export async function search(query) {
  if (!query || query.trim() === '') return [];
  const q = query.trim();

  // Primary: Samehadaku Search
  try {
    const res = await fetchSamehadakuWithMirror(`?s=${encodeURIComponent(q)}`);
    const $ = cheerio.load(res.data);
    const list = [];
    const seen = new Set();

    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href || href.includes('anime-list') || seen.has(href)) return;
      if (!href.includes('/anime/')) return;
      seen.add(href);

      const title = $(el).find('.j').text().trim() || $(el).find('.sh-nm').text().trim() || $(el).attr('title') || '';
      if (!title) return;

      let image = $(el).find('img').attr('src') || 
                  $(el).find('img').attr('data-src') || 
                  $(el).find('img').attr('data-original') || 
                  $(el).find('img').attr('data-cfsrc') || '';
      if (image.includes('placeholder.svg')) image = '';

      const eps = $(el).find('.jarvis-eps').text().trim() || 'Ongoing';
      const score = $(el).find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

      list.push({
        title,
        image: image || '/placeholder.jpg',
        type: 'TV',
        status: eps.toLowerCase().includes('tamat') ? 'Completed' : 'Ongoing',
        score,
        episode: eps,
        url: getRelativeUrl(href)
      });
    });

    if (list.length > 0) {
      return await enrichCardsWithPosters(list);
    }
  } catch (e) {}

  // Fallback: Kitsu Text Search
  try {
    const kitsuRes = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=18`, {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 3500);
    const items = kitsuRes.data?.data || [];
    return items.map(item => {
      const title = item.attributes?.canonicalTitle || q;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return {
        title,
        image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
        type: item.attributes?.showType?.toUpperCase() || 'TV',
        status: item.attributes?.status === 'finished' ? 'Completed' : 'Ongoing',
        score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
        episode: item.attributes?.episodeCount ? `Ep ${item.attributes.episodeCount}` : 'Ongoing',
        url: `/anime/${slug}-sub-indo/`
      };
    });
  } catch (kitsuErr) {
    return [];
  }
}

// 4. DETAIL - SAMEHADAKU PRIMARY WITH KITSU FALLBACK
export async function detail(link) {
  if (!link) return null;
  const parentSlug = extractParentAnimeSlug(link);
  if (!parentSlug) return null;

  // 1. Samehadaku Detail Primary
  const targetPath = `anime/${parentSlug}/`;

  let htmlData = null;
  try {
    const res = await fetchSamehadakuWithMirror(targetPath);
    if (res && res.data) {
      htmlData = res.data;
    }
  } catch (directErr) {
    try {
      const query = parentSlug.replace(/-/g, ' ');
      const searchRes = await search(query);
      if (searchRes && searchRes.length > 0) {
        const bestUrl = searchRes[0].url.replace(/^\//, '');
        if (bestUrl.startsWith('anime/')) {
          const res = await fetchSamehadakuWithMirror(bestUrl);
          if (res && res.data) {
            htmlData = res.data;
          }
        }
      }
    } catch (searchErr) {}
  }

  if (htmlData) {
    try {
      const $ = cheerio.load(htmlData);
      const title = $('.sh-kolom h1, .sh-judul, .entry-title, .anime__details__title h3').first().text().trim() || $('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim();
      let image = $('.sh-det-po img, .sh-kolom img, .anime__details__pic, [data-setbg]').first().attr('src') || 
                  $('.anime__details__pic, [data-setbg]').attr('data-setbg') || 
                  $('.sh-det-po img').attr('data-src') || '';
      if (image.includes('placeholder.svg')) image = '';

      if (!image || image.includes('placeholder')) {
        image = await getAnimePoster(title, image);
      }

      const description = $('.sh-sin, .anime__details__text p').text().trim() || $('meta[name="description"]').attr('content') || 'Nonton streaming anime subtitle Indonesia di ZUNIME.';

      const episodes = [];
      const seenEpUrls = new Set();
      $('.sh-daftar-grid a, .sh-pan a, a[href*="/nonton/"], a[href*="/episode/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href || seenEpUrls.has(href)) return;
        if (!href.includes('/nonton/') && !href.includes('/episode/')) return;
        seenEpUrls.add(href);
        const epText = $(el).text().trim() || `Episode ${episodes.length + 1}`;
        episodes.push({
          title: epText,
          url: getRelativeUrl(href),
          date: 'Terbaru'
        });
      });

      let status = 'Ongoing';
      let score = '8.5';
      $('.sh-chip').each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes('★')) {
          score = text.replace(/[★\s]/g, '');
        } else if (text.toLowerCase().includes('finished') || text.toLowerCase().includes('completed') || text.toLowerCase().includes('tamat')) {
          status = 'Completed';
        } else if (text.toLowerCase().includes('releasing') || text.toLowerCase().includes('ongoing')) {
          status = 'Ongoing';
        }
      });

      const genres = [];
      $('.sh-det a[href*="/genre/"], .sh-pan a[href*="/genre/"]').each((i, el) => {
        const g = $(el).text().trim();
        if (g && !genres.includes(g)) genres.push(g);
      });

      if (episodes.length > 0) {
        return {
          title,
          image: image || '/placeholder.jpg',
          description,
          episodes,
          info: {
            japanese: '',
            english: '',
            status,
            studio: 'Zunime',
            dirilis: '2026',
            skor: score,
            genre: genres.join(', ')
          },
          genres: genres.length > 0 ? genres : ['Action', 'Fantasy'],
          totalEpisodes: episodes.length
        };
      }
    } catch (e) {}
  }

  // 2. Kitsu Metadata Fallback
  try {
    const query = parentSlug.replace(/-/g, ' ').replace(/\bsub\s*indo\b/gi, '').trim();
    const kitsuRes = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=1`, {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 3500);
    const anime = kitsuRes.data?.data?.[0]?.attributes;
    if (anime) {
      const epCount = anime.episodeCount || 12;
      const episodes = [];
      for (let ep = epCount; ep >= 1; ep--) {
        episodes.push({
          title: `Episode ${ep}`,
          url: `/watch/${parentSlug}-episode-${ep}/`,
          date: 'Terbaru'
        });
      }

      return {
        title: anime.canonicalTitle || query,
        image: anime.posterImage?.large || anime.posterImage?.medium || '/placeholder.jpg',
        description: anime.synopsis || 'Nonton streaming anime subtitle Indonesia di ZUNIME.',
        episodes,
        info: {
          japanese: anime.titles?.ja_jp || '',
          english: anime.titles?.en || '',
          status: anime.status === 'finished' ? 'Completed' : 'Ongoing',
          studio: 'Zunime',
          dirilis: anime.startDate ? anime.startDate.split('-')[0] : '2026',
          skor: anime.averageRating ? (parseFloat(anime.averageRating) / 10).toFixed(1) : '8.5',
          genre: 'Action, Fantasy, Adventure'
        },
        genres: ['Action', 'Fantasy', 'Adventure'],
        totalEpisodes: episodes.length
      };
    }
  } catch (kitsuErr) {}

  return null;
}

export async function getTitleSynonyms(query) {
  const synonyms = new Set();
  const cleanQ = (query || '')
    .replace(/[★☆♥♪×…\.#@!%^&*()+=\[\]{}|\\:;"'<>,?/~`]/g, ' ')
    .replace(/\b(?:sub\s*indo|subtitle\s*indonesia|tv|ona|ova|movie|bd|uncensored|batch|season\s*\d+|\d+nd\s*season|\d+th\s*season|\d+rd\s*season|part\s*\d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanQ) synonyms.add(cleanQ);

  try {
    const res = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanQ)}&page[limit]=3`, {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 2000);
    const dataList = res.data?.data || [];
    for (const item of dataList) {
      const attr = item.attributes;
      if (!attr) continue;
      // Prioritize Romaji title (en_jp) first so Samehadaku matches instantly!
      if (attr.titles?.en_jp) synonyms.add(attr.titles.en_jp);
      if (attr.canonicalTitle) synonyms.add(attr.canonicalTitle);
      if (attr.titles?.ja_jp) synonyms.add(attr.titles.ja_jp);
      if (attr.titles?.en) synonyms.add(attr.titles.en);
      if (attr.titles?.en_us) synonyms.add(attr.titles.en_us);
      if (Array.isArray(attr.abbreviatedTitles)) {
        attr.abbreviatedTitles.forEach(t => synonyms.add(t));
      }
    }
  } catch (e) {}

  return Array.from(synonyms).filter(s => s && s.trim().length >= 2);
}

// 5. DOWNLOAD / WATCH - UNIVERSAL STREAM RESOLVER WITH NATIVE SAMEHADAKU & MULTI-SERVER RESOLVER
export async function download(link) {
  if (!link) return null;
  const rawClean = decodeURIComponent(link)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\/+|\/+$/g, '');

  const extractIframesFromHtml = (html) => {
    if (!html) return [];
    const $ = cheerio.load(html);
    const streams = [];
    
    // Helper to sanitize stream URL
    const addStream = (rawUrl, preferredName = '') => {
      if (!rawUrl) return;
      let url = rawUrl.trim();
      try {
        if (url.startsWith('aHR0c')) {
          url = Buffer.from(url, 'base64').toString('utf-8');
        }
      } catch (e) {}
      if (url.startsWith('//')) url = `https:${url}`;
      if (!url.startsWith('http')) return;

      // Normalize to https for Vercel Mixed Content prevention
      if (url.startsWith('http://')) {
        url = url.replace(/^http:\/\//i, 'https://');
      }

      if (streams.some(s => s.url === url)) return;

      let serverName = preferredName || `Server HD ${streams.length + 1}`;
      const urlLower = url.toLowerCase();
      if (urlLower.includes('putarin') || urlLower.includes('puterin')) serverName = `Putarin HD ${streams.length + 1}`;
      else if (urlLower.includes('mogo') || urlLower.includes('playmogo')) serverName = `Mogo HD ${streams.length + 1}`;
      else if (urlLower.includes('cdnhls') || urlLower.includes('hls')) serverName = `HLS Player ${streams.length + 1}`;
      else if (urlLower.includes('streampoi')) serverName = `Streampoi HD ${streams.length + 1}`;
      else if (urlLower.includes('desu') || urlLower.includes('otakudesu')) serverName = `DesuStream HD ${streams.length + 1}`;
      else if (urlLower.includes('youtube')) serverName = `Music Audio & MV (Official)`;

      streams.push({ server: serverName, url });
    };

    // 1. Extract from standard <iframe> elements and all potential lazyload attributes
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-litespeed-src') || $(el).attr('data-lazy-src') || $(el).attr('data-original');
      if (src) addStream(src);
    });

    // 2. Extract from select option values if any contain direct URLs or base64
    $('select option, .mirror option, #server option, .server option').each((i, el) => {
      const val = $(el).attr('value') || $(el).attr('data-content') || $(el).attr('data-url') || '';
      const text = $(el).text().trim();
      if (val) addStream(val, text);
    });

    // 3. Extract stream URLs embedded inside inline <script> tags
    const scriptRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:putarin\.[a-z]+|puterin\.[a-z]+|playmogo\.[a-z]+|mogo\.[a-z]+|desustream\.[a-z]+|streampoi\.[a-z]+|gdriveplayer\.[a-z]+)\/(?:e|embed|v)\/[a-zA-Z0-9_\-\.\/]+/gi;
    const scriptMatches = html.match(scriptRegex);
    if (scriptMatches) {
      scriptMatches.forEach(url => addStream(url));
    }

    return streams;
  };

  const epMatch = rawClean.match(/(?:episode|eps|ep)[-_ \/]*(\d+(\.\d+)?)/i);
  const epNum = epMatch ? epMatch[1] : '1';
  const cleanName = rawClean
    .replace(/^(?:\d+\/|\d+-)/, '') // strip leading kuramanime id e.g. 2475/ or 4624-
    .replace(/(?:-episode-|-eps-|-ep-|\/episode\/)\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/\((?:music|tv|ona|ova|bd)\)/gi, '')
    .replace(/\[(?:music|tv|ona|ova|bd)\]/gi, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const safeTitle = `${cleanName} Episode ${epNum}`;
  const slugifiedTitle = cleanName
    .replace(/[★☆♥♪×…\.#@!%^&*()+=\[\]{}|\\:;"'<>,?/~`]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let foundNativeStreams = [];
  let foundTitle = safeTitle;

  // Step 1: Direct Samehadaku fetch
  try {
    const targetPath = `nonton/${rawClean}/`;
    const res = await fetchSamehadakuWithMirror(targetPath);
    if (res && res.data) {
      const streams = extractIframesFromHtml(res.data);
      if (streams.length > 0) {
        const $ = cheerio.load(res.data);
        foundTitle = $('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim() || safeTitle;
        foundNativeStreams = streams;
      }
    }
  } catch (e) {}

  // Step 2: Multi-Synonym Samehadaku & Otakudesu Search
  if (foundNativeStreams.length === 0) {
    const synonyms = await getTitleSynonyms(cleanName);
    const queries = new Set();
    for (const syn of synonyms) {
      const cleaned = syn.replace(/[★☆♥♪×…\.#@!%^&*()+=\[\]{}|\\:;"'<>,?/~`]/g, ' ')
        .replace(/\b(?:sub\s*indo|subtitle\s*indonesia|tv|ona|ova|movie|bd|uncensored|batch|season\s*\d+|\d+nd\s*season|\d+th\s*season|\d+rd\s*season|part\s*\d+)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned) {
        queries.add(cleaned);
        const words = cleaned.split(' ').filter(Boolean);
        if (words.length > 3) {
          queries.add(words.slice(0, 3).join(' '));
        }
        if (words.length > 2) {
          queries.add(words.slice(0, 2).join(' '));
        }
      }
    }

    const uniqueQueries = Array.from(queries).filter(q => q && q.length >= 2);

    // 2a. Search Samehadaku mirrors
    for (const q of uniqueQueries) {
      if (foundNativeStreams.length > 0) break;
      try {
        const searchRes = await fetchSamehadakuWithMirror(`?s=${encodeURIComponent(q)}`);
        if (!searchRes || !searchRes.data) continue;

        const $s = cheerio.load(searchRes.data);
        const animeLinks = [];
        $s('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
          const h = $s(el).attr('href');
          const t = $s(el).find('.j').text().trim() || $s(el).find('.sh-nm').text().trim() || $s(el).text().trim();
          if (h && !animeLinks.some(x => x.href === h)) {
            animeLinks.push({ href: h, title: t });
          }
        });

        for (const item of animeLinks.slice(0, 2)) {
          if (foundNativeStreams.length > 0) break;
          const aPath = item.href.startsWith('http') ? new URL(item.href).pathname.replace(/^\//, '') : item.href.replace(/^\//, '');
          const detailRes = await fetchSamehadakuWithMirror(aPath);
          if (!detailRes || !detailRes.data) continue;

          const $d = cheerio.load(detailRes.data);
          const epLinks = [];
          $d('a[href*="/nonton/"]').each((i, el) => {
            const href = $d(el).attr('href');
            const text = $d(el).text().trim();
            if (href && !epLinks.some(x => x.href === href)) {
              epLinks.push({ text, href });
            }
          });

          const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
          let matchedEp = epLinks.find(e => epRegex.test(e.text) || epRegex.test(e.href)) || (epNum === '1' ? epLinks[epLinks.length - 1] : null);

          if (matchedEp) {
            const epPath = matchedEp.href.startsWith('http') ? new URL(matchedEp.href).pathname.replace(/^\//, '') : matchedEp.href.replace(/^\//, '');
            const epRes = await fetchSamehadakuWithMirror(epPath);
            if (epRes && epRes.data) {
              const streams = extractIframesFromHtml(epRes.data);
              if (streams.length > 0) {
                const $w = cheerio.load(epRes.data);
                foundTitle = $w('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim() || safeTitle;
                foundNativeStreams = streams;
              }
            }
          }
        }
      } catch (err) {}
    }

    // 2b. If Still 0 streams, search Otakudesu mirrors
    if (foundNativeStreams.length === 0) {
      for (const q of uniqueQueries) {
        if (foundNativeStreams.length > 0) break;
        for (const domain of OTAKUDESU_MIRRORS) {
          if (foundNativeStreams.length > 0) break;
          try {
            const oUrl = `${domain}?s=${encodeURIComponent(q)}&post_type=anime`;
            const oRes = await axiosGetFast(oUrl, {}, 3500);
            if (!oRes || !oRes.data) continue;

            const $o = cheerio.load(oRes.data);
            const animeList = [];
            $o('ul.chlist li a, .venz a, .jdlflm a, a[href*="/anime/"]').each((i, el) => {
              const href = $o(el).attr('href');
              const title = $o(el).text().trim();
              if (href && href.includes('/anime/') && !animeList.some(x => x.href === href)) {
                animeList.push({ title, href });
              }
            });

            if (animeList.length === 0) continue;

            const aRes = await axiosGetFast(animeList[0].href, {}, 3500);
            const $a = cheerio.load(aRes.data);
            const epLinks = [];
            $a('.episodelist a, a[href*="/episode/"]').each((i, el) => {
              const href = $a(el).attr('href');
              const text = $a(el).text().trim();
              if (href && !epLinks.some(x => x.href === href)) {
                epLinks.push({ text, href });
              }
            });

            const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
            let matchedEp = epLinks.find(e => epRegex.test(e.text) || epRegex.test(e.href)) || (epNum === '1' ? epLinks[epLinks.length - 1] : null);

            if (matchedEp) {
              const epRes = await axiosGetFast(matchedEp.href, {}, 3500);
              const $ep = cheerio.load(epRes.data);
              const streams = extractIframesFromHtml(epRes.data);
              if (streams.length > 0) {
                foundTitle = $ep('.postcontent h1, title').first().text().trim() || safeTitle;
                foundNativeStreams = streams;
              }
            }
          } catch (e) {}
        }
      }
    }
  }

  // Step 3: Return Only Valid Native High-Speed Video Streams (Putarin / Mogo / DesuStream / HLS)
  return {
    title: foundTitle || safeTitle,
    streams: foundNativeStreams
  };
}

const malIdCache = new Map();

export async function getAnimeMalId(title) {
  if (!title) return null;
  const cleanQ = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (malIdCache.has(cleanQ)) return malIdCache.get(cleanQ);

  try {
    const res = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanQ)}&page[limit]=1`, {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 2500);
    const anime = res.data?.data?.[0];
    if (anime) {
      const mapRes = await axiosGetFast(`https://kitsu.io/api/edge/anime/${anime.id}/mappings`, {
        headers: { 'Accept': 'application/vnd.api+json' }
      }, 2500);
      const malMapping = mapRes.data?.data?.find(m => m.attributes?.externalSite === 'myanimelist/anime');
      const malId = malMapping?.attributes?.externalId || null;
      if (malId) {
        malIdCache.set(cleanQ, malId);
        return malId;
      }
    }
  } catch (e) {}
  return null;
}

// 6. SCHEDULE - KURAMANIME WITH SAMEHADAKU & KITSU FALLBACK + PARALLEL COVER ENRICHMENT
export async function schedule() {
  // Primary: Kuramanime Schedule
  try {
    const res = await fetchKuramanimeWithMirror(`/schedule`);
    const cards = parseKuramanimeCards(res.data);
    if (cards.length > 0) {
      return await enrichCardsWithPosters(cards);
    }
  } catch (kuraErr) {
    console.warn("[scraper.js] Kuramanime schedule failed, trying Samehadaku...");
  }

  // Backup: Samehadaku Schedule
  try {
    const res = await fetchSamehadakuWithMirror('ongoing/');
    const $ = cheerio.load(res.data);
    const rawItems = [];

    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href || !href.includes('/anime/')) return;
      const title = $el.find('.j').text().trim() || $el.find('.sh-nm').text().trim() || '';
      let image = $el.find('img').attr('src') || 
                  $el.find('img').attr('data-src') || 
                  $el.find('img').attr('data-original') || '';
      if (image.includes('placeholder.svg')) image = '';
      const eps = $el.find('.jarvis-eps').text().trim() || 'Ongoing';
      const score = $el.find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

      if (title) {
        rawItems.push({
          title,
          image: image || '/placeholder.jpg',
          score,
          episode: eps,
          url: getRelativeUrl(href)
        });
      }
    });

    if (rawItems.length > 0) {
      return await enrichCardsWithPosters(rawItems);
    }
  } catch (error) {}

  // Final Fallback: Kitsu Trending
  try {
    const kitsuRes = await axiosGetFast('https://kitsu.io/api/edge/trending/anime?limit=20', {
      headers: { 'Accept': 'application/vnd.api+json' }
    }, 3500);
    const items = kitsuRes.data?.data || [];
    return items.map(item => ({
      title: item.attributes?.canonicalTitle,
      image: item.attributes?.posterImage?.large || item.attributes?.posterImage?.medium || '/placeholder.jpg',
      score: item.attributes?.averageRating ? (parseFloat(item.attributes.averageRating) / 10).toFixed(1) : '8.5',
      episode: item.attributes?.episodeCount ? `Episode ${item.attributes.episodeCount}` : 'Ongoing',
      url: `/anime/${(item.attributes?.canonicalTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`
    }));
  } catch (e) {
    return [];
  }
}

export { cleanTitle, extractParentAnimeSlug, extractWatchSlug };
