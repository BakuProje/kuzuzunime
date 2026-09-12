const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function inspectFullPage() {
  const res = await axios.get('https://ww2.samehadaku.pro/nonton/kage-no-jitsuryokusha-ni-naritakute-episode-1-uj79hyf/', { httpsAgent: agent, headers });
  const $ = cheerio.load(res.data);
  
  console.log('\n--- ALL ELEMENTS WITH data- OR value ATTRIBUTES ---');
  $('[data-post], [data-numpost], [data-type], [data-id], .server-item, .mirror-item, select option, ul li a').each((i, el) => {
    const txt = $(el).text().trim();
    if (txt.toLowerCase().includes('server') || txt.toLowerCase().includes('720') || txt.toLowerCase().includes('1080') || txt.toLowerCase().includes('480') || txt.toLowerCase().includes('hd') || $(el).attr('data-post')) {
      console.log('Element:', el.tagName, 'attrs:', el.attribs, 'text:', txt);
    }
  });

  console.log('\n--- ALL DOWNLOAD / MIRROR LINKS ---');
  $('.download-eps a, .mkv a, .mp4 a, a[href*="drive"], a[href*="mega"], a[href*="filemoon"], a[href*="kraken"]').each((i, el) => {
    console.log('Download link:', $(el).text().trim(), 'href:', $(el).attr('href'));
  });
}

inspectFullPage().catch(console.error);
