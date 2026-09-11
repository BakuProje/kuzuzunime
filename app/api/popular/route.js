import { NextResponse } from 'next/server';
import { getAnimePoster } from '@/lib/scraper';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
};

const MIRRORS = ['https://samehadaku.pro/', 'https://samehadaku.email/'];

async function fetchDirectPopular() {
  for (const domain of MIRRORS) {
    try {
      const res = await axios.get(domain, { headers, timeout: 5000 });
      const $ = cheerio.load(res.data);
      const topList = [];
      const seen = new Set();

      $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href || href.includes('anime-list') || seen.has(href)) return;
        if (!href.includes('/anime/')) return;
        seen.add(href);

        const title = $(el).find('.sh-nm').text().trim() || $(el).find('.j').text().trim() || $(el).text().trim();
        let image = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
        if (image.includes('placeholder.svg')) image = '';

        const eps = $(el).find('.jarvis-eps').text().trim() || 'Ongoing';
        const score = $(el).find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

        if (title && title.length > 1) {
          topList.push({
            title,
            image: image || '/placeholder.jpg',
            score,
            episode: eps,
            status: eps.toLowerCase().includes('tamat') ? 'Completed' : 'Ongoing',
            type: 'TV',
            url: href.startsWith('http') ? href.replace(/^https?:\/\/[^\/]+/, '') : href
          });
        }
      });

      if (topList.length > 0) return topList;
    } catch (e) {
      console.warn(`[Popular Scraper] ${domain} failed, trying next mirror...`);
    }
  }
  return [];
}

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
    const rawPopular = await fetchDirectPopular();

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
