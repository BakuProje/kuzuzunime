import axios from 'axios';
import * as cheerio from 'cheerio';

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

const SAMEHADAKU_MIRRORS = [
  'https://samehadaku.pro/',
  'https://samehadaku.email/'
];

async function axiosGetFast(url, config = {}, timeoutMs = 5000) {
  try {
    return await axios.get(url, {
      headers,
      timeout: timeoutMs,
      ...config
    });
  } catch (err) {
    throw err;
  }
}

async function fetchSamehadakuWithMirror(path = '', config = {}) {
  const cleanPath = path.replace(/^\//, '');
  let lastError = null;

  for (const domain of SAMEHADAKU_MIRRORS) {
    try {
      const fullUrl = `${domain}${cleanPath}`;
      const res = await axiosGetFast(fullUrl, config, 5000);
      if (res && res.data) {
        return { data: res.data, domain, url: fullUrl };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Samehadaku Mirror] ${domain}${cleanPath} failed (${err.message}). Trying next mirror...`);
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

const aniListCache = new Map();
const ANI_CACHE_TTL = 3 * 3600 * 1000; // 3 hours

export async function getAniListData(title) {
  if (!title) return null;

  const cacheKey = title.toString().toLowerCase().trim();
  if (aniListCache.has(cacheKey)) {
    const cached = aniListCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ANI_CACHE_TTL) {
      return cached.data;
    }
  }

  const query = `
    query ($search: String, $id: Int) {
      Media (search: $search, id: $id, type: ANIME) {
        id
        title {
          romaji
          english
        }
        averageScore
        bannerImage
        coverImage {
          extraLarge
          large
        }
        genres
        description(asHtml: false)
        episodes
        status
        format
        startDate { year month day }
        endDate { year month day }
        studios {
          nodes {
            name
          }
        }
      }
    }
  `;

  try {
    const isId = /^\d+$/.test(title);
    const variables = isId ? { id: parseInt(title) } : { search: title };

    // Fast single request with 1.8s timeout, no retry loops
    const response = await axios.post('https://graphql.anilist.co', {
      query,
      variables
    }, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 1800
    });

    const media = response.data?.data?.Media;
    if (!media) return null;

    const studio = media.studios && media.studios.nodes && media.studios.nodes.length > 0 ? media.studios.nodes[0].name : null;

    const formatDate = (date) => {
      if (!date || !date.year) return null;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[date.month-1] || ''} ${date.day || ''}, ${date.year}`;
    };

    const result = {
      anilistId: media.id,
      title: media.title.romaji || media.title.english,
      romajiTitle: media.title.romaji,
      englishTitle: media.title.english,
      rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
      banner: media.bannerImage,
      poster: media.coverImage?.extraLarge || media.coverImage?.large,
      genres: media.genres || [],
      totalEpisodes: media.episodes,
      status: media.status,
      format: media.format,
      startDate: formatDate(media.startDate),
      endDate: formatDate(media.endDate),
      relatedAnime: [],
      description: media.description ? media.description.replace(/<[^>]+>/g, '') : null,
      studio: studio
    };

    aniListCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    return result;
  } catch (error) {
    // Non-blocking failover
    return null;
  }
}

function extractParentAnimeSlug(inputUrl) {
  if (!inputUrl) return '';
  return decodeURIComponent(inputUrl)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-eps-\d+.*$/i, '')
    .replace(/-ep-\d+.*$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function extractWatchSlug(inputUrl) {
  if (!inputUrl) return '';
  return decodeURIComponent(inputUrl)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\/+|\/+$/g, '');
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

  // Search queries to attempt in order
  const queries = [clean, title];
  const words = clean.split(' ').filter(Boolean);
  if (words.length > 3) {
    queries.push(words.slice(0, 4).join(' '));
    queries.push(words.slice(0, 3).join(' '));
  }
  const uniqueQueries = [...new Set(queries.filter(q => q && q.length >= 2))];

  // 1. Try Kitsu API across unique queries (fast & reliable)
  for (const q of uniqueQueries) {
    try {
      const res = await axiosGetFast(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=1`, {
        headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' }
      }, 2500);
      const anime = res.data?.data?.[0]?.attributes;
      const poster = anime?.posterImage?.large || anime?.posterImage?.medium || anime?.posterImage?.original;
      if (poster) {
        posterCache.set(cacheKey, poster);
        return poster;
      }
    } catch (e) {}
  }

  // 2. Try Jikan API across unique queries
  for (const q of uniqueQueries) {
    try {
      const res = await axiosGetFast(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1`, {}, 2500);
      const anime = res.data?.data?.[0];
      const poster = anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url;
      if (poster) {
        posterCache.set(cacheKey, poster);
        return poster;
      }
    } catch (e) {}
  }

  return fallbackImage || '/placeholder.jpg';
}

async function scrapeSamehadakuHtml(html) {
  const $ = cheerio.load(html);
  const rawUpdates = [];
  const seenUrls = new Set();

  $('a[href*="/nonton/"]').each((i, el) => {
    const $el = $(el);
    const originalUrl = $el.attr('href');
    if (!originalUrl || seenUrls.has(originalUrl)) return;
    seenUrls.add(originalUrl);

    const fullText = $el.text().replace(/\s+/g, ' ').trim();
    const cleanName = $el.find('h3').text().trim() || fullText.split(' Episode ')[0] || fullText;

    let image = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    if (image.includes('placeholder.svg')) image = '';

    let episode = 'Ongoing';
    const epMatch = $el.find('p:contains("Episode") b').text().trim() || fullText.match(/Episode\s*(\d+)/i)?.[1];
    if (epMatch) episode = epMatch;

    const postedBy = $el.find('p:contains("Posted by") b').text().trim() || 'Admin';
    const released = $el.find('p:contains("Released on") b, time').first().text().trim() || 'Baru Saja';

    rawUpdates.push({
      title: cleanName,
      rawTitle: fullText,
      url: getRelativeUrl(originalUrl),
      image: image || '/placeholder.jpg',
      episode: `Episode ${episode}`,
      score: '8.5',
      released,
      postedBy
    });
  });

  const updates = await Promise.all(rawUpdates.map(async (item) => {
    let finalImage = item.image;
    if (!finalImage || finalImage.includes('placeholder')) {
      finalImage = await getAnimePoster(item.title, item.image);
    }
    return {
      ...item,
      image: finalImage
    };
  }));

  return updates;
}

export async function animeterbaru(page = 1) {
  try {
    const path = page > 1 ? `page/${page}/` : '';
    const res = await fetchSamehadakuWithMirror(path);
    const updates = await scrapeSamehadakuHtml(res.data);
    if (updates && updates.length > 0) {
      return updates;
    }
  } catch (error) {
    console.error("scraper.js: animeterbaru error:", error?.message || error);
  }
  return [];
}

export async function search(query) {
  if (!query || query.trim() === '') return [];
  const searchPath = `?s=${encodeURIComponent(query.trim())}`;

  try {
    const res = await fetchSamehadakuWithMirror(searchPath);
    const $ = cheerio.load(res.data);
    const rawResults = [];
    const seenUrls = new Set();

    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href || href.includes('anime-list') || seenUrls.has(href)) return;
      if (!href.includes('/anime/')) return;
      seenUrls.add(href);

      const title = $el.find('.j').text().trim() || $el.find('.sh-nm').text().trim() || $el.attr('title') || $el.find('img').attr('alt') || '';
      if (!title) return;

      let image = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      if (image.includes('placeholder.svg')) image = '';

      const eps = $el.find('.jarvis-eps').text().trim() || 'Ongoing';
      const score = $el.find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

      rawResults.push({
        title,
        image: image || '/placeholder.jpg',
        type: 'TV',
        status: eps.toLowerCase().includes('tamat') ? 'Completed' : 'Ongoing',
        score,
        episode: eps,
        url: getRelativeUrl(href)
      });
    });

    const results = await Promise.all(rawResults.map(async (item) => {
      let finalImage = item.image;
      if (!finalImage || finalImage.includes('placeholder')) {
        finalImage = await getAnimePoster(item.title, item.image);
      }
      return {
        ...item,
        image: finalImage
      };
    }));

    return results;
  } catch (error) {
    console.error("scraper.js: search error:", error?.message || error);
    return [];
  }
}

