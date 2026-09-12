const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
};

async function testYomiEp2() {
  console.log('Fetching Yomi No Tsugai detail: https://ww2.samehadaku.pro/anime/yomi-no-tsugai-93qynpg/');
  const res = await axios.get('https://ww2.samehadaku.pro/anime/yomi-no-tsugai-93qynpg/', { httpsAgent: agent, headers });
  const $ = cheerio.load(res.data);
  const epLinks = [];
  $('a[href*="/nonton/"]').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href) epLinks.push({ text, href });
  });

  console.log(`Found ${epLinks.length} episodes for Yomi No Tsugai:`, epLinks);

  // Match episode 2
  const ep2 = epLinks.find(e => e.text.includes(' 2') || e.text.includes('Episode 2') || e.href.includes('episode-2'));
  if (ep2) {
    console.log('Fetching Episode 2 watch page:', ep2.href);
    const epRes = await axios.get(ep2.href, { httpsAgent: agent, headers });
    const $ep = cheerio.load(epRes.data);
    const streams = [];
    $ep('iframe').each((i, el) => {
      streams.push($ep(el).attr('src'));
    });
    console.log('STREAMS FOUND FOR DAEMONS / YOMI NO TSUGAI EP 2:', streams);
  }
}

testYomiEp2().catch(console.error);
