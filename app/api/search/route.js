import { NextResponse } from 'next/server';
import { search, getAniListData, cleanTitle, getSimilarity } from '@/lib/scraper';
import dns from 'dns';
import https from 'https';
import axios from 'axios';
import * as cheerio from 'cheerio';

const dnsCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) {
    return dnsCache.get(hostname);
  }
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
    } catch (err) {
      console.warn(`[DoH Warning] Failed resolving ${hostname} via ${dnsIp}:`, err.message);
    }
  }
  return null;
}

async function axiosGetRetry(url, config = {}, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, config);
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.includes('timeout') || err.message.includes('Network Error') || err.response?.status === 503;
      if (isRetryable && i < retries - 1) {
        console.warn(`[Network Retry] GET ${url} failed (${err.code || err.message}). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('nekopoi.care') || hostname.includes('nekopoi.org')) {
    resolveDnsDoH(hostname).then(ip => {
      if (ip) {
        if (options.all) {
          callback(null, [{ address: ip, family: 4 }]);
        } else {
          callback(null, ip, 4);
        }
      } else {
        callback(new Error(`ENOENT: DoH resolution failed for ${hostname}`), null, null);
      }
    }).catch(err => {
      callback(err, null, null);
    });
    return;
  }
  return dns.lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

function getNekopoiUrlForGenre(genre, page = 1) {
  const g = genre.toLowerCase().trim();
  let path = '';
  if (g === 'hentai') {
    path = 'category/hentai';
  } else if (g === '3d hentai' || g === '3d') {
    path = 'category/3d-hentai';
  } else if (g === 'cosplay hentai' || g === 'cosplay') {
    path = 'category/cosplay-hentai';
  } else if (g === 'jav') {
    path = 'category/jav';
  } else if (g === 'jav cosplay') {
    path = 'category/jav-cosplay';
  } else {
    // Treat as tag: /tag/genre-name
    const slug = g.replace(/\s+/g, '-');
    path = `tag/${slug}`;
  }
  
  return page > 1 
    ? `https://nekopoi.care/${path}/page/${page}/`
    : `https://nekopoi.care/${path}/`;
}

async function scrapeNekopoiGenre(genre, page = 1) {
  const url = getNekopoiUrlForGenre(genre, page);
  console.log(`[Nekopoi Scraper] Fetching category page: ${url}`);
  
  const res = await axiosGetRetry(url, {
    httpsAgent: dohAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    timeout: 8000
  });

  const $ = cheerio.load(res.data);
  const items = [];

  $('a.nk-search-item').each((i, el) => {
    const href = $(el).attr('href') || '';
    const title = $(el).find('h2').text().trim();
    const synopsis = $(el).find('p').text().trim();
    
    // Parse background-image URL
    const styleAttr = $(el).find('.nk-search-thumb').attr('style') || '';
    const imgMatch = styleAttr.match(/url\(['"]?([^'"]+)['"]?\)/);
    let image = imgMatch ? imgMatch[1] : '/Zunime.png';
    if (image && image.startsWith('http')) {
      image = `/api/image-proxy?url=${encodeURIComponent(image)}`;
    }

    const slug = href.replace(/\/$/, '').split('/').pop();

    if (slug && title) {
      items.push({
        title,
        altTitle: 'Hentai',
        url: `/anime/hentai-${slug}/`,
        image,
        banner: image,
        score: '9.0',
        episode: 'Recent',
        status: 'Recent',
        type: 'Hentai',
        genres: ['Hentai', genre],
        synopsis: synopsis || `Nonton anime hentai ${title} sub indo gratis hanya di ZUNIME.`
      });
    }
  });

  return items;
}

// Simple in-memory cache
const searchCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const genre = searchParams.get('genre');

  // Genre Filter Route
  if (genre) {
    const HENTAI_GENRES = [
      'hentai', '3d hentai', '3d', 'cosplay hentai', 'cosplay', 'milf', 'netorare', 'ntr', 
      'incest', 'oppai', 'school girls', 'loli', 'yuri', 'creampie', 'masturbation', 
      'blowjob', 'bdsm', 'tentacles', 'cheating', 'uncensored', 'jav', 'jav cosplay'
    ];
    const isHentai = HENTAI_GENRES.includes(genre.toLowerCase().trim());
    const cacheKey = `genre-${genre.toLowerCase()}`;
    
    // Check Cache
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({ success: true, data: cached.data });
      }
    }

    // Nekopoi Scraper for Hentai Genre
    if (isHentai) {
      try {
        console.log(`[Nekopoi Scraper] Querying live Hentai sub-genre "${genre}" listing...`);
        const results = await Promise.all([
          scrapeNekopoiGenre(genre, 1).catch(() => []),
          scrapeNekopoiGenre(genre, 2).catch(() => []),
          scrapeNekopoiGenre(genre, 3).catch(() => [])
        ]);
        const mappedList = [...results[0], ...results[1], ...results[2]];
        
        if (mappedList && mappedList.length > 0) {
          searchCache.set(cacheKey, {
            timestamp: Date.now(),
            data: mappedList
          });
          return NextResponse.json({ success: true, data: mappedList });
        }
      } catch (nekopoiErr) {
        console.error("Nekopoi category scraper failed:", nekopoiErr.message);
      }

      const gClean = genre.toLowerCase().trim();
      if (gClean === 'jav' || gClean === 'jav cosplay') {
        return NextResponse.json({ success: true, data: [] });
      }

      // Fallback: AniList Hentai Query if Nekopoi fails
      try {
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query ($genre: String) {
                Page(page: 1, perPage: 80) {
                  media(genre: $genre, type: ANIME, isAdult: true, sort: POPULARITY_DESC) {
                    id
                    title { romaji english }
                    coverImage { extraLarge large }
                    bannerImage
                    averageScore
                    episodes
                    status
                    format
                    genres
                    description
                  }
                }
              }
            `,
            variables: { genre: 'Hentai' }
          })
        });

        if (response.ok) {
          const json = await response.json();
          const mediaList = json?.data?.Page?.media || [];
          const mappedList = mediaList.map(m => {
            const romaji = m.title?.romaji || '';
            const english = m.title?.english || '';
            const fallbackTitle = romaji || english || 'Unknown';
            const url = `/anime/${m.id}/`;
            return {
              title: fallbackTitle,
              altTitle: english && english !== romaji ? english : null,
              url: url,
              image: m.coverImage?.extraLarge || m.coverImage?.large,
              banner: m.bannerImage,
              score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
              episode: m.episodes ? m.episodes.toString() : (m.status === 'RELEASING' ? 'Ongoing' : 'Tamat'),
              status: m.status === 'RELEASING' ? 'Ongoing' : (m.status === 'FINISHED' ? 'Completed' : m.status),
              type: m.format || 'TV',
              genres: m.genres || [],
              synopsis: m.description ? m.description.replace(/<[^>]*>/g, '') : null
            };
          });

          searchCache.set(cacheKey, {
            timestamp: Date.now(),
            data: mappedList
          });

          return NextResponse.json({ success: true, data: mappedList });
        }
      } catch (err) {
        console.error("AniList Hentai fallback error:", err);
      }
      return NextResponse.json({ success: true, data: [] });
    }

    // Normal Genres: AniList GraphQL query (omitting isAdult argument entirely to avoid any null match issues!)
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query ($genre: String) {
              Page(page: 1, perPage: 80) {
                media(genre: $genre, type: ANIME, sort: POPULARITY_DESC) {
                  id
                  title { romaji english }
                  coverImage { extraLarge large }
                  bannerImage
                  averageScore
                  episodes
                  status
                  format
                  genres
                  description
                }
              }
            }
          `,
          variables: { genre }
        })
      });

      if (!response.ok) {
        return NextResponse.json({ success: true, data: [] });
      }

      const json = await response.json();
      const mediaList = json?.data?.Page?.media || [];

      const mappedList = mediaList.map(m => {
        const romaji = m.title?.romaji || '';
        const english = m.title?.english || '';
        const fallbackTitle = romaji || english || 'Unknown';
        
        const urlFriendlyTitle = (romaji || english || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const url = `/anime/${m.id}/`;

        return {
          title: fallbackTitle,
          altTitle: english && english !== romaji ? english : null,
          url: url,
          image: m.coverImage?.extraLarge || m.coverImage?.large,
          banner: m.bannerImage,
          score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
          episode: m.episodes ? m.episodes.toString() : (m.status === 'RELEASING' ? 'Ongoing' : 'Tamat'),
          status: m.status === 'RELEASING' ? 'Ongoing' : (m.status === 'FINISHED' ? 'Completed' : m.status),
          type: m.format || 'TV',
          genres: m.genres || [],
          synopsis: m.description ? m.description.replace(/<[^>]*>/g, '') : null
        };
      });

      searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: mappedList
      });

      return NextResponse.json({ success: true, data: mappedList });
    } catch (err) {
      console.error("Genre search API error:", err);
      return NextResponse.json({ success: false, data: [] });
    }
  }

  // 1. VALIDATION
  if (!q || q.trim() === "") {
    return NextResponse.json({
      success: false,
      data: [],
      error: "Query parameter 'q' or 'genre' is required"
    }, { status: 400 });
  }

  const query = q.trim().toLowerCase();

  // 2. CHECK CACHE
  if (searchCache.has(query)) {
    const cached = searchCache.get(query);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("CACHE HIT:", query);
      return NextResponse.json({ success: true, data: cached.data });
    }
  }

  try {
    console.log("QUERY SEARCH:", query);

    // 3. PARALLEL FETCH (Samehadaku Search + AniList API)
    const [samehadakuResults, aniListResults] = await Promise.all([
      search(query).catch(e => {
        console.error("Samehadaku search error:", e);
        return [];
      }),
      fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query ($search: String) {
              Page(page: 1, perPage: 15) {
                media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                  id
                  title { romaji english }
                  coverImage { extraLarge large }
                  bannerImage
                  averageScore
                  episodes
                  status
                  format
                  genres
                }
              }
            }
          `,
          variables: { search: query }
        })
      })
      .then(async r => {
        if (!r.ok) return [];
        const json = await r.json();
        return json?.data?.Page?.media || [];
      })
      .catch(e => {
        console.error("AniList search error:", e);
        return [];
      })
    ]);

    // 4. MAP ANILIST DATA
    const mappedAniList = aniListResults.map(m => {
      const romaji = m.title?.romaji || '';
      const english = m.title?.english || '';
      const fallbackTitle = romaji || english || 'Unknown';
      
      // Clean slug format
      const urlFriendlyTitle = (romaji || english || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const url = `/anime/${urlFriendlyTitle}-sub-indo/`;

      return {
        title: fallbackTitle,
        altTitle: english && english !== romaji ? english : null,
        url: url,
        image: m.coverImage?.extraLarge || m.coverImage?.large,
        banner: m.bannerImage,
        score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
        episode: m.episodes ? m.episodes.toString() : (m.status === 'RELEASING' ? 'Ongoing' : 'Tamat'),
        status: m.status === 'RELEASING' ? 'Ongoing' : (m.status === 'FINISHED' ? 'Completed' : m.status),
        type: m.format || 'TV',
        genres: m.genres || []
      };
    });

    // 5. PRIORITIZE SAMEHADAKU & DEDUPLICATE ANILIST FALLBACKS
    const mergedList = [...samehadakuResults];

    for (const aniItem of mappedAniList) {
      const isDuplicate = samehadakuResults.some(sameItem => {
        const titleSim = getSimilarity(sameItem.title, aniItem.title);
        const altTitleSim = aniItem.altTitle ? getSimilarity(sameItem.title, aniItem.altTitle) : 0;
        return titleSim > 0.75 || altTitleSim > 0.75;
      });

      if (!isDuplicate) {
        mergedList.push(aniItem);
      }
    }

    // 6. SAVE TO CACHE
    searchCache.set(query, {
      timestamp: Date.now(),
      data: mergedList
    });

    return NextResponse.json({ success: true, data: mergedList });
  } catch (error) {
    console.error("SEARCH API ERROR:", error);
    return NextResponse.json({ success: false, data: [], message: error?.message || "Search failed" }, { status: 200 });
  }
}
