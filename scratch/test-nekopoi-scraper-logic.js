const axios = require('axios');
const https = require('https');
const dns = require('dns');
const cheerio = require('cheerio');

const dnsCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) {
    return dnsCache.get(hostname);
  }
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get(`https://8.8.8.8/resolve?name=${hostname}&type=A`, {
      httpsAgent: agent,
      headers: { 'Host': 'dns.google' },
      timeout: 3000
    });
    if (res.data && res.data.Answer) {
      const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
      if (ips.length > 0) {
        dnsCache.set(hostname, ips[0]);
        return ips[0];
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('nekopoi.care') || hostname.includes('nekopoi.org')) {
    resolveDnsDoH(hostname).then(ip => {
      if (ip) {
        if (options.all) {
          callback(null, [{ address: ip, family: 4 }]);
        } else {
          callback(null, ip, 4);
        }
      } else {
        callback(new Error(`ENOENT: DoH resolution failed for ${hostname}`), null, null);
      }
    }).catch(err => {
      callback(err, null, null);
    });
    return;
  }
  return dns.lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

// Real Nekopoi Watch Scraper function
async function scrapeNekopoiWatch(watchSlug) {
  // Parse clean slug, e.g. "hentai-overflow-episode-1" -> "overflow", episode 1
  const cleanSlug = watchSlug.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
  
  // Extract episode number
  const epMatch = cleanSlug.match(/-episode-(\d+)/i);
  const epNumber = epMatch ? parseInt(epMatch[1]) : 1;
  
  // Extract anime name for search query
  const animeName = cleanSlug
    .replace(/^hentai-/i, '')
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-/g, ' ')
    .trim();

  console.log(`[Scraper] Watch Slug: ${watchSlug}`);
  console.log(`[Scraper] Parsed Anime Name: "${animeName}", Episode: ${epNumber}`);

  // 1. Search nekopoi.care
  const searchUrl = `https://nekopoi.care/search/${encodeURIComponent(animeName)}`;
  console.log(`[Scraper] Searching Nekopoi: ${searchUrl}`);
  
  const searchRes = await axios.get(searchUrl, {
    httpsAgent: dohAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  });

  const $ = cheerio.load(searchRes.data);
  let matchedPostUrl = null;

  // Search through all post links
  $('a').each((i, el) => {
    if (matchedPostUrl) return;
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().toLowerCase();
    
    // Check if this link contains the episode number and matches the anime name
    if (href.includes('nekopoi.care') && !href.includes('/category/') && !href.includes('/page/')) {
      const hrefLower = href.toLowerCase();
      // Must contain episode number, e.g. "episode-1" or "episode-01"
      const hasEp = hrefLower.includes(`episode-${epNumber}`) || hrefLower.includes(`episode-0${epNumber}`) || 
                    text.includes(`episode ${epNumber}`) || text.includes(`episode 0${epNumber}`);
      
      if (hasEp) {
        matchedPostUrl = href;
        console.log(`[Scraper] Found matching post URL: ${matchedPostUrl} (Text: "${text.substring(0, 50)}")`);
      }
    }
  });

  if (!matchedPostUrl) {
    // Try fallback search using query params if pretty search didn't yield exact match
    const fallbackSearchUrl = `https://nekopoi.care/?s=${encodeURIComponent(animeName)}&post_type=anime`;
    console.log(`[Scraper] Match not found, trying fallback: ${fallbackSearchUrl}`);
    const fallbackRes = await axios.get(fallbackSearchUrl, {
      httpsAgent: dohAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    const $f = cheerio.load(fallbackRes.data);
    $f('a').each((i, el) => {
      if (matchedPostUrl) return;
      const href = $f(el).attr('href') || '';
      const text = $f(el).text().trim().toLowerCase();
      if (href.includes('nekopoi.care') && !href.includes('/category/') && !href.includes('/page/')) {
        const hrefLower = href.toLowerCase();
        const hasEp = hrefLower.includes(`episode-${epNumber}`) || hrefLower.includes(`episode-0${epNumber}`) || 
                      text.includes(`episode ${epNumber}`) || text.includes(`episode 0${epNumber}`);
        if (hasEp) {
          matchedPostUrl = href;
          console.log(`[Scraper] Found matching post URL (fallback): ${matchedPostUrl}`);
        }
      }
    });
  }

  if (!matchedPostUrl) {
    throw new Error(`No matching Nekopoi post found for Episode ${epNumber}`);
  }

  // 2. Fetch matched post detail/watch page
  console.log(`[Scraper] Fetching video sources from: ${matchedPostUrl}`);
  const postRes = await axios.get(matchedPostUrl, {
    httpsAgent: dohAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  });

  const $p = cheerio.load(postRes.data);
  const streams = [];

  // Scrape iframe elements inside stream sections
  $p('iframe').each((i, el) => {
    const src = $p(el).attr('src');
    if (src) {
      streams.push({
        server: `Server ${i + 1}`,
        url: src
      });
    }
  });

  return {
    title: $p('title').text().trim().split(' Subtitle ')[0],
    streams
  };
}

async function run() {
  try {
    const res = await scrapeNekopoiWatch('hentai-overflow-episode-1');
    console.log("Scraped Result SUCCESS:", res);
  } catch (err) {
    console.error("Scraper Failed:", err.message);
  }
}

run();
