import { NextResponse } from 'next/server';

// In-memory cache for resolved embed URLs
const embedCache = new Map();
const CACHE_TTL = 12 * 3600 * 1000; // 12 hours cache duration

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const post = searchParams.get('post');
  const nume = searchParams.get('nume');
  const type = searchParams.get('type');

  if (!post || !nume || !type) {
    return new NextResponse('Missing required parameters: post, nume, type', { status: 400 });
  }

  const cacheKey = `${post}-${nume}-${type}`;

  // Check in-memory cache first
  if (embedCache.has(cacheKey)) {
    const cached = embedCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("EMBED CACHE HIT:", cacheKey);
      return NextResponse.redirect(cached.embed_url, { status: 302 });
    }
  }

  try {
    const response = await fetch(`https://puruboy-api.vercel.app/api/anime/samehadaku/embed?post=${post}&nume=${nume}&type=${type}`);
    const json = await response.json();
    const embed_url = json?.result?.embed_url;
    if (embed_url) {
      // Save to cache
      embedCache.set(cacheKey, {
        timestamp: Date.now(),
        embed_url: embed_url
      });
      return NextResponse.redirect(embed_url, { status: 302 });
    }
    return new NextResponse('Embed URL not found', { status: 404 });
  } catch (e) {
    console.error("Embed proxy error:", e);
    return new NextResponse(e.message, { status: 500 });
  }
}
