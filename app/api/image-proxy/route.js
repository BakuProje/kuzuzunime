export const runtime = 'edge';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl || targetUrl.trim() === '') {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/placeholder.jpg' }
    });
  }

  let cleanUrl = targetUrl.trim();
  if (cleanUrl.startsWith('//')) {
    cleanUrl = `https:${cleanUrl}`;
  }

  if (cleanUrl.startsWith('/')) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': cleanUrl }
    });
  }

  try {
    const urlObj = new URL(cleanUrl);
    const referer = `${urlObj.protocol}//${urlObj.hostname}/`;

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const data = await response.arrayBuffer();

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
      }
    });
  } catch (err) {
    // Graceful fallback to redirect or placeholder without breaking the UI with 500 error
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/placeholder.jpg',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
}
