import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

export function getSimilarity(str1, str2) {
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


async function hasSamehadakuMapping(romaji, english) {
  try {
    const searchPromises = [];
    if (romaji) searchPromises.push(search(romaji));
    if (english) searchPromises.push(search(english));
    
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
      let bestScore = 0;
      for (const item of searchResults) {
        const scoreRomaji = romaji ? getSimilarity(romaji, item.title) : 0;
        const scoreEnglish = english ? getSimilarity(english, item.title) : 0;
        const score = Math.max(scoreRomaji, scoreEnglish);
        if (score > bestScore) {
          bestScore = score;
        }
      }
      if (bestScore < 0.45) {
        return false; // Validly returned search results, but none matched the title
      }
    } else {
      return false; // Search succeeded but returned zero matches
    }
  } catch (e) {
    return true; // Keep candidate if network or API request failed to prevent clearing during glitches
  }
  return true;
}

export async function getAniListData(title) {
  if (!title) return null;

  const cacheKey = title.toString().toLowerCase().trim();
  if (aniListCache.has(cacheKey)) {
    const cached = aniListCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ANI_CACHE_TTL) {
      console.log("AniList Cache Hit for:", cacheKey);
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
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              averageScore
              episodes
              status
            }
          }
        }
      }
    }
  `;

  try {
    let media = null;
    const isId = /^\d+$/.test(title);
    const variables = isId ? { id: parseInt(title) } : { search: title };
    try {
      const response = await axios.post('https://graphql.anilist.co', {
        query,
        variables
      });
      media = response.data?.data?.Media;
    } catch (error) {
      // If not found or error, media remains null
    }

  // Fallback: If not found, and title contains season indicators, try stripping them
  if (!media) {
    const fallbackTitle = title
      .replace(/Season\s*\d+/gi, '')
      .replace(/S\d+/gi, '')
      .replace(/Part\s*\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (fallbackTitle !== title) {
      try {
        const response = await axios.post('https://graphql.anilist.co', {
          query,
          variables: { search: fallbackTitle }
        });
        media = response.data?.data?.Media;
      } catch (error) {
        // Fallback failed too
      }
    }
  }

  if (!media) return null;

    let relatedAnime = [];
    if (media.relations && media.relations.edges) {
      const candidates = media.relations.edges
        .filter(edge => edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL' || edge.relationType === 'PARENT' || edge.relationType === 'SIDE_STORY' || edge.relationType === 'ALTERNATIVE')
        .map(edge => ({
          id: edge.node.id,
          title: edge.node.title.romaji || edge.node.title.english,
          romajiTitle: edge.node.title.romaji,
          englishTitle: edge.node.title.english,
          image: edge.node.coverImage?.large,
          rating: edge.node.averageScore ? (edge.node.averageScore / 10).toFixed(1) : null,
          episodes: edge.node.episodes,
          status: edge.node.status,
          relationType: edge.relationType
        }))
        .filter(item => item.status !== 'NOT_YET_RELEASED');

      // Filter candidates by Samehadaku mapping in parallel
      const mappedResults = await Promise.all(
        candidates.map(async (item) => {
          const isValid = await hasSamehadakuMapping(item.romajiTitle, item.englishTitle);
          if (isValid) {
            return {
              id: item.id,
              title: item.title,
              image: item.image,
              rating: item.rating,
              episodes: item.episodes,
              relationType: item.relationType
            };
          }
          return null;
        })
      );
      relatedAnime = mappedResults.filter(Boolean);
    }

    // Supplement search fallback: if we have fewer than 5 related items, fetch similarly named anime
    if (relatedAnime.length < 5) {
      const baseSearch = title
        .replace(/Season\s*\d+/gi, '')
        .replace(/\d+(?:st|nd|rd|th)?\s*Season/gi, '')
        .replace(/S\d+/gi, '')
        .replace(/Part\s*\d+/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (baseSearch && baseSearch.length >= 3) {
        try {
          const searchQuery = `
            query ($search: String) {
              Page (page: 1, perPage: 12) {
                media (search: $search, type: ANIME) {
                  id
                  title {
                    romaji
                    english
                  }
                  coverImage {
                    large
                  }
                  averageScore
                  episodes
                  status
                }
              }
            }
          `;
          const response = await axios.post('https://graphql.anilist.co', {
            query: searchQuery,
            variables: { search: baseSearch }
          });
          const searchResults = response.data?.data?.Page?.media || [];

          const fallbackCandidates = searchResults
            .filter(item => item.id !== media.id)
            .filter(item => item.status !== 'NOT_YET_RELEASED')
            .filter(item => !relatedAnime.some(r => r.id === item.id))
            .map(item => ({
              id: item.id,
              title: item.title.romaji || item.title.english,
              romajiTitle: item.title.romaji,
              englishTitle: item.title.english,
              image: item.coverImage?.large,
              rating: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
              episodes: item.episodes,
              relationType: 'RELATED'
            }));

          // Filter fallback candidates in parallel
          const mappedFallbacks = await Promise.all(
            fallbackCandidates.map(async (item) => {
              const isValid = await hasSamehadakuMapping(item.romajiTitle, item.englishTitle);
              if (isValid) {
                return {
                  id: item.id,
                  title: item.title,
                  image: item.image,
                  rating: item.rating,
                  episodes: item.episodes,
                  relationType: item.relationType
                };
              }
              return null;
            })
          );

          for (const item of mappedFallbacks) {
            if (item && !relatedAnime.some(r => r.id === item.id)) {
              relatedAnime.push(item);
            }
          }
        } catch (searchError) {
          // Ignore search error
        }
      }
    }

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
      genres: media.genres,
      totalEpisodes: media.episodes,
      status: media.status,
      format: media.format,
      startDate: formatDate(media.startDate),
      endDate: formatDate(media.endDate),
      relatedAnime: relatedAnime,
      description: media.description ? media.description.replace(/<[^>]+>/g, '') : null,
      studio: studio
    };

    // Save to Cache
    aniListCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    // Also cache by its numeric ID if it was looked up by name
    if (!isId && media.id) {
      aniListCache.set(media.id.toString(), {
        timestamp: Date.now(),
        data: result
      });
    }

    return result;
  } catch (error) {
    return null;
  }
}

async function getDirectActiveDomain() {
  try {
    const response = await axios.get('https://samehadaku.care/', { headers, timeout: 5000 });
    const redirectMatch = response.data.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (redirectMatch && redirectMatch[1]) {
      return redirectMatch[1].endsWith('/') ? redirectMatch[1] : redirectMatch[1] + '/';
    }
    return 'https://samehadaku.care/';
  } catch (e) {
    try {
      const homeRes = await axios.get('https://puruboy-api.vercel.app/api/anime/samehadaku/home', { timeout: 5000 });
      const firstUpdate = homeRes.data?.result?.latestUpdates?.[0];
      if (firstUpdate && firstUpdate.original_url) {
        const urlObj = new URL(firstUpdate.original_url);
        return urlObj.origin + '/';
      }
    } catch (_) {}
    return 'https://v2.samehadaku.how/';
  }
}

async function scrapeSamehadakuPage(activeDomain, pageNumber = 1) {
  const pageUrl = pageNumber > 1 ? `${activeDomain}page/${pageNumber}/` : activeDomain;
  const response = await axios.get(pageUrl, { headers, timeout: 6000 });
  const $ = cheerio.load(response.data);
  const updates = [];
  
  $('.post-show ul li').each((i, el) => {
    const $el = $(el);
    const originalUrl = $el.find('.entry-title a').attr('href');
    updates.push({
      title: $el.find('.entry-title a').text().trim(),
      url: getRelativeUrl(originalUrl),
      image: $el.find('.thumb img').attr('src'),
      episode: $el.find('.dtla span:nth-child(2) author').text().trim() || $el.find('.dtla span:nth-child(2)').text().trim() || 'Ongoing',
      score: 'N/A',
      released: $el.find('.dtla span:last-child').text().replace(/Released on:/gi, '').trim(),
      postedBy: $el.find('.author author').text().trim()
    });
  });
  
  return updates;
}

export async function animeterbaru(page = 1) {
  try {
    const activeDomain = await getDirectActiveDomain();
    const updates = await scrapeSamehadakuPage(activeDomain, page);
    if (updates && updates.length > 0) {
      return updates;
    }
  } catch (error) {
    console.error("Direct Samehadaku scrape failed, falling back to Puruboy API:", error.message);
  }

  // Fallback to Puruboy API
  try {
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/home`, { headers, timeout: 6000 });
    if (res.data && res.data.success && res.data.result) {
      const updates = res.data.result.latestUpdates || [];
      return updates.map(item => ({
        title: item.title,
        url: getRelativeUrl(item.original_url),
        image: item.thumbnail,
        episode: item.episode ? item.episode.toString() : 'Ongoing',
        score: 'N/A',
        released: item.released || '',
        postedBy: item.posted_by || ''
      }));
    }
  } catch (err) {
    console.error("scraper.js: animeterbaru error:", err?.message || 'Unknown error');
  }
  return [];
}

