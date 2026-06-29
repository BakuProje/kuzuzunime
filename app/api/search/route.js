import { NextResponse } from 'next/server';
import { search, getAniListData, cleanTitle } from '@/lib/scraper';

// Simple in-memory cache
const searchCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

function getSimilarity(str1, str2) {
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  // 1. VALIDATION
  if (!q || q.trim() === "") {
    return NextResponse.json({
      success: false,
      data: [],
      error: "Query parameter 'q' is required"
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
