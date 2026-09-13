export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { animeterbaru } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Simple in-memory server-side cache
if (!global._latestCache) {
  global._latestCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 180 * 1000; // 3 minutes

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '28');

  const canCache = page === 1;

  if (canCache && global._latestCache.data && (Date.now() - global._latestCache.timestamp < CACHE_TTL)) {
    return NextResponse.json({ success: true, data: global._latestCache.data.slice(0, limit) });
  }

  try {
    const data = await animeterbaru(page);

    if (!data || data.length === 0) {
      // Fallback to cache if available
      if (global._latestCache.data && global._latestCache.data.length > 0) {
        return NextResponse.json({ success: true, data: global._latestCache.data.slice(0, limit) });
      }
      return NextResponse.json({ success: true, data: [] });
    }

    const uniqueList = Array.from(new Map(data.map(item => [item.url || item.title, item])).values());

    if (canCache && uniqueList.length > 0) {
      global._latestCache.data = uniqueList;
      global._latestCache.timestamp = Date.now();
    }

    return NextResponse.json({ success: true, data: uniqueList.slice(0, limit) });
  } catch (e) {
    console.error('[/api/latest] Error:', e?.message || e);
    if (global._latestCache.data && global._latestCache.data.length > 0) {
      return NextResponse.json({ success: true, data: global._latestCache.data.slice(0, limit) });
    }
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
