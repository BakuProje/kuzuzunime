import { NextResponse } from 'next/server';
import { search, getAniListData, cleanTitle, getSimilarity } from '@/lib/scraper';

// Simple in-memory cache
const searchCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const genre = searchParams.get('genre');

  // Genre Filter Route
  if (genre) {
    const isHentai = genre.toLowerCase() === 'hentai';
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
        const nekopoi = require('nekopoi-scraper');
        const listData = await nekopoi.list('hentai', 1);
        if (listData && !listData.error && Array.isArray(listData)) {
          const mappedList = listData.map(item => {
            const url = `/anime/hentai-${item.id}/`;
            return {
              title: item.title,
              altTitle: 'Hentai',
              url: url,
              image: item.image,
              banner: item.image,
              score: '9.0',
              episode: 'Ongoing',
              status: 'Ongoing',
              type: 'Hentai',
              genres: ['Hentai'],
              synopsis: `Nonton anime hentai ${item.title} sub indo gratis hanya di ZUNIME. Nikmati streaming lancar dengan kualitas HD.`
            };
          });

          searchCache.set(cacheKey, {
            timestamp: Date.now(),
            data: mappedList
          });

          return NextResponse.json({ success: true, data: mappedList });
        }
      } catch (nekopoiErr) {
        console.error("Nekopoi scraper failed, falling back to AniList Hentai:", nekopoiErr.message);
      }

      // Fallback: AniList Hentai Query if Nekopoi fails
      try {
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query ($genre: String) {
                Page(page: 1, perPage: 40) {
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
              Page(page: 1, perPage: 40) {
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
