const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function run() {
  try {
    const res = await axios.get('https://samehadaku.care/page/2/', { headers });
    console.log("STATUS:", res.status);
    const $ = cheerio.load(res.data);
    const count = $('.post-show ul li').length;
    console.log("Page 2 updates count:", count);
    if (count > 0) {
      console.log("First item on page 2:", $('.post-show ul li').first().find('.entry-title a').text().trim());
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
run();
