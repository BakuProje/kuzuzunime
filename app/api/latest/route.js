import { NextResponse } from 'next/server';
import { animeterbaru, getAniListData, cleanTitle, search } from '@/lib/scraper';

// AniList-based fallback: fetch trending/popular anime directly from AniList
async function getAniListTrending(perPage = 20) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, status_in: [RELEASING, NOT_YET_RELEASED]) {
          id
          title { romaji english }
          coverImage { extraLarge large }
          bannerImage
          averageScore
          episodes
          status
          format
          genres
          startDate { year month day }
        }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { page: 1, perPage } })
    });
    const json = await res.json();
    const mediaList = json?.data?.Page?.media || [];
    return mediaList.map(m => ({
      title: m.title?.romaji || m.title?.english || 'Unknown',
      url: `/anime/${(m.title?.romaji || m.title?.english || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/,'')}-sub-indo/`,
      image: m.coverImage?.extraLarge || m.coverImage?.large,
      banner: m.bannerImage || m.coverImage?.extraLarge,
      episode: m.episodes ? `${m.episodes}` : (m.status === 'RELEASING' ? 'Ongoing' : 'Upcoming'),
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
      rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
      type: m.format || 'TV',
      year: m.startDate?.year?.toString() || '2026',
      genres: m.genres || [],
      status: m.status === 'RELEASING' ? 'Ongoing' : (m.status === 'FINISHED' ? 'Completed' : m.status),
      anilistId: m.id
    }));
  } catch (e) {
    console.error('AniList trending fallback error:', e?.message || e);
    return [];
  }
}

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._latestCache) {
  global._latestCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 600 * 1000; // 10 minutes

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const canCache = page === 1 && (limit === 20 || limit === 50);

  if (canCache && global._latestCache.data && (Date.now() - global._latestCache.timestamp < CACHE_TTL)) {
    console.log('[SERVER CACHE HIT] Serving latest from server cache');
    return NextResponse.json({ success: true, data: global._latestCache.data });
  }

  try {
    let data = [];
    if (limit > 20) {
        const pagesToFetch = Math.ceil(limit / 20);
        const pagePromises = [];
        for (let i = 1; i <= pagesToFetch; i++) {
            pagePromises.push(animeterbaru(i));
        }
        const results = await Promise.all(pagePromises);
        data = results.flat();
    } else {
        data = await animeterbaru(page);
    }

    // If Samehadaku API is down, fallback to AniList trending
    if (!data || data.length === 0) {
      console.log('[/api/latest] Samehadaku down, using AniList fallback');
      const fallback = await getAniListTrending(limit);
      if (fallback.length > 0) {
        if (canCache) {
          global._latestCache.data = fallback;
          global._latestCache.timestamp = Date.now();
        }
        return NextResponse.json({ success: true, data: fallback });
      }
      return NextResponse.json({ success: true, data: [] });
    }

    const limitedData = data.slice(0, limit);
    
    const titleMap = new Map();
    
    const enrichedData = await Promise.all(limitedData.map(async (item) => {
      const cleaned = cleanTitle(item.title);
      
      if (titleMap.has(cleaned)) {
        const cached = titleMap.get(cleaned);
        return { ...item, ...cached };
      }

      let aniData = null;
      try {
        aniData = await getAniListData(cleaned);
      } catch (e) {
        // AniList enrichment failed, continue with original data
      }
      
      let finalImage = item.image;
      let finalRating = item.score;
      let finalBanner = null;

      if (aniData && aniData.poster) {
        finalImage = aniData.poster;
        finalRating = aniData.rating || item.score;
        finalBanner = aniData.banner;
      } else {
        try {
          const searchResults = await search(cleaned);
          const match = searchResults.find(r => 
            r.title.toLowerCase() === cleaned.toLowerCase()
          ) || searchResults.find(r => 
            r.title.toLowerCase().includes(cleaned.toLowerCase()) && 
            !r.title.toLowerCase().includes('episode')
          );
          
          if (match && match.image) {
            finalImage = match.image;
          }
        } catch (err) {
          // Search fallback failed, use original image
        }
      }

      const enriched = {
        image: finalImage,
        rating: finalRating,
        banner: finalBanner || finalImage,
        genres: aniData?.genres || [],
        anilistId: aniData?.anilistId || null,
        type: aniData?.format || 'TV',
        year: aniData?.startDate ? aniData.startDate.split(', ').pop() : '2026',
        status: aniData?.status === 'FINISHED' ? 'Completed' : (aniData?.status === 'RELEASING' ? 'Ongoing' : aniData?.status || 'Ongoing'),
        description: aniData?.description || ''
      };

      titleMap.set(cleaned, enriched);
      return { ...item, ...enriched };
    }));

    const uniqueList = Array.from(new Map(enrichedData.map(item => [item.anilistId || item.title, item])).values());

    if (canCache && uniqueList.length > 0) {
      global._latestCache.data = uniqueList;
      global._latestCache.timestamp = Date.now();
    }

    return NextResponse.json({ success: true, data: uniqueList });
  } catch (e) {
    console.error('[/api/latest] Error:', e?.message || e);
    // Last resort: try AniList trending
    try {
      const fallback = await getAniListTrending(limit);
      if (fallback.length > 0) {
        if (canCache) {
          global._latestCache.data = fallback;
          global._latestCache.timestamp = Date.now();
        }
        return NextResponse.json({ success: true, data: fallback });
      }
    } catch (_) {}
    return NextResponse.json({ success: true, data: [] });
  }
}
