const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
};

async function dumpStructure() {
  const res = await axios.get('https://ww2.samehadaku.pro/nonton/kage-no-jitsuryokusha-ni-naritakute-episode-1-uj79hyf/', { httpsAgent: agent, headers });
  const $ = cheerio.load(res.data);

  console.log('\n--- ALL DIV CLASSES CONTAINING PLAYER / SERVER / DOWNLOAD ---');
  $('div, ul, section, select').each((i, el) => {
    const cls = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    if (cls.includes('player') || cls.includes('server') || cls.includes('stream') || cls.includes('download') || cls.includes('mirror') || id.includes('player') || id.includes('server') || id.includes('stream')) {
      console.log('Match:', el.tagName, 'id:', id, 'class:', cls);
    }
  });

  console.log('\n--- ALL LI / BUTTON / A TEXT AND HREF INSIDE THE MAIN CONTENT ---');
  $('#player, .player-area, .rh_video, #embed_holder, .player_embed').find('iframe, a, button, select').each((i, el) => {
    console.log('Player child:', el.tagName, el.attribs);
  });
}

dumpStructure().catch(console.error);
