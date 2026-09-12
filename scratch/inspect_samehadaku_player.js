const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function inspectWatchPage(url) {
  console.log('Fetching:', url);
  const res = await axios.get(url, { httpsAgent: agent, headers, timeout: 5000 });
  const $ = cheerio.load(res.data);
  
  console.log('\n--- ALL IFRAMES ---');
  $('iframe').each((i, el) => {
    console.log(`iframe ${i}:`, {
      src: $(el).attr('src'),
      'data-src': $(el).attr('data-src'),
      'data-litespeed-src': $(el).attr('data-litespeed-src'),
      attribs: el.attribs
    });
  });

  console.log('\n--- ALL SELECT / SERVER OPTIONS ---');
  $('select option, .server-option, #selectserver option, ul.server-list li, .player-option').each((i, el) => {
    console.log(`option ${i}:`, {
      text: $(el).text().trim(),
      value: $(el).attr('value'),
      'data-post': $(el).attr('data-post'),
      'data-numpost': $(el).attr('data-numpost'),
      'data-type': $(el).attr('data-type'),
      attribs: el.attribs
    });
  });

  console.log('\n--- ALL INLINE SCRIPTS (SERVER / STREAM RELATED) ---');
  $('script').each((i, el) => {
    const html = $(el).html() || '';
    if (html.includes('embed') || html.includes('iframe') || html.includes('player') || html.includes('putarin') || html.includes('server')) {
      console.log(`Script excerpt ${i}:`, html.substring(0, 300));
    }
  });
}

inspectWatchPage('https://ww2.samehadaku.pro/nonton/kage-no-jitsuryokusha-ni-naritakute-episode-1-uj79hyf/').catch(console.error);
