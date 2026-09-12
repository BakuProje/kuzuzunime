const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

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

function parseIframes(html) {
  const $ = cheerio.load(html);
  const streams = [];
  $('iframe').each((i, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-litespeed-src');
    if (src) {
      if (src.startsWith('//')) src = `https:${src}`;
      let serverName = `Server HD ${streams.length + 1}`;
      if (src.includes('putarin') || src.includes('puterin')) serverName = `Putarin HD ${streams.length + 1}`;
      else if (src.includes('mogo') || src.includes('playmogo')) serverName = `Mogo HD ${streams.length + 1}`;
      else if (src.includes('cdnhls') || src.includes('hls')) serverName = `HLS Player ${streams.length + 1}`;
      else if (src.includes('streampoi')) serverName = `Streampoi HD ${streams.length + 1}`;
      
      if (!streams.some(s => s.url === src)) {
        streams.push({ server: serverName, url: src });
      }
    }
  });
  return streams;
}

async function resolveAnimeWatch(link) {
  if (!link) return null;
  const rawSlug = decodeURIComponent(link)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\/+|\/+$/g, '');

  console.log(`\nTesting Resolve for: "${rawSlug}"`);

  // Step 1: Direct Nonton fetch
  try {
    const directRes = await fetchSamehadaku(`nonton/${rawSlug}/`);
    if (directRes) {
      const streams = parseIframes(directRes.data);
      if (streams.length > 0) {
        const $ = cheerio.load(directRes.data);
        const title = $('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim();
        console.log(`[Step 1 SUCCESS] Found ${streams.length} direct streams for "${title}"`);
        return { title: title || rawSlug.replace(/-/g, ' '), streams };
      }
    }
  } catch (e) {}

  // Step 2: Smart Search Matching for Anime + Episode
  const epMatch = rawSlug.match(/(?:episode|eps|ep)[-_ ]*(\d+(\.\d+)?)/i);
  const epNum = epMatch ? epMatch[1] : '1';
  const cleanName = rawSlug
    .replace(/(?:-episode-|-eps-|-ep-)\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/-/g, ' ')
    .trim();

  const searchKeywords = [
    cleanName,
    cleanName.replace(/\b(?:season\s*\d+|2nd\s*season|3rd\s*season|\d+(?:st|nd|rd|th)?\s*season|part\s*\d+|s\d+)\b/gi, '').trim()
  ];

  for (const q of searchKeywords) {
    if (!q || q.length < 2) continue;
    try {
      const searchRes = await fetchSamehadaku(`?s=${encodeURIComponent(q)}`);
      if (!searchRes) continue;

      const $s = cheerio.load(searchRes.data);
      const animeHrefs = [];
      $s('article a, .animpost a, a[href*="/anime/"]').each((i, el) => {
        const h = $s(el).attr('href');
        if (h && h.includes('/anime/') && !animeHrefs.includes(h)) animeHrefs.push(h);
      });

      for (const animeHref of animeHrefs.slice(0, 3)) {
        const aPath = animeHref.startsWith('http') ? new URL(animeHref).pathname : animeHref;
        const detailRes = await fetchSamehadaku(aPath);
        if (!detailRes) continue;

        const $d = cheerio.load(detailRes.data);
        let matchedNontonUrl = null;

        $d('a[href*="/nonton/"]').each((i, el) => {
          if (matchedNontonUrl) return;
          const href = $d(el).attr('href') || '';
          const text = $d(el).text().trim().toLowerCase();
          const hrefLower = href.toLowerCase();

          const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
          if (epRegex.test(text) || hrefLower.includes(`episode-${epNum}-`) || hrefLower.includes(`episode-0${epNum}-`)) {
            matchedNontonUrl = href;
          }
        });

        if (matchedNontonUrl) {
          const epPath = matchedNontonUrl.startsWith('http') ? new URL(matchedNontonUrl).pathname : matchedNontonUrl;
          const epRes = await fetchSamehadaku(epPath);
          if (epRes) {
            const streams = parseIframes(epRes.data);
            if (streams.length > 0) {
              const $w = cheerio.load(epRes.data);
              const title = $w('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim();
              console.log(`[Step 2 SUCCESS] Matched Samehadaku Episode -> found ${streams.length} streams for "${title}"`);
              return { title: title || `${cleanName} Episode ${epNum}`, streams };
            }
          }
        }
      }
    } catch (err) {}
  }

  // Step 3: Fast Universal Embed Fallback
  const safeTitle = `${cleanName} Episode ${epNum}`;
  const slugifiedTitle = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  console.log(`[Step 3 Fallback] Generating stream embed for: "${safeTitle}"`);
  return {
    title: safeTitle,
    streams: [
      {
        server: 'Server HD 1 (Player)',
        url: `https://vidsrc.cc/v2/embed/anime/${slugifiedTitle}/${epNum}`
      },
      {
        server: 'Server HD 2 (Alternative)',
        url: `https://autoembed.co/anime/imdb/${slugifiedTitle}-${epNum}`
      }
    ]
  };
}

async function testAll() {
  await resolveAnimeWatch('kimetsu-no-yaiba-episode-1');
  await resolveAnimeWatch('jujutsu-kaisen-episode-1');
  await resolveAnimeWatch('bang-dream-garupa☆pico-episode-26-gf5g6d5');
}

testAll();
