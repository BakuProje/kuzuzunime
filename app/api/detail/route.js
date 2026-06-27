import { NextResponse } from 'next/server';
import { detail, getAniListData, cleanTitle } from '@/lib/scraper';

// Extract a readable title from the slug URL
function titleFromSlug(slug) {
  // e.g. "one-piece-episode-1-sub-indo" → "One Piece"
  const cleaned = slug
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .pop()
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/-batch.*$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return cleaned;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, message: 'Query parameter "url" is required' }, { status: 400 });
  }

  try {
    // Try to get detail from Samehadaku
    let data = null;
    try {
      data = await detail(url);
    } catch (e) {
      console.error('Samehadaku detail failed:', e?.message || e);
    }

    // Determine the title for AniList lookup
    const title = data?.title || titleFromSlug(url);
    
    let aniData = null;
    try {
      aniData = await getAniListData(cleanTitle(title));
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
        result = {
          ...data,
          rating: aniData.rating || data.info?.skor || '8.5',
          banner: aniData.banner,
          genres: aniData.genres || data.genres || [],
          totalEpisodes: aniData.totalEpisodes,
          relatedAnime: aniData.relatedAnime || [],
          studio: aniData.studio || data.info?.studio || 'Unknown',
          status: aniData.status,
          format: aniData.format,
          startDate: aniData.startDate,
          endDate: aniData.endDate,
          image: aniData.poster || data.image
        };
      } else {
        result.relatedAnime = [];
      }
    } else {
      // AniList-only fallback (Samehadaku is completely down)
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
        episodes: [], // No episodes available without Samehadaku
        info: {
          genre: (aniData.genres || []).join(', '),
          status: aniData.status === 'RELEASING' ? 'Ongoing' : (aniData.status === 'FINISHED' ? 'Completed' : aniData.status),
          studio: aniData.studio || 'Unknown',
          skor: aniData.rating || '8.5'
        },
        synopsis: `Detail lengkap untuk anime ini sedang tidak tersedia. Silakan coba lagi nanti.`
      };
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('Error in /api/detail:', e?.message || e);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
