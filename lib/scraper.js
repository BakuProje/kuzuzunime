import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns';
import https from 'https';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

const dnsCache = new Map([
  ['samehadaku.pro', '104.21.89.196'],
  ['ww2.samehadaku.pro', '104.21.89.196'],
  ['samehadaku.care', '172.67.143.205'],
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
  if (hostname.includes('kuramanime') || hostname.includes('nekopoi') || hostname.includes('nyomo') || hostname.includes('samehadaku')) {
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
  'https://ww2.samehadaku.pro/',
  'https://samehadaku.care/'
];

async function axiosGetFast(url, config = {}, timeoutMs = 4500) {
  return await axios.get(url, {
    httpsAgent: dohAgent,
    headers,
    timeout: timeoutMs,
    ...config
  });
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
      const res = await axiosGetFast(fullUrl, config, 4000);
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
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-eps-\d+.*$/i, '')
    .replace(/-ep-\d+.*$/i, '')
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

// 1. ANIMETERBARU (LATEST) - KURAMANIME WITH SAMEHADAKU & KITSU FALLBACK + PARALLEL COVER ENRICHMENT
export async function animeterbaru(page = 1) {
  // Primary: Kuramanime Latest
  try {
    const res = await fetchKuramanimeWithMirror(`/anime?order_by=updated&page=${page}`);
    const cards = parseKuramanimeCards(res.data);
    if (cards.length > 0) {
      return await enrichCardsWithPosters(cards);
    }
  } catch (kuraErr) {
    console.warn("[scraper.js] Kuramanime animeterbaru failed, trying Samehadaku...", kuraErr.message);
  }

  // Backup: Samehadaku Latest
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

  // Final Fallback: Kitsu Latest Ongoing Anime
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
    console.error("[scraper.js] Kitsu latest fallback failed:", kitsuErr.message);
    return [];
  }
}

// 2. POPULER - KURAMANIME WITH SAMEHADAKU & KITSU FALLBACK + PARALLEL COVER ENRICHMENT
export async function populer(page = 1) {
  // Primary: Kuramanime Popular
  try {
    const res = await fetchKuramanimeWithMirror(`/anime?order_by=popular&page=${page}`);
    const cards = parseKuramanimeCards(res.data);
    if (cards.length > 0) {
      return await enrichCardsWithPosters(cards);
    }
  } catch (e) {
    console.warn("[scraper.js] Kuramanime populer failed, trying Samehadaku...");
  }

  // Backup: Samehadaku Popular
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
      status: 'Ongoing',
      type: item.attributes?.showType?.toUpperCase() || 'TV',
      url: `/anime/${(item.attributes?.canonicalTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sub-indo/`
    }));
  } catch (e) {
    return [];
  }
}

// 3. SEARCH - KURAMANIME + SAMEHADAKU + KITSU + PARALLEL COVER ENRICHMENT
export async function search(query) {
  if (!query || query.trim() === '') return [];
  const q = query.trim();

  // Try Kuramanime Search
  const kuramanimePromise = (async () => {
    try {
      const res = await fetchKuramanimeWithMirror(`/anime?search=${encodeURIComponent(q)}`);
      return parseKuramanimeCards(res.data);
    } catch (e) {
      return [];
    }
  })();

  // Try Samehadaku Search
  const samehadakuPromise = (async () => {
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
      return list;
    } catch (e) {
      return [];
    }
  })();

  const [kuraList, samehadakuList] = await Promise.all([kuramanimePromise, samehadakuPromise]);

  // Combine and deduplicate
  const combined = [];
  const seenTitles = new Set();

  for (const item of [...kuraList, ...samehadakuList]) {
    const key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key && !seenTitles.has(key)) {
      seenTitles.add(key);
      combined.push(item);
    }
  }

  if (combined.length > 0) {
    return await enrichCardsWithPosters(combined);
  }

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

