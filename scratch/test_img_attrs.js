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

async function testImgAttrs() {
  const res = await axios.get('https://ww2.samehadaku.pro/', {
    httpsAgent: agent,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  $('img').slice(0, 10).each((i, el) => {
    console.log(`Img ${i}:`, el.attribs);
  });
}

testImgAttrs().catch(console.error);
