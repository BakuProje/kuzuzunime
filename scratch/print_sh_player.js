const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });
async function run() {
  const res = await axios.get('https://ww2.samehadaku.pro/nonton/kage-no-jitsuryokusha-ni-naritakute-episode-1-uj79hyf/', { httpsAgent: agent });
  const $ = cheerio.load(res.data);
  console.log('--- .sh-player HTML ---');
  console.log($('.sh-player').html());

  console.log('\n--- ALL IFRAME ATTRIBUTES ---');
  $('iframe').each((i, el) => {
    console.log(el.attribs);
  });
}
run().catch(console.error);