// 4. DETAIL - KURAMANIME WITH SAMEHADAKU & KITSU METADATA GENERATOR
export async function detail(link) {
  if (!link) return null;
  const rawPath = link.replace(/^\/+|\/+$/g, '');

  // 1. If it's a Kuramanime URL format: anime/:id/:slug
  if (rawPath.startsWith('anime/') && rawPath.split('/').length >= 2 && /^\d+$/.test(rawPath.split('/')[1])) {
    try {
      const res = await fetchKuramanimeWithMirror(`/${rawPath}`);
      const $ = cheerio.load(res.data);

      const title = $('.anime__details__title h3').first().text().trim() || $('title').text().split(' - Kuramanime')[0].trim();
      const altTitle = $('.anime__details__title span').first().text().trim();
      const synopsis = $('.anime__details__text p').text().trim() || $('meta[name="description"]').attr('content') || 'Nonton anime sub indo gratis di ZUNIME.';
      
      let image = $('.anime__details__pic, [data-setbg]').first().attr('data-setbg') || 
                  $('.anime__details__pic img').attr('src') || 
                  $('.anime__details__pic img').attr('data-src') || '';
      if (image && image.startsWith('//')) image = `https:${image}`;
      if (image.includes('placeholder.svg')) image = '';

      if (!image || image.includes('placeholder')) {
        image = await getAnimePoster(title, image);
      }

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

      if (title) {
        return {
          title,
          altTitle,
          image: image || '/placeholder.jpg',
          description: synopsis,
          episodes: episodes.reverse(),
          genres: genres.length > 0 ? genres : ['Action', 'Fantasy'],
          info: {
            status: info.status === 'Selesai Tayang' ? 'Completed' : (info.status || 'Ongoing'),
            studio: info.studio || 'Kuramanime',
            skor: info.skor || '8.5',
            type: info.type || 'TV',
            season: info.season || '2026',
            genre: genres.join(', ')
          },
          totalEpisodes: episodes.length
        };
      }
    } catch (kuraErr) {
      console.warn("[scraper.js] Kuramanime detail failed, trying Samehadaku fallback...", kuraErr.message);
    }
  }

  // 2. Samehadaku Detail
  const parentSlug = extractParentAnimeSlug(link);
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
          const res = await fetchSamehadakuWithMirror(bestUrl).catch(() => fetchKuramanimeWithMirror(`/${bestUrl}`));
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

  // 3. Kitsu Metadata Fallback
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

// 5. DOWNLOAD / WATCH - UNIVERSAL STREAM RESOLVER WITH NATIVE SAMEHADAKU & MUSIC EMBEDS
export async function download(link) {
  if (!link) return null;
  const rawClean = decodeURIComponent(link)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\/+|\/+$/g, '');

  const extractIframesFromHtml = (html) => {
    const $ = cheerio.load(html);
    const streams = [];
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-litespeed-src');
      if (src) {
        if (src.startsWith('//')) src = `https:${src}`;
        let serverName = `Putarin HD ${streams.length + 1}`;
        if (src.includes('putarin') || src.includes('puterin')) serverName = `Putarin HD ${streams.length + 1}`;
        else if (src.includes('mogo') || src.includes('playmogo')) serverName = `Mogo HD ${streams.length + 1}`;
        else if (src.includes('cdnhls') || src.includes('hls')) serverName = `HLS Player ${streams.length + 1}`;
        else if (src.includes('streampoi')) serverName = `Streampoi HD ${streams.length + 1}`;
        else if (src.includes('youtube')) serverName = `Music Audio & MV (Official)`;

        if (!streams.some(s => s.url === src)) {
          streams.push({ server: serverName, url: src });
        }
      }
    });
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

  const isMusic = /music|mv|song|single|theme|ost|vocaloid|idol|band\b/i.test(rawClean) || 
                  /music|mv|song|single|theme|ost|vocaloid|idol|band\b/i.test(cleanName);

  const safeTitle = `${cleanName} Episode ${epNum}`;
  // Clean special characters from slug
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

  // Step 2: Search Samehadaku with intelligent keyword fallback if not found directly
  if (foundNativeStreams.length === 0) {
    const cleanSearch = cleanName.replace(/[★☆♥♪×…\.#@!%^&*()+=\[\]{}|\\:;"'<>,?/~`]/g, ' ').replace(/\s+/g, ' ').trim();
    const queries = [cleanSearch];
    const words = cleanSearch.split(' ').filter(Boolean);
    if (words.length > 3) {
      queries.push(words.slice(0, 3).join(' '));
    }

    // Add Kitsu synonyms (e.g. Solo Leveling -> Ore dake Level Up na Ken)
    try {
      const kitsuRes = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanSearch)}&page[limit]=1`, {
        headers: { 'Accept': 'application/vnd.api+json' }
      }, 2000);
      const attr = kitsuRes.data?.data?.[0]?.attributes;
      if (attr) {
        if (attr.canonicalTitle) queries.push(attr.canonicalTitle);
        if (attr.titles?.en_jp) queries.push(attr.titles.en_jp);
      }
    } catch (kitsuErr) {}

    const uniqueQueries = [...new Set(queries.filter(q => q && q.length >= 2))];

    for (const q of uniqueQueries) {
      if (foundNativeStreams.length > 0) break;
      try {
        const searchRes = await fetchSamehadakuWithMirror(`?s=${encodeURIComponent(q)}`);
        if (!searchRes || !searchRes.data) continue;

        const $s = cheerio.load(searchRes.data);
        const animeLinks = [];
        $s('a[href*="/anime/"]').each((i, el) => {
          const h = $s(el).attr('href');
          const t = $s(el).find('.j').text().trim() || $s(el).find('.sh-nm').text().trim() || $s(el).text().trim();
          if (h && !animeLinks.some(x => x.href === h)) {
            // Verify reasonable similarity
            const sim = getSimilarity(cleanSearch, t);
            if (sim >= 0.35 || t.toLowerCase().includes(cleanSearch.toLowerCase()) || cleanSearch.toLowerCase().includes(t.toLowerCase())) {
              animeLinks.push({ href: h, title: t, sim });
            }
          }
        });

        animeLinks.sort((a, b) => b.sim - a.sim);

        for (const item of animeLinks.slice(0, 2)) {
          if (foundNativeStreams.length > 0) break;
          const animeHref = item.href;
          const aPath = animeHref.startsWith('http') ? new URL(animeHref).pathname.replace(/^\//, '') : animeHref.replace(/^\//, '');
          const detailRes = await fetchSamehadakuWithMirror(aPath);
          if (!detailRes || !detailRes.data) continue;

          const $d = cheerio.load(detailRes.data);
          let matchedEpUrl = null;

          $d('a[href*="/nonton/"]').each((i, el) => {
            if (matchedEpUrl) return;
            const href = $d(el).attr('href') || '';
            const text = $d(el).text().trim().toLowerCase();
            const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
            if (epRegex.test(text) || href.toLowerCase().includes(`episode-${epNum}-`) || href.toLowerCase().includes(`episode-0${epNum}-`)) {
              matchedEpUrl = href;
            }
          });

          if (!matchedEpUrl && epNum === '1') {
            matchedEpUrl = $d('a[href*="/nonton/"]').last().attr('href') || $d('a[href*="/nonton/"]').first().attr('href');
          }

          if (matchedEpUrl) {
            const epPath = matchedEpUrl.startsWith('http') ? new URL(matchedEpUrl).pathname.replace(/^\//, '') : matchedEpUrl.replace(/^\//, '');
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
  }

  // Step 3: Combine Active High-Speed Video Streams
  const combinedStreams = [...foundNativeStreams];

  const universalStreams = [
    {
      server: 'Server HD 1 (VidLink Pro)',
      url: `https://vidlink.pro/anime/${slugifiedTitle}/${epNum}`
    },
    {
      server: 'Server HD 2 (SmashyStream)',
      url: `https://player.smashy.stream/anime/${slugifiedTitle}?e=${epNum}`
    },
    {
      server: 'Server HD 3 (Vidsrc CC)',
      url: `https://vidsrc.cc/v2/embed/anime/${slugifiedTitle}/${epNum}`
    },
    {
      server: 'Server HD 4 (2Embed VIP)',
      url: `https://www.2embed.cc/embed/anime/${slugifiedTitle}/${epNum}`
    },
    {
      server: 'Server HD 5 (AutoEmbed)',
      url: `https://player.autoembed.cc/embed/anime/${slugifiedTitle}/${epNum}`
    }
  ];

  for (const us of universalStreams) {
    if (!combinedStreams.some(s => s.url === us.url)) {
      combinedStreams.push(us);
    }
  }

  return {
    title: foundTitle || safeTitle,
    streams: combinedStreams
  };
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
