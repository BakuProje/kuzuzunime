import { NextResponse } from 'next/server';
import { download } from '@/lib/scraper';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, message: 'Query parameter "url" is required' }, { status: 400 });
  }

  try {
    const cleanSlug = url.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');

    // Check if it is a Nekopoi Hentai ID
    if (cleanSlug.startsWith('hentai-')) {
      const nekopoiId = cleanSlug.replace('hentai-post-', '').replace('hentai-', '');
      console.log("Loading Nekopoi streams for ID:", nekopoiId);
      try {
        const nekopoi = require('nekopoi-scraper');
        const detailData = await nekopoi.detail(nekopoiId);
        
        if (detailData && !detailData.error && Array.isArray(detailData.stream)) {
          const streams = detailData.stream.map(opt => ({
            server: opt.name || 'Stream',
            url: opt.link || opt.url || ''
          })).filter(s => s.url !== '');

          return NextResponse.json({
            success: true,
            data: {
              title: detailData.title || 'Hentai Watch',
              streams
            }
          });
        }
      } catch (nekopoiErr) {
        console.error("Nekopoi watch error:", nekopoiErr.message);
      }
      return NextResponse.json({ success: true, data: { title: 'Hentai Watch', streams: [] } });
    }

    const data = await download(url);
    return NextResponse.json({ success: true, data: data });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
