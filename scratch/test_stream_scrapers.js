const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const dns = require('dns');

const agent = new https.Agent({ rejectUnauthorized: false });

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function testSamehadakuStream(query, ep = 1) {
  console.log(`\n=== SAMEHADAKU STREAM SEARCH: "${query}" (Ep ${ep}) ===`);
  try {
    const res = await axios.get(`https://ww2.samehadaku.pro/?s=${encodeURIComponent(query)}`, {
      httpsAgent: agent,
      headers,
      timeout: 5000
    });
    const $ = cheerio.load(res.data);
    const animeLinks = [];
    $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
      const h = $(el).attr('href');
      const t = $(el).find('.j, .sh-nm').text().trim() || $(el).text().trim();
      if (h && h.includes('/anime/') && !animeLinks.some(x => x.h === h)) {
        animeLinks.push({ t, h });
      }
    });

    console.log('Found anime on Samehadaku:', animeLinks.slice(0, 3));

    if (animeLinks.length > 0) {
      const detailUrl = animeLinks[0].h;
      console.log('Fetching detail:', detailUrl);
      const dRes = await axios.get(detailUrl, { httpsAgent: agent, headers, timeout: 5000 });
      const $d = cheerio.load(dRes.data);
      const epLinks = [];
      $d('a[href*="/nonton/"]').each((i, el) => {
        const href = $d(el).attr('href');
        const text = $d(el).text().trim();
        if (href && !epLinks.some(x => x.href === href)) {
          epLinks.push({ text, href });
        }
      });
      console.log('Episodes found:', epLinks.length);

      // Find matching episode
      let matchedEp = epLinks.find(e => {
        const num = e.text.match(/\d+/)?.[0] || e.href.match(/episode-(\d+)/)?.[1];
        return String(num) === String(ep);
      }) || epLinks[epLinks.length - 1];

      if (matchedEp) {
        console.log('Fetching watch page:', matchedEp.href);
        const epRes = await axios.get(matchedEp.href, { httpsAgent: agent, headers, timeout: 5000 });
        const $ep = cheerio.load(epRes.data);
        const streams = [];
        $ep('iframe').each((i, el) => {
          streams.push($ep(el).attr('src') || $ep(el).attr('data-src'));
        });
        console.log('STREAMS FOUND:', streams);
        return streams;
      }
    }
  } catch (err) {
    console.error('Samehadaku error:', err.message);
  }
  return [];
}

async function testOtakudesuStream(query, ep = 1) {
  console.log(`\n=== OTAKUDESU STREAM SEARCH: "${query}" (Ep ${ep}) ===`);
  const mirrors = ['https://otakudesu.cloud', 'https://otakudesu.best', 'https://otakudesu.cam'];
  for (const m of mirrors) {
    try {
      const searchUrl = `${m}/?s=${encodeURIComponent(query)}&post_type=anime`;
      console.log('Searching Otakudesu:', searchUrl);
      const res = await axios.get(searchUrl, { httpsAgent: agent, headers, timeout: 5000 });
      const $ = cheerio.load(res.data);
      const items = [];
      $('ul.chlist li a, .venz a, .jdlflm a').each((i, el) => {
        const h = $(el).attr('href');
        const t = $(el).text().trim();
        if (h && h.includes('/anime/') && !items.some(x => x.h === h)) {
          items.push({ t, h });
        }
      });
      console.log(`Found on ${m}:`, items.slice(0, 3));
      if (items.length > 0) {
        const dRes = await axios.get(items[0].h, { httpsAgent: agent, headers, timeout: 5000 });
        const $d = cheerio.load(dRes.data);
        const epList = [];
        $d('.episodelist a, a[href*="/episode/"]').each((i, el) => {
          const href = $d(el).attr('href');
          const text = $d(el).text().trim();
          if (href && !epList.some(x => x.href === href)) {
            epList.push({ text, href });
          }
        });
        console.log('Otakudesu episodes:', epList.length);
        if (epList.length > 0) {
          const epUrl = epList[epList.length - 1].href;
          console.log('Fetching Otakudesu ep:', epUrl);
          const epRes = await axios.get(epUrl, { httpsAgent: agent, headers, timeout: 5000 });
          const $ep = cheerio.load(epRes.data);
          const iframes = [];
          $ep('iframe').each((i, el) => {
            iframes.push($ep(el).attr('src') || $ep(el).attr('data-src'));
          });
          console.log('OTAKUDESU IFRAMES:', iframes);
          return iframes;
        }
      }
    } catch (e) {
      console.log(`Otakudesu mirror ${m} failed:`, e.message);
    }
  }
  return [];
}

async function run() {
  await testSamehadakuStream('kage no jitsuryokusha', 1);
  await testSamehadakuStream('solo leveling', 1);
  await testSamehadakuStream('steel ball run', 1);
}

run().catch(console.error);
