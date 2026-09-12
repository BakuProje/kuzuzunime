const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (h, opt, cb) => {
    if (typeof opt === 'function') { cb = opt; opt = {}; }
    let ip = '104.21.89.196';
    if (opt && opt.all) cb(null, [{ address: ip, family: 4 }]);
    else cb(null, ip, 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

function cleanAnimeTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/^\/?(anime|nonton|watch)\//i, '')
    .replace(/^\/?\d+\//, '') // strip leading kuramanime numeric id like 4624/
    .replace(/(?:-episode-|-eps-|-ep-|\/episode\/)\d+.*$/i, '')
    .replace(/-(?:sub-indo|subtitle-indonesia|batch).*$/i, '')
    .replace(/[\(\[\{].*?[\)\]\}]/g, ' ') // strip (Music), (TV), [BD], etc.
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function testCleanDownload(link) {
  const cleanName = cleanAnimeTitle(link);
  const epMatch = link.match(/(?:episode|eps|ep)[-_ \/]*(\d+(\.\d+)?)/i);
  const epNum = epMatch ? epMatch[1] : '1';

  console.log(`\nInput: "${link}" -> Clean Name: "${cleanName}", Ep: ${epNum}`);

  // 1. Samehadaku Search
  const searchUrl = `https://ww2.samehadaku.pro/?s=${encodeURIComponent(cleanName)}`;
  console.log(`Searching Samehadaku: ${searchUrl}`);
  try {
    const res = await axios.get(searchUrl, { httpsAgent: agent, headers, timeout: 4000 });
    const $ = cheerio.load(res.data);
    const animeLinks = [];
    $('a[href*="/anime/"]').each((i, el) => {
      const h = $(el).attr('href');
      if (h && !animeLinks.includes(h)) animeLinks.push(h);
    });

    console.log(`Found ${animeLinks.length} anime links on Samehadaku.`);
    for (const aHref of animeLinks.slice(0, 2)) {
      console.log(`Checking anime detail: ${aHref}`);
      const dRes = await axios.get(aHref, { httpsAgent: agent, headers, timeout: 4000 });
      const $d = cheerio.load(dRes.data);
      let targetEp = null;
      $d('a[href*="/nonton/"]').each((i, el) => {
        if (targetEp) return;
        const h = $d(el).attr('href') || '';
        const t = $d(el).text().trim().toLowerCase();
        if (t.includes(`eps ${epNum}`) || t.includes(`episode ${epNum}`) || h.includes(`episode-${epNum}-`)) {
          targetEp = h;
        }
      });
      if (!targetEp && epNum === '1') {
        targetEp = $d('a[href*="/nonton/"]').last().attr('href') || $d('a[href*="/nonton/"]').first().attr('href');
      }

      if (targetEp) {
        console.log(`Found episode: ${targetEp}`);
        const epRes = await axios.get(targetEp, { httpsAgent: agent, headers, timeout: 4000 });
        const $ep = cheerio.load(epRes.data);
        const iframes = [];
        $ep('iframe').each((i, el) => {
          const src = $ep(el).attr('src') || $ep(el).attr('data-src');
          if (src) iframes.push(src);
        });
        console.log(`Iframes for ${cleanName}:`, iframes);
        return { success: true, iframes };
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  return { success: false };
}

async function main() {
  await testCleanDownload('/anime/4624/baby-music/episode/1');
  await testCleanDownload('/anime/3565/follow-your-fantasy/episode/1');
  await testCleanDownload('/anime/bang-dream-garupa-pico/episode/26');
  await testCleanDownload('/bocchi-the-rock-episode-1');
  await testCleanDownload('/k-on-episode-1');
}

main().catch(console.error);