export async function detail(link) {
  if (!link) return null;
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
        const res = await fetchSamehadakuWithMirror(bestUrl);
        if (res && res.data) {
          htmlData = res.data;
        }
      }
    } catch (searchErr) {
      console.error("scraper.js: detail search fallback error:", searchErr?.message);
    }
  }

  if (!htmlData) return null;

  try {
    const $ = cheerio.load(htmlData);
    const title = $('.sh-kolom h1, .sh-judul, .entry-title').first().text().trim() || $('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim();
    let image = $('.sh-det-po img, .sh-kolom img').first().attr('src') || '';
    if (image.includes('placeholder.svg')) image = '';

    if (!image || image.includes('placeholder')) {
      image = await getAnimePoster(title, image);
    }

    const description = $('.sh-sin').text().trim() || $('.kk-seotext').text().trim() || $('meta[name="description"]').attr('content') || 'Nonton streaming anime subtitle Indonesia di ZUNIME.';

    const episodes = [];
    const seenEpUrls = new Set();
    $('.sh-daftar-grid a, .sh-pan a, a[href*="/nonton/"]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href || seenEpUrls.has(href) || !href.includes('/nonton/')) return;
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
  } catch (parseError) {
    console.error("scraper.js: detail parse error:", parseError?.message);
    return null;
  }
}

export async function download(link) {
  if (!link) return null;
  const watchSlug = extractWatchSlug(link);
  const targetPath = `nonton/${watchSlug}/`;

  try {
    const res = await fetchSamehadakuWithMirror(targetPath);
    const $ = cheerio.load(res.data);

    const title = $('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim() || watchSlug.replace(/-/g, ' ');
    const iframes = $('iframe').map((i, el) => $(el).attr('src') || $(el).attr('data-src')).get().filter(Boolean);

    const streams = [];
    iframes.forEach((src, idx) => {
      let serverName = `Server HD ${idx + 1}`;
      if (src.includes('putarin')) serverName = `Putarin HD ${idx + 1}`;
      else if (src.includes('cdnhls') || src.includes('hls')) serverName = `HLS Player ${idx + 1}`;
      else if (src.includes('mogo') || src.includes('playmogo')) serverName = `Mogo ${idx + 1}`;

      streams.push({
        server: serverName,
        url: src
      });
    });

    return {
      title,
      streams
    };
  } catch (error) {
    console.error("scraper.js: download/watch error:", error?.message || error);
    return null;
  }
}

export async function schedule() {
  try {
    const res = await fetchSamehadakuWithMirror('ongoing/');
    const $ = cheerio.load(res.data);
    const rawItems = [];

    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href || !href.includes('/anime/')) return;
      const title = $el.find('.j').text().trim() || $el.find('.sh-nm').text().trim() || '';
      let image = $el.find('img').attr('src') || '';
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

    const ongoingItems = await Promise.all(rawItems.map(async (item) => {
      let finalImage = item.image;
      if (!finalImage || finalImage.includes('placeholder')) {
        finalImage = await getAnimePoster(item.title, item.image);
      }
      return {
        ...item,
        image: finalImage
      };
    }));

    return ongoingItems;
  } catch (error) {
    console.error("scraper.js: schedule error:", error?.message || error);
    return [];
  }
}

export { cleanTitle, extractParentAnimeSlug, extractWatchSlug };
