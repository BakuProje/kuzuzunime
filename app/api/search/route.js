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

  // 1. VALIDASI QUERY (WAJIB)
  if (!q || q.trim() === "") {
    return NextResponse.json({
      success: false,
      data: [],
      error: "Query parameter 'q' is required"
    }, { status: 400 });
  }

  const query = q.trim().toLowerCase();

  // 2. CHECK CACHE (Validate if cache contains episode data from the new code version)
  if (searchCache.has(query)) {
    const cached = searchCache.get(query);
    const hasEpisodes = cached.data && cached.data.some(item => 'episode' in item);
    if (hasEpisodes && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log("CACHE HIT:", query);
      return NextResponse.json({ success: true, data: cached.data });
    }
  }

  // 3. TRY CATCH (ANTI CRASH)
  try {
    console.log("QUERY SEARCH:", query);

    // 4. TAMBAHKAN DELAY (ANTI RATE LIMIT)
    await new Promise(res => setTimeout(res, 300));

    // 5. FETCH DATA (Scraper)
    let data = await search(query);
    
    if (!data || data.length === 0) {
      console.log("Direct search returned 0 results. Trying fuzzy words fallback...");
      const words = query
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 3);
      
      // Sort words by length descending
      words.sort((a, b) => b.length - a.length);
      
      const allCandidates = new Map();
      
      for (const word of words) {
        console.log(`Fuzzy querying word: "${word}"`);
        const wordResults = await search(word);
        let hasHighSimilarity = false;
        
        for (const item of wordResults) {
          if (!allCandidates.has(item.url)) {
            const score = getSimilarity(query, cleanTitle(item.title));
            allCandidates.set(item.url, { item, score });
            if (score >= 0.4) {
              hasHighSimilarity = true;
            }
          }
        }
        
        if (hasHighSimilarity) {
          break;
        }
      }
      
      const filtered = Array.from(allCandidates.values())
        .filter(c => c.score >= 0.25)
        .sort((a, b) => b.score - a.score)
        .map(c => c.item);
      
      if (filtered.length > 0) {
        data = filtered;
      }
    }
    
    if (!data || data.length === 0) {
      // Fallback: search AniList directly
      try {
        const aniQuery = `
          query ($search: String) {
            Page(page: 1, perPage: 20) {
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
        `;
        const aniRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aniQuery, variables: { search: query } })
        });
        const aniJson = await aniRes.json();
        const mediaList = aniJson?.data?.Page?.media || [];
        if (mediaList.length > 0) {
          const fallbackData = mediaList.map(m => ({
            title: m.title?.romaji || m.title?.english || 'Unknown',
            url: `/anime/${(m.title?.romaji || m.title?.english || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/,'')}-sub-indo/`,
            image: m.coverImage?.extraLarge || m.coverImage?.large,
            banner: m.bannerImage,
            score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
            episode: m.episodes ? m.episodes.toString() : (m.status === 'RELEASING' ? 'Ongoing' : 'Tamat'),
            status: m.status === 'RELEASING' ? 'Ongoing' : (m.status === 'FINISHED' ? 'Completed' : m.status),
            type: m.format || 'TV',
            genres: m.genres || []
          }));
          return NextResponse.json({ success: true, data: fallbackData });
        }
      } catch (fallbackErr) {
        console.error('AniList search fallback error:', fallbackErr?.message);
      }
      return NextResponse.json({ success: true, data: [] });
    }

    // 6. ENRICHMENT (AniList) - Limit to 15 for stability
    const enrichedData = await Promise.all(data.slice(0, 15).map(async (item) => {
      try {
        const cleaned = cleanTitle(item.title);
        const aniData = await getAniListData(cleaned);
        const rawStatus = aniData?.status || item.status;
        const normalizedStatus = rawStatus === 'FINISHED' ? 'Completed' : (rawStatus === 'RELEASING' ? 'Ongoing' : rawStatus);
        return {
          ...item,
          image: aniData?.poster || item.image,
          score: aniData?.rating || item.score || '8.5',
          banner: aniData?.banner,
          genres: aniData?.genres,
          status: normalizedStatus,
          episode: aniData?.totalEpisodes ? aniData.totalEpisodes.toString() : (normalizedStatus === 'Completed' ? 'Tamat' : 'Ongoing')
        };
      } catch (err) {
        return {
          ...item,
          episode: item.status === 'Completed' ? 'Tamat' : 'Ongoing'
        };
      }
    }));

    const finalData = [
      ...enrichedData,
      ...data.slice(15).map(item => ({
        ...item,
        episode: item.status === 'Completed' ? 'Tamat' : 'Ongoing'
      }))
    ];

    // 7. SAVE TO CACHE
    searchCache.set(query, {
      timestamp: Date.now(),
      data: finalData
    });

    return NextResponse.json({ success: true, data: finalData });
  } catch (error) {
    console.error("SEARCH API ERROR:", error);

    // JANGAN PERNAH RETURN 500!
    return NextResponse.json({ 
      success: false, 
      data: [], 
      message: "Internal search failed, please try again later" 
    }, { status: 200 }); // Return 200 with empty data to avoid frontend crash
  }
}
