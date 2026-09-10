import { NextResponse } from 'next/server';
import { search, getAniListData, cleanTitle, getAnimePoster } from '@/lib/scraper';
import axios from 'axios';
import * as cheerio from 'cheerio';

const POPULAR_KEYWORDS = [
  "One Piece", "Solo Leveling", "Bleach", "Jujutsu Kaisen", "Demon Slayer",
  "Mushoku Tensei", "Black Clover", "Naruto", "Hunter x Hunter", "Wind Breaker",
  "Frieren", "Blue Lock", "Classroom of the Elite", "Oshi no Ko", "Dr. Stone",
  "Attack on Titan", "Haikyuu", "Kaiju No. 8"
];

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
};

async function getDirectPopular() {
  try {
    const res = await axios.get('https://samehadaku.pro/', { headers, timeout: 8000 });
    const $ = cheerio.load(res.data);
    const topList = [];
    const seen = new Set();

    $('a[href*="/anime/"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href || href.includes('anime-list') || seen.has(href)) return;
      seen.add(href);

      const title = $el.find('.sh-nm').text().trim() || $el.find('.j').text().trim() || $el.text().trim();
      let image = $el.find('img').attr('src') || '';
      if (image.includes('placeholder.svg')) image = '';

      const eps = $el.find('.jarvis-eps').text().trim() || 'Ongoing';
      const score = $el.find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

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

    return topList;
  } catch (e) {
    console.error('getDirectPopular error:', e?.message);
    return [];
  }
}

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._popularCache) {
  global._popularCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 900 * 1000; // 15 minutes

export async function GET() {
  if (global._popularCache.data && (Date.now() - global._popularCache.timestamp < CACHE_TTL)) {
    console.log('[SERVER CACHE HIT] Serving popular from server cache');
    return NextResponse.json({ success: true, data: global._popularCache.data });
  }

  try {
    // 1. Fetch top list from Samehadaku Home
    const directPopular = await getDirectPopular();

    // 2. Search popular keywords
    const searchPromises = POPULAR_KEYWORDS.map(k => search(k).catch(() => []));
    const searchResults = await Promise.all(searchPromises);

    const merged = [...directPopular, ...searchResults.flat()];
    const allResults = merged.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

    if (allResults.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const enrichedData = await Promise.all(allResults.slice(0, 50).map(async (item) => {
      try {
        const aniData = await getAniListData(cleanTitle(item.title));
        const rawStatus = aniData?.status || item.status;
        const normalizedStatus = rawStatus === 'FINISHED' ? 'Completed' : (rawStatus === 'RELEASING' ? 'Ongoing' : rawStatus || 'Ongoing');
        let finalImg = (item.image && !item.image.includes('placeholder')) ? item.image : (aniData?.poster || item.image);
        if (!finalImg || finalImg.includes('placeholder')) {
          finalImg = await getAnimePoster(item.title, item.image);
        }

        return {
          ...item,
          score: (item.score && item.score !== 'N/A' && item.score !== '8.5') ? item.score : (aniData?.rating || item.score || '8.5'),
          episode: aniData?.totalEpisodes ? `${aniData.totalEpisodes} Eps` : item.episode || (normalizedStatus === 'Completed' ? 'Tamat' : 'Ongoing'),
          status: normalizedStatus,
          image: finalImg
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
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
