import { NextResponse } from 'next/server';
import { animeterbaru, getAniListData, cleanTitle, search, getAnimePoster } from '@/lib/scraper';

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._latestCache) {
  global._latestCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 300 * 1000; // 5 minutes

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
        pagePromises.push(animeterbaru(i).catch(() => []));
      }
      const results = await Promise.all(pagePromises);
      data = results.flat();
    } else {
      data = await animeterbaru(page);
    }

    if (!data || data.length === 0) {
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
      } catch (e) {}

      let finalImage = item.image;
      let finalRating = item.score && item.score !== 'N/A' ? item.score : '8.5';
      let finalBanner = item.image;

      if (aniData && aniData.poster) {
        finalImage = aniData.poster;
        finalRating = aniData.rating || finalRating;
        finalBanner = aniData.banner || aniData.poster;
      }

      if (!finalImage || finalImage.includes('placeholder')) {
        finalImage = await getAnimePoster(item.title, item.image);
      }
      if (!finalBanner || finalBanner.includes('placeholder')) {
        finalBanner = finalImage;
      }

      const enriched = {
        image: finalImage,
        rating: finalRating,
        banner: finalBanner || finalImage,
        genres: aniData?.genres || ['Action', 'Adventure'],
        anilistId: aniData?.anilistId || null,
        type: aniData?.format || 'TV',
        year: aniData?.startDate ? aniData.startDate.split(', ').pop() : '2026',
        status: aniData?.status === 'FINISHED' ? 'Completed' : (aniData?.status === 'RELEASING' ? 'Ongoing' : 'Ongoing'),
        description: aniData?.description || ''
      };

      titleMap.set(cleaned, enriched);
      return { ...item, ...enriched };
    }));

    const uniqueList = Array.from(new Map(enrichedData.map(item => [item.url || item.title, item])).values());

    if (canCache && uniqueList.length > 0) {
      global._latestCache.data = uniqueList;
      global._latestCache.timestamp = Date.now();
    }

    return NextResponse.json({ success: true, data: uniqueList });
  } catch (e) {
    console.error('[/api/latest] Error:', e?.message || e);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
