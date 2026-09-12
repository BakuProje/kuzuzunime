const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

const SAMEHADAKU_MIRRORS = [
  'https://samehadaku.pro/',
  'https://ww2.samehadaku.pro/'
];

async function fetchSamehadaku(path) {
  const clean = path.replace(/^\//, '');
  for (const domain of SAMEHADAKU_MIRRORS) {
    try {
      const fullUrl = `${domain}${clean}`;
      const res = await axios.get(fullUrl, { headers, timeout: 5000 });
      if (res && res.data) return { data: res.data, url: fullUrl };
    } catch (e) {}
  }
  return null;
}

async function resolveWatchStream(rawUrlOrSlug) {
  const clean = decodeURIComponent(rawUrlOrSlug)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '');
  
  console.log(`\n=== Resolving Watch Stream for: "${clean}" ===`);

  // 1. Direct fetch if slug already matches Samehadaku nonton format
  try {
    const directRes = await fetchSamehadaku(`nonton/${clean}/`);
    if (directRes) {
      const $ = cheerio.load(directRes.data);
      const iframes = $('iframe').map((i, el) => $(el).attr('src') || $(el).attr('data-src')).get().filter(Boolean);
      if (iframes.length > 0) {
        console.log('-> Found Direct Stream Iframes:', iframes);
        return {
          title: $('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim(),
          streams: iframes.map((src, idx) => ({ server: `Server HD ${idx + 1}`, url: src }))
        };
      }
    }
  } catch (e) {}

  // 2. Extract anime name and episode number
  const epMatch = clean.match(/(?:episode|eps|ep)[-_ ]*(\d+(\.\d+)?)/i);
  const epNum = epMatch ? epMatch[1] : '1';
  
  let animeName = clean
    .replace(/(?:-episode-|-eps-|-ep-)\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/-/g, ' ')
    .trim();

  console.log(`-> Extracted Anime Name: "${animeName}", Episode: ${epNum}`);

  // Search Samehadaku for the anime
  const searchQueries = [
    animeName,
    animeName.replace(/\b(season|part|\d+th|\d+nd|\d+rd|\d+st)\b/gi, '').trim()
  ];

  for (const query of searchQueries) {
    if (!query) continue;
    try {
      const searchRes = await fetchSamehadaku(`?s=${encodeURIComponent(query)}`);
      if (!searchRes) continue;

      const $s = cheerio.load(searchRes.data);
      const animeLinks = [];
      $s('article a, .animpost a, a[href*="/anime/"]').each((i, el) => {
        const href = $s(el).attr('href');
        if (href && href.includes('/anime/') && !animeLinks.includes(href)) {
          animeLinks.push(href);
        }
      });

      console.log(`-> Search for "${query}" found ${animeLinks.length} anime links`);

      // Check each anime link for matching episode
      for (const animeLink of animeLinks.slice(0, 3)) {
        const path = animeLink.startsWith('http') ? new URL(animeLink).pathname : animeLink;
        const detailRes = await fetchSamehadaku(path);
        if (!detailRes) continue;

        const $d = cheerio.load(detailRes.data);
        let matchedEpUrl = null;

        $d('a[href*="/nonton/"]').each((i, el) => {
          if (matchedEpUrl) return;
          const href = $d(el).attr('href') || '';
          const text = $d(el).text().trim().toLowerCase();
          const hrefLower = href.toLowerCase();

          // Match by episode number
          const epRegex = new RegExp(`episode[-_ ]*0*${epNum}\\b|eps[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
          if (epRegex.test(text) || hrefLower.includes(`episode-${epNum}-`) || hrefLower.includes(`episode-0${epNum}-`)) {
            matchedEpUrl = href;
          }
        });

        if (matchedEpUrl) {
          console.log(`-> Found Matched Episode URL on Samehadaku: ${matchedEpUrl}`);
          const epPath = matchedEpUrl.startsWith('http') ? new URL(matchedEpUrl).pathname : matchedEpUrl;
          const epRes = await fetchSamehadaku(epPath);
          if (epRes) {
            const $w = cheerio.load(epRes.data);
            const iframes = $w('iframe').map((i, el) => $w(el).attr('src') || $w(el).attr('data-src')).get().filter(Boolean);
            if (iframes.length > 0) {
              console.log('-> SUCCESS! Extracted Video Streams:', iframes);
              return {
                title: $w('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim(),
                streams: iframes.map((src, idx) => ({ server: `Server HD ${idx + 1}`, url: src }))
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('Search match error:', e.message);
    }
  }

  console.log('-> Samehadaku scrape could not find matching episode, testing universal stream embed...');
  return null;
}

async function run() {
  await resolveWatchStream('kimetsu-no-yaiba-episode-1');
  await resolveWatchStream('jujutsu-kaisen-episode-1');
  await resolveWatchStream('fate-kaleid-liner-prisma☆illya-episode-13-ifbkq7i');
}

run();
