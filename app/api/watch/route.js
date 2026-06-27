import { NextResponse } from 'next/server';
import { download } from '@/lib/scraper';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, message: 'Query parameter "url" is required' }, { status: 400 });
  }

  try {
    const data = await download(url);
    return NextResponse.json({ success: true, data: data });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
