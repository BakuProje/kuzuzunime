const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    let ip = '172.67.179.173';
    if (options && options.all) callback(null, [{ address: ip, family: 4 }]);
    else callback(null, ip, 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function inspectKuramanimeWatch(path) {
  console.log(`Fetching Kuramanime watch page: https://kuramanime.pro${path}`);
  const res = await axios.get(`https://kuramanime.pro${path}`, { httpsAgent: agent, headers, timeout: 6000 });
  const $ = cheerio.load(res.data);
  console.log('Title:', $('title').text());

  console.log('\n--- IFRAMES ---');
  $('iframe').each((i, el) => {
    console.log('iframe:', $(el).attr('src') || $(el).attr('data-src'));
  });

  console.log('\n--- VIDEO / PLAYER / SOURCE ELEMENTS ---');
  $('video, source, #player, .player, [data-src], select option').each((i, el) => {
    console.log('Tag:', el.tagName, 'attrs:', el.attribs, 'text:', $(el).text().trim());
  });

  console.log('\n--- SCRIPT SCRAPS ---');
  $('script').each((i, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('player') || txt.includes('iframe') || txt.includes('kuro') || txt.includes('stream') || txt.includes('embed') || txt.includes('source')) {
      console.log('Script excerpt:', txt.substring(0, 300));
    }
  });
}

inspectKuramanimeWatch('/anime/4624/baby-music/episode/1').catch(console.error);
