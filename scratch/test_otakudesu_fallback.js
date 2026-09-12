const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function testOtakudesuScrape(q, ep = 1) {
  console.log(`\n=== OTAKUDESU SCRAPE: "${q}" (Ep ${ep}) ===`);
  const mirrors = ['https://otakudesu.cloud', 'https://otakudesu.best', 'https://otakudesu.cam'];
  for (const domain of mirrors) {
    try {
      const searchUrl = `${domain}/?s=${encodeURIComponent(q)}&post_type=anime`;
      console.log('Fetching:', searchUrl);
      const res = await axios.get(searchUrl, { httpsAgent: agent, headers, timeout: 4000 });
      const $ = cheerio.load(res.data);
      const animeList = [];
      $('ul.chlist li a, .venz a, .jdlflm a, a[href*="/anime/"]').each((i, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        if (href && href.includes('/anime/') && !animeList.some(x => x.href === href)) {
          animeList.push({ title, href });
        }
      });

      console.log(`Found ${animeList.length} anime on ${domain}:`, animeList.slice(0, 2));

      if (animeList.length > 0) {
        const aRes = await axios.get(animeList[0].href, { httpsAgent: agent, headers, timeout: 4000 });
        const $a = cheerio.load(aRes.data);
        const epLinks = [];
        $a('.episodelist a, a[href*="/episode/"]').each((i, el) => {
          const href = $a(el).attr('href');
          const text = $a(el).text().trim();
          if (href && !epLinks.some(x => x.href === href)) {
            epLinks.push({ text, href });
          }
        });

        console.log(`Found ${epLinks.length} episodes on Otakudesu.`);

        const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${ep}\\b|\\b${ep}\\b`, 'i');
        let matchedEp = epLinks.find(e => epRegex.test(e.text) || epRegex.test(e.href)) || (ep === 1 ? epLinks[epLinks.length - 1] : null);

        if (matchedEp) {
          console.log('Fetching Otakudesu watch page:', matchedEp.href);
          const epRes = await axios.get(matchedEp.href, { httpsAgent: agent, headers, timeout: 4000 });
          const $ep = cheerio.load(epRes.data);
          const streams = [];
          $ep('iframe').each((i, el) => {
            const src = $ep(el).attr('src') || $ep(el).attr('data-src');
            if (src) streams.push(src);
          });
          console.log('OTAKUDESU STREAMS FOUND:', streams);
          return streams;
        }
      }
    } catch (e) {
      console.log(`Otakudesu mirror ${domain} failed:`, e.message);
    }
  }
}

async function run() {
  await testOtakudesuScrape('shingeki no kyojin', 8);
  await testOtakudesuScrape('shokugeki no souma', 1);
}

run().catch(console.error);
