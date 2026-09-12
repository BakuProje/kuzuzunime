const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (h, opt, cb) => {
    if (typeof opt === 'function') { cb = opt; opt = {}; }
    if (opt && opt.all) cb(null, [{ address: '104.21.89.196', family: 4 }]);
    else cb(null, '104.21.89.196', 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function testResolver(link) {
  const rawClean = decodeURIComponent(link)
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(anime|nonton|watch)\//i, '')
    .replace(/^\/+|\/+$/g, '');

  const epMatch = rawClean.match(/(?:episode|eps|ep)[-_ \/]*(\d+(\.\d+)?)/i);
  const epNum = epMatch ? epMatch[1] : '1';
  
  const cleanName = rawClean
    .replace(/^\d+\//, '') // strip leading kuramanime numeric id like 4624/
    .replace(/(?:-episode-|-eps-|-ep-|\/episode\/)\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/[\(\[\{].*?[\)\]\}]/g, ' ') // strip (Music), (TV), [BD]
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const safeTitle = `${cleanName} Episode ${epNum}`;
  const slugifiedTitle = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  console.log(`\nTesting Link: "${link}" -> Clean Name: "${cleanName}", Ep: ${epNum}`);

  // Search Samehadaku with variations
  const queries = [cleanName];
  const words = cleanName.split(' ').filter(Boolean);
  if (words.length > 3) {
    queries.push(words.slice(0, 3).join(' '));
  }

  // Kitsu Synonyms
  try {
    const kitsuRes = await axios.get(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanName)}&page[limit]=1`, {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 2000
    });
    const attr = kitsuRes.data?.data?.[0]?.attributes;
    if (attr) {
      if (attr.canonicalTitle) queries.push(attr.canonicalTitle);
      if (attr.titles?.en_jp) queries.push(attr.titles.en_jp);
    }
  } catch (e) {}

  const uniqueQueries = [...new Set(queries.filter(q => q && q.length >= 2))];

  for (const q of uniqueQueries) {
    try {
      const searchRes = await axios.get(`https://ww2.samehadaku.pro/?s=${encodeURIComponent(q)}`, {
        httpsAgent: agent,
        headers,
        timeout: 3500
      });
      const $s = cheerio.load(searchRes.data);
      const animeLinks = [];
      $s('a[href*="/anime/"]').each((i, el) => {
        const h = $s(el).attr('href');
        if (h && !animeLinks.includes(h)) animeLinks.push(h);
      });

      for (const aHref of animeLinks.slice(0, 2)) {
        const dRes = await axios.get(aHref, { httpsAgent: agent, headers, timeout: 3500 });
        const $d = cheerio.load(dRes.data);
        let matchedEpUrl = null;

        $d('a[href*="/nonton/"]').each((i, el) => {
          if (matchedEpUrl) return;
          const href = $d(el).attr('href') || '';
          const text = $d(el).text().trim().toLowerCase();
          const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
          if (epRegex.test(text) || href.toLowerCase().includes(`episode-${epNum}-`) || href.toLowerCase().includes(`episode-0${epNum}-`)) {
            matchedEpUrl = href;
          }
        });

        if (!matchedEpUrl && epNum === '1') {
          matchedEpUrl = $d('a[href*="/nonton/"]').last().attr('href') || $d('a[href*="/nonton/"]').first().attr('href');
        }

        if (matchedEpUrl) {
          const epRes = await axios.get(matchedEpUrl, { httpsAgent: agent, headers, timeout: 3500 });
          const $ep = cheerio.load(epRes.data);
          const title = $ep('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim();
          const streams = [];
          $ep('iframe').each((i, el) => {
            const src = $ep(el).attr('src') || $ep(el).attr('data-src');
            if (src && !streams.some(s => s.url === src)) {
              let name = `Samehadaku HD ${streams.length + 1}`;
              if (src.includes('putarin') || src.includes('puterin')) name = `Putarin HD ${streams.length + 1}`;
              streams.push({ server: name, url: src.startsWith('//') ? `https:${src}` : src });
            }
          });

          if (streams.length > 0) {
            console.log(`[FOUND ON SAMEHADAKU] Title: "${title}", Streams:`, streams);
            return { title: title || safeTitle, streams };
          }
        }
      }
    } catch (e) {}
  }

  // Fallback for Music / Special / Universal Anime
  const isMusic = rawClean.toLowerCase().includes('music') || cleanName.toLowerCase().includes('music') || link.toLowerCase().includes('music');
  const fallbackStreams = [
    {
      server: isMusic ? 'Music Player HD 1' : 'Server HD 1 (Vidsrc VIP)',
      url: isMusic 
        ? `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanName + ' official music audio animation')}`
        : `https://vidsrc.pm/embed/anime/${slugifiedTitle}/${epNum}`
    },
    {
      server: 'Server HD 2 (MultiEmbed)',
      url: `https://multiembed.mov/directstream.php?video_id=${slugifiedTitle}&s=1&e=${epNum}`
    },
    {
      server: 'Server HD 3 (VidLink Pro)',
      url: `https://vidlink.pro/anime/${slugifiedTitle}/${epNum}`
    },
    {
      server: 'Server HD 4 (SmashyStream)',
      url: `https://player.smashy.stream/anime/${slugifiedTitle}?e=${epNum}`
    }
  ];

  if (isMusic) {
    fallbackStreams.unshift({
      server: 'Music Audio & MV (Official)',
      url: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(cleanName + ' anime theme song audio')}`
    });
  }

  console.log(`[FALLBACK STREAMS GENERATED] SafeTitle: "${safeTitle}", Streams:`, fallbackStreams);
  return { title: safeTitle, streams: fallbackStreams };
}

async function main() {
  await testResolver('/anime/4624/baby-music/episode/1');
  await testResolver('/bocchi-the-rock-episode-1');
  await testResolver('/steel-ball-run-jojo-no-kimyou-na-bouken-sub-indo-episode-1');
}

main().catch(console.error);
