import { NextResponse } from 'next/server';
import { search, getAniListData, cleanTitle } from '@/lib/scraper';

const POPULAR_KEYWORDS = ["One Piece", "Naruto", "Bleach", "Solo Leveling", "Kaiju No. 8", "Jujutsu Kaisen", "Demon Slayer", "Mushoku Tensei", "Black Clover", "Hunter x Hunter", "Wind Breaker", "That Time I Got Reincarnated as a Slime", "My Hero Academia", "Haikyuu", "Attack on Titan", "Frieren", "Blue Lock", "Classroom of the Elite", "Oshi no Ko", "Dr. Stone"];

// AniList-based fallback: fetch popular anime directly
async function getAniListPopular(perPage = 50) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME) {
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
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
      episode: m.episodes ? m.episodes.toString() : (m.status === 'RELEASING' ? 'Ongoing' : 'Tamat'),
      status: m.status === 'RELEASING' ? 'Ongoing' : (m.status === 'FINISHED' ? 'Completed' : m.status),
      type: m.format || 'TV',
      genres: m.genres || [],
      anilistId: m.id
    }));
  } catch (e) {
    console.error('AniList popular fallback error:', e?.message || e);
    return [];
  }
}

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._popularCache) {
  global._popularCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 1800 * 1000; // 30 minutes

export async function GET() {
  if (global._popularCache.data && (Date.now() - global._popularCache.timestamp < CACHE_TTL)) {
    console.log('[SERVER CACHE HIT] Serving popular from server cache');
    return NextResponse.json({ success: true, data: global._popularCache.data });
  }

  try {
    const searchPromises = POPULAR_KEYWORDS.map(k => search(k));
    const searchResults = await Promise.all(searchPromises);
    
    const allResults = searchResults.flat().filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
    
    // If Samehadaku search returned nothing, use AniList fallback
    if (allResults.length === 0) {
      console.log('[/api/popular] Samehadaku down, using AniList fallback');
      const fallback = await getAniListPopular(50);
      if (fallback.length > 0) {
        global._popularCache.data = fallback;
        global._popularCache.timestamp = Date.now();
      }
      return NextResponse.json({ success: true, data: fallback });
    }

    const enrichedData = await Promise.all(allResults.slice(0, 50).map(async (item) => {
      try {
        const aniData = await getAniListData(cleanTitle(item.title));
        const rawStatus = aniData?.status || item.status;
        const normalizedStatus = rawStatus === 'FINISHED' ? 'Completed' : (rawStatus === 'RELEASING' ? 'Ongoing' : rawStatus);
        return {
          ...item,
          score: aniData?.rating || item.score || '8.5',
          episode: aniData?.totalEpisodes ? aniData.totalEpisodes.toString() : (normalizedStatus === 'Completed' ? 'Tamat' : 'Ongoing'),
          status: normalizedStatus,
          image: aniData?.poster || item.image || aniData?.banner
        };
      } catch (err) {
        return {
          ...item,
          episode: item.status === 'Completed' ? 'Tamat' : 'Ongoing'
        };
      }
    }));

    if (enrichedData.length > 0) {
      global._popularCache.data = enrichedData;
      global._popularCache.timestamp = Date.now();
    }

    return NextResponse.json({ success: true, data: enrichedData });
  } catch (e) {
    console.error('[/api/popular] Error:', e?.message || e);
    // Fallback to AniList
    try {
      const fallback = await getAniListPopular(50);
      if (fallback.length > 0) {
        global._popularCache.data = fallback;
        global._popularCache.timestamp = Date.now();
        return NextResponse.json({ success: true, data: fallback });
      }
    } catch (_) {}
    return NextResponse.json({ success: true, data: [] });
  }
}
