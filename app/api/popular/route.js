export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { populer, getAnimePoster } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Simple in-memory server-side cache
if (!global._popularCache) {
  global._popularCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 600 * 1000; // 10 minutes

export async function GET() {
  if (global._popularCache.data && (Date.now() - global._popularCache.timestamp < CACHE_TTL)) {
    return NextResponse.json({ success: true, data: global._popularCache.data });
  }

  try {
    const rawPopular = await populer(1);

    if (!rawPopular || rawPopular.length === 0) {
      if (global._popularCache.data && global._popularCache.data.length > 0) {
        return NextResponse.json({ success: true, data: global._popularCache.data });
      }
      return NextResponse.json({ success: true, data: [] });
    }

    const enriched = await Promise.all(rawPopular.slice(0, 30).map(async (item) => {
      let finalImg = item.image;
      if (!finalImg || finalImg.includes('placeholder')) {
        finalImg = await getAnimePoster(item.title, item.image);
      }
      return {
        ...item,
        image: finalImg,
        score: (item.score && item.score !== 'N/A') ? item.score : '8.5'
      };
    }));

    if (enriched.length > 0) {
      global._popularCache.data = enriched;
      global._popularCache.timestamp = Date.now();
    }

    return NextResponse.json({ success: true, data: enriched });
  } catch (e) {
    console.error('[/api/popular] Error:', e?.message || e);
    if (global._popularCache.data && global._popularCache.data.length > 0) {
      return NextResponse.json({ success: true, data: global._popularCache.data });
    }
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