export async function search(query) {
  try {
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/search?q=${encodeURIComponent(query)}`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const items = res.data.result.data || [];
      return items.map(item => ({
        title: item.title,
        image: item.thumbnail,
        type: item.type || 'TV',
        status: item.status || 'Ongoing',
        score: item.score || 'N/A',
        url: getRelativeUrl(item.original_url)
      }));
    }
    return [];
  } catch (error) {
    console.error("scraper.js: search error:", error?.message || 'Unknown error');
    return [];
  }
}

export async function detail(link) {
  try {
    const relative = getRelativeUrl(link);
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/detail?url=${encodeURIComponent(relative)}`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const result = res.data.result;
      const episodes = (result.episodeList || []).map(ep => ({
        title: ep.title,
        url: getRelativeUrl(ep.original_url),
        date: ep.date || 'Terbaru'
      }));
      
      const info = {
        japanese: result.details?.japanese || '',
        english: result.details?.english || '',
        status: result.details?.status || 'Ongoing',
        studio: result.details?.studio || 'Unknown',
        dirilis: result.details?.released || 'Unknown',
        skor: result.rating || '8.5',
        genre: result.details?.genre || result.details?.genres || result.genre || ''
      };

      const extractedGenres = result.genres || (result.details?.genre ? result.details.genre.split(',').map(g => g.trim()) : []);

      return {
        title: result.title,
        image: result.thumbnail,
        description: result.synopsis,
        episodes,
        info,
        genres: extractedGenres
      };
    }
    return null;
  } catch (error) {
    console.error("scraper.js: detail error:", error?.message || 'Unknown error');
    return null;
  }
}

export async function download(link) {
  try {
    const relative = getRelativeUrl(link);
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/stream?url=${encodeURIComponent(relative)}`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const result = res.data.result;
      const streams = (result.serverOptions || []).map(opt => ({
        server: opt.name,
        url: `/api/embed?post=${opt.post}&nume=${opt.nume}&type=${opt.type}`
      }));
      return {
        title: result.title,
        streams
      };
    }
    return null;
  } catch (error) {
    console.error("scraper.js: download error:", error?.message || 'Unknown error');
    return null;
  }
}

export async function schedule() {
  try {
    const res = await axios.get('https://puruboy-api.vercel.app/api/anime/samehadaku/schedule', { headers });
    if (res.data && res.data.success && res.data.result) {
      return res.data.result;
    }
    return null;
  } catch (error) {
    console.error("scraper.js: schedule error:", error);
    return null;
  }
}

export { cleanTitle };
