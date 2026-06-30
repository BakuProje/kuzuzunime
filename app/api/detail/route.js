import { NextResponse } from 'next/server';
import { detail, getAniListData, cleanTitle, search, getSimilarity } from '@/lib/scraper';
import dns from 'dns';
import https from 'https';
import axios from 'axios';
import * as cheerio from 'cheerio';

const dnsCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) {
    return dnsCache.get(hostname);
  }
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get(`https://8.8.8.8/resolve?name=${hostname}&type=A`, {
      httpsAgent: agent,
      headers: { 'Host': 'dns.google' },
      timeout: 3000
    });
    if (res.data && res.data.Answer) {
      const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
      if (ips.length > 0) {
        dnsCache.set(hostname, ips[0]);
        return ips[0];
      }
    }
  } catch (err) {
    console.error(`[DoH Error] Failed resolving ${hostname}:`, err.message);
  }
  return null;
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

async function scrapeNekopoiDetail(slug) {
  const cleanSlug = slug.replace(/^hentai-/i, '').replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
  
  // Try fetching with clean slug first, then fall back to search
  let res = null;
  const directUrl = `https://nekopoi.care/${cleanSlug}/`;
  console.log(`[Nekopoi Detail Scraper] Fetching post details: ${directUrl}`);
  
  try {
    res = await axios.get(directUrl, {
      httpsAgent: dohAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
  } catch (directErr) {
    // If direct URL fails, try searching on nekopoi
    console.warn(`[Nekopoi Detail Scraper] Direct URL failed, trying search: ${directErr.message}`);
    const searchName = cleanSlug.replace(/-episode-\d+.*$/i, '').replace(/-subtitle-indonesia.*$/i, '').replace(/-/g, ' ').trim();
    try {
      const searchRes = await axios.get(`https://nekopoi.care/?s=${encodeURIComponent(searchName)}&post_type=post`, {
        httpsAgent: dohAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        timeout: 8000
      });
      const $s = cheerio.load(searchRes.data);
      let postUrl = null;
      $s('.result-post a, .post-box-title a, article a, .entry-title a, h2 a').each((i, el) => {
        if (postUrl) return;
        const href = $s(el).attr('href') || '';
        if (href.includes('nekopoi.care') && !href.includes('/category/') && !href.includes('/tag/') && !href.includes('/page/')) {
          postUrl = href;
        }
      });
      if (postUrl) {
        console.log(`[Nekopoi Detail Scraper] Found post via search: ${postUrl}`);
        res = await axios.get(postUrl, {
          httpsAgent: dohAgent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
          },
          timeout: 8000
        });
      }
    } catch (searchErr) {
      console.error(`[Nekopoi Detail Scraper] Search fallback failed:`, searchErr.message);
    }
  }

  if (!res || !res.data) {
    return null;
  }

  const $ = cheerio.load(res.data);
  const title = $('title').text().trim().split(' Subtitle ')[0].replace(/ – NekoPoi$/, '');
  
  // Find cover image - try multiple selectors for different post types (Hentai vs JAV)
  let image = '/Zunime.png';
  
  // Method 1: Player series thumb background style
  const styleAttr = $('.nk-player-series-thumb').attr('style') || '';
  const imgMatch = styleAttr.match(/url\(['"]?([^'")\s]+)['"]?\)/);
  if (imgMatch && imgMatch[1]) {
    image = imgMatch[1];
  }
  
  // Method 2: Thumbnail/featured image
  if (image === '/Zunime.png') {
    const thumbEl = $('.thumbnail img, .post-thumbnail img, .wp-post-image, .attachment-post-thumbnail').first();
    if (thumbEl.length > 0) {
      image = thumbEl.attr('src') || thumbEl.attr('data-src') || thumbEl.attr('data-lazy-src') || image;
    }
  }
  
  // Method 3: OG image meta tag
  if (image === '/Zunime.png') {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      image = ogImage;
    }
  }
  
  // Method 4: First image in .content or entry-content
  if (image === '/Zunime.png') {
    const contentImg = $('.content img, .entry-content img, article img').first();
    if (contentImg.length > 0) {
      image = contentImg.attr('src') || contentImg.attr('data-src') || image;
    }
  }

  if (image && image.startsWith('http')) {
    image = `/api/image-proxy?url=${encodeURIComponent(image)}`;
  }

  const description = $('.sinopsis').text().trim() || $('.excerpt p').first().text().trim() || $('meta[property="og:description"]').attr('content') || 'Nonton anime hentai sub indo gratis.';
  
  const info = {
    genre: 'Hentai',
    status: 'FINISHED',
    studio: 'Unknown',
    skor: '9.0'
  };

  const episodes = [{
    title: 'Episode 1',
    url: `/watch/hentai-${cleanSlug}/`,
    date: 'Terbaru'
  }];

  return {
    title,
    image,
    description,
    episodes,
    info,
    genres: ['Hentai'],
    totalEpisodes: 1,
    status: 'FINISHED',
    relatedAnime: []
  };
}

