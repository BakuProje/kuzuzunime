export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { download } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import * as cheerio from 'cheerio';

async function scrapeNekopoiWatch(watchSlug) {
  const cleanSlug = watchSlug.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
  
  // Extract episode number
  const epMatch = cleanSlug.match(/-episode-(\d+)/i);
  const epNumber = epMatch ? parseInt(epMatch[1]) : null;
  
  // Extract anime name
  const animeName = cleanSlug
    .replace(/^hentai-/i, '')
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-subtitle-indonesia.*$/i, '')
    .replace(/-/g, ' ')
    .trim();

  // For JAV/single-post content, also prepare the full clean slug for direct URL matching
  const directSlug = cleanSlug.replace(/^hentai-/i, '');
  const isJAVOrSingle = !epMatch; // No episode number = likely JAV or single-post

  console.log(`[Nekopoi Scraper] Watch Slug: ${watchSlug}, Anime: "${animeName}", Ep: ${epNumber || 'single'}, isJAV: ${isJAVOrSingle}`);

  // Helper to find matching post URL in search results HTML
  function findMatchInPage(html) {
    const $ = cheerio.load(html);
    let found = null;
    
    $('a').each((i, el) => {
      if (found) return;
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().toLowerCase();
      
      if (!href.includes('nekopoi.care') || href.includes('/category/') || href.includes('/page/') || href.includes('/tag/')) return;
      
      const hrefLower = href.toLowerCase();
      
      if (epNumber) {
        // Episode-based matching for Hentai anime series
        const hasEp = hrefLower.includes(`episode-${epNumber}`) || hrefLower.includes(`episode-0${epNumber}`) || 
                      text.includes(`episode ${epNumber}`) || text.includes(`episode 0${epNumber}`);
        if (hasEp) {
          found = href;
        }
      } else {
        // Single-post matching for JAV content - match by slug keywords
        const nameWords = animeName.toLowerCase().split(' ').filter(w => w.length > 2);
        const matchCount = nameWords.filter(w => hrefLower.includes(w) || text.includes(w)).length;
        // Require at least 40% of meaningful words to match
        if (nameWords.length > 0 && matchCount >= Math.max(1, Math.ceil(nameWords.length * 0.4))) {
          found = href;
        }
      }
    });
    
    return found;
  }

  let matchedPostUrl = null;

  // Step 1: Try pretty search URL
  const searchUrl = `https://nekopoi.care/search/${encodeURIComponent(animeName)}`;
  try {
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    const searchHtml = await searchRes.text();
    matchedPostUrl = findMatchInPage(searchHtml);
  } catch (err) {
    console.warn(`[Nekopoi Scraper] Pretty search failed: ${err.message}`);
  }

  // Step 2: Fallback search using query params
  if (!matchedPostUrl) {
    const fallbackSearchUrl = `https://nekopoi.care/?s=${encodeURIComponent(animeName)}&post_type=post`;
    console.log(`[Nekopoi Scraper] Trying fallback search: ${fallbackSearchUrl}`);
    try {
      const fallbackRes = await fetch(fallbackSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(8000)
      });
      const fallbackHtml = await fallbackRes.text();
      matchedPostUrl = findMatchInPage(fallbackHtml);
    } catch (fallbackErr) {
      console.error(`[Nekopoi Scraper] Fallback search failed:`, fallbackErr.message);
    }
  }

  // Step 3: For JAV/single posts, try the direct slug URL as-is
  if (!matchedPostUrl && isJAVOrSingle) {
    const directUrl = `https://nekopoi.care/${directSlug}/`;
    console.log(`[Nekopoi Scraper] Trying direct URL for JAV: ${directUrl}`);
    try {
      const directRes = await fetch(directUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (directRes.ok) {
        matchedPostUrl = directUrl;
      }
    } catch (directErr) {
      console.warn(`[Nekopoi Scraper] Direct URL failed: ${directErr.message}`);
    }
  }

  if (!matchedPostUrl) {
    throw new Error(`No matching Nekopoi post found for "${animeName}" Episode ${epNumber || 'single'}`);
  }

  console.log(`[Nekopoi Scraper] Fetching post details: ${matchedPostUrl}`);
  const postRes = await fetch(matchedPostUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(8000)
  });

  const postHtml = await postRes.text();
  const $p = cheerio.load(postHtml);
  const streams = [];

  $p('iframe').each((i, el) => {
    const src = $p(el).attr('src');
    if (src) {
      // Clean and normalize server names
      let serverName = `Server ${i + 1}`;
      if (src.includes('playmogo') || src.includes('mogo')) serverName = `Mogo ${i + 1}`;
      else if (src.includes('streampoi') || src.includes('poi')) serverName = `Poi ${i + 1}`;
      
      streams.push({
        server: serverName,
        url: src
      });
    }
  });

  return {
    title: $p('title').text().trim().split(' Subtitle ')[0],
    streams
  };
}

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
      console.log("Loading Nekopoi streams for Hentai Slug:", cleanSlug);
      try {
        const result = await scrapeNekopoiWatch(cleanSlug);
        if (result && Array.isArray(result.streams) && result.streams.length > 0) {
          return NextResponse.json({
            success: true,
            data: {
              title: result.title || 'Hentai Watch',
              streams: result.streams
            }
          });
        }
      } catch (nekopoiErr) {
        console.error("Custom Nekopoi watch scraper failed:", nekopoiErr.message);
      }

      // If Nekopoi watch scrape failed, try Samehadaku / universal resolver with cleaned slug
      const unhentaiSlug = cleanSlug.replace(/^hentai-/i, '');
      const data = await download(unhentaiSlug);
      if (data && data.streams && data.streams.length > 0) {
        return NextResponse.json({ success: true, data });
      }

      return NextResponse.json({
        success: true,
        data: {
          title: unhentaiSlug.replace(/-/g, ' '),
          streams: data?.streams || []
        }
      });
    }

    const data = await download(url);
    return NextResponse.json({ success: true, data: data });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