// Extract a readable title from the slug URL
function titleFromSlug(slug) {
  // e.g. "one-piece-episode-1-sub-indo" → "One Piece"
  const cleaned = slug
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .pop()
    .replace(/^hentai-/i, '') // Strip hentai- prefix
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/-batch.*$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return cleaned;
}

// Extract a simplified core title to assist search on Samehadaku
function extractCoreTitle(title) {
  if (!title) return '';
  let core = title.split(':')[0].split(' - ')[0].split('(')[0];
  core = core
    .replace(/(?:Season\s*\d+|2nd\s*Season|3rd\s*Season|\d+(?:st|nd|rd|th)?\s*Season)/gi, '')
    .replace(/S\d+/gi, '')
    .replace(/Part\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return core;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, message: 'Query parameter "url" is required' }, { status: 400 });
  }

  try {
    let samehadakuUrl = url;
    const cleanSlug = url.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
    let isNekopoi = cleanSlug.startsWith('hentai-');
    let nekopoiId = isNekopoi ? cleanSlug.replace('hentai-', '') : null;

    // Check if url contains a numeric AniList ID
    if (/^\d+$/.test(cleanSlug)) {
      console.log("Detail URL contains an AniList ID:", cleanSlug);
      try {
        const aniDataForId = await getAniListData(cleanSlug);
        if (aniDataForId) {
          const romaji = aniDataForId.romajiTitle;
          const english = aniDataForId.englishTitle;
          const isHentai = aniDataForId.genres?.includes('Hentai');
          
          if (isHentai) {
            console.log(`Mapping AniList Hentai ID: "${cleanSlug}" via AniList metadata (Nekopoi scraper bypassed).`);
          } else {
            // Normal anime mapping
            if (romaji || english) {
              console.log(`Searching Samehadaku for AniList ID titles. Romaji: "${romaji}", English: "${english}"`);
              
              const searchTerms = [];
              if (romaji) {
                searchTerms.push(romaji);
                const coreRomaji = extractCoreTitle(romaji);
                if (coreRomaji && coreRomaji !== romaji) searchTerms.push(coreRomaji);
              }
              if (english) {
                searchTerms.push(english);
                const coreEnglish = extractCoreTitle(english);
                if (coreEnglish && coreEnglish !== english) searchTerms.push(coreEnglish);
              }
              
              const uniqueTerms = Array.from(new Set(searchTerms.filter(t => t && t.length >= 3))).slice(0, 3);
              const searchPromises = uniqueTerms.map(term => search(term).catch(() => []));
              const resultsArrays = await Promise.all(searchPromises);
              
              const searchResults = [];
              const seenUrls = new Set();
              for (const arr of resultsArrays) {
                if (arr) {
                  for (const item of arr) {
                    if (!seenUrls.has(item.url)) {
                      seenUrls.add(item.url);
                      searchResults.push(item);
                    }
                  }
                }
              }
              
              if (searchResults.length > 0) {
                let bestMatch = null;
                let bestScore = 0;
                for (const item of searchResults) {
                  const scoreRomaji = romaji ? getSimilarity(romaji, item.title) : 0;
                  const scoreEnglish = english ? getSimilarity(english, item.title) : 0;
                  const score = Math.max(scoreRomaji, scoreEnglish);
                  
                  if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                  }
                }
                if (bestMatch && bestScore >= 0.45) {
                  samehadakuUrl = bestMatch.url;
                  console.log(`Mapped AniList ID to Samehadaku URL: ${samehadakuUrl} (Score: ${bestScore})`);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to map AniList ID:", err);
      }
    }    // Check if it is a Nekopoi Hentai ID - bypassed as Nekopoi API is offline
    if (isNekopoi && nekopoiId) {
      console.log("Nekopoi direct detail scrape bypassed for:", nekopoiId);
    }

    // Try to get detail from Samehadaku (or Nekopoi if Hentai)
    let data = null;
    if (isNekopoi) {
      try {
        const nekopoiData = await scrapeNekopoiDetail(cleanSlug);
        if (nekopoiData) {
          data = nekopoiData;
        }
      } catch (nekopoiErr) {
        console.error("Nekopoi details scrape failed:", nekopoiErr.message);
      }
    }
    try {
      if ((samehadakuUrl.startsWith('/anime/') || samehadakuUrl.startsWith('http')) && !isNekopoi) {
        const unmatchedSlug = samehadakuUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
        // Discard if the slug is still a raw numeric ID (mapping failed) to prevent invalid API calls
        if (!/^\d+$/.test(unmatchedSlug) && !unmatchedSlug.startsWith('hentai-')) {
          const detailData = await detail(samehadakuUrl);
          // Verify returned data actually contains a title (prevent success:true with empty fields)
          if (detailData && detailData.title && detailData.title.trim() !== '') {
            data = detailData;
          }
        }
      }
    } catch (e) {
      console.error('Samehadaku detail failed:', e?.message || e);
    }

    // Determine the title for AniList lookup
    const lookupSlug = samehadakuUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
    const title = data?.title || ( /^\d+$/.test(lookupSlug) ? lookupSlug : titleFromSlug(samehadakuUrl) );
    
    let aniData = null;
    try {
      const urlSlug = url.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
      const aniLookupKey = /^\d+$/.test(urlSlug) ? urlSlug : cleanTitle(title);
      aniData = await getAniListData(aniLookupKey);
    } catch (e) {
      console.error('AniList lookup failed:', e?.message || e);
    }
    
    // If both sources failed, return an error
    if (!data && !aniData) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unable to fetch anime details. The source API may be temporarily unavailable.' 
      }, { status: 503 });
    }

    // Build result - use data as base if available, otherwise create from AniList
    let result;
    if (data) {
      result = { ...data };
      if (aniData) {
        // Determine the best cover image: prefer Nekopoi proxied cover for adult content,
        // otherwise use AniList poster if available
        const nekopoiHasRealImage = data.image && data.image !== '/Zunime.png' && data.image !== '/placeholder.jpg';
        const bestImage = nekopoiHasRealImage ? data.image : (aniData.poster || data.image);

        result = {
          ...data,
          rating: aniData.rating || data.info?.skor || '8.5',
          banner: aniData.banner,
          genres: aniData.genres || data.genres || [],
          totalEpisodes: aniData.totalEpisodes || data.totalEpisodes,
          relatedAnime: aniData.relatedAnime || [],
          studio: aniData.studio || data.info?.studio || 'Unknown',
          status: aniData.status,
          format: aniData.format,
          startDate: aniData.startDate,
          endDate: aniData.endDate,
          image: bestImage
        };

        // If Nekopoi scraper returned only 1 episode but AniList says there are more,
        // regenerate the full episode list so multi-episode Hentai series show all episodes
        const aniTotalEp = aniData.totalEpisodes || 0;
        if (data.episodes && data.episodes.length <= 1 && aniTotalEp > 1 && aniData.genres?.includes('Hentai')) {
          const cleanName = (aniData.title || data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const generatedEpisodes = [];
          for (let i = 1; i <= aniTotalEp; i++) {
            generatedEpisodes.push({
              title: `Episode ${i}`,
              url: `/watch/hentai-${cleanName}-episode-${i}/`,
              date: 'Terbaru'
            });
          }
          result.episodes = generatedEpisodes;
        }
      } else {
        result.relatedAnime = [];
      }
    } else {
      // AniList-only fallback (Samehadaku is completely down)
      const generatedEpisodes = [];
      if (aniData && aniData.genres?.includes('Hentai')) {
        const totalEp = aniData.totalEpisodes || 12;
        const cleanName = (aniData.title || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        for (let i = 1; i <= totalEp; i++) {
          generatedEpisodes.push({
            title: `Episode ${i}`,
            url: `/watch/hentai-${cleanName}-episode-${i}/`,
            date: 'Terbaru'
          });
        }
      }

      result = {
        title: aniData.title || title,
        image: aniData.poster,
        banner: aniData.banner,
        rating: aniData.rating || '8.5',
        genres: aniData.genres || [],
        totalEpisodes: aniData.totalEpisodes,
        relatedAnime: aniData.relatedAnime || [],
        studio: aniData.studio || 'Unknown',
        status: aniData.status,
        format: aniData.format,
        startDate: aniData.startDate,
        endDate: aniData.endDate,
        description: aniData.description || null,
        episodes: generatedEpisodes,
        info: {
          genre: (aniData.genres || []).join(', '),
          status: aniData.status === 'RELEASING' ? 'Ongoing' : (aniData.status === 'FINISHED' ? 'Completed' : aniData.status),
          studio: aniData.studio || 'Unknown',
          skor: aniData.rating || '8.5'
        },
        synopsis: aniData.description || 'Tidak ada deskripsi tersedia.'
      };
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('Error in /api/detail:', e?.message || e);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
