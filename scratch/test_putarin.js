const axios = require('axios');
const cheerio = require('cheerio');

async function testPutarin() {
  const testEmbedUrls = [
    'https://putarin.com/e/MZzVd8G3WF',
    'https://puterin.biz/e/d7ZGGNT8Rj',
    'https://putarin.xyz/e/G9dZaHfZ8G',
    'https://playmogo.com/e/ni27cu3o9ne8'
  ];

  for (const embedUrl of testEmbedUrls) {
    try {
      console.log(`\n--- Testing Embed URL: ${embedUrl} ---`);
      const res = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': 'https://samehadaku.pro/'
        },
        timeout: 6000
      });
      console.log('Status:', res.status);
      console.log('Response Headers X-Frame-Options:', res.headers['x-frame-options']);
      console.log('Response Headers CSP:', res.headers['content-security-policy']);
      const $ = cheerio.load(res.data);
      console.log('Page Title:', $('title').text());
      console.log('Video / Source tags:', $('video, source, iframe').length);
      $('script').each((i, el) => {
        const text = $(el).html() || '';
        if (text.includes('jwplayer') || text.includes('player') || text.includes('sources') || text.includes('.mp4') || text.includes('.m3u8')) {
          console.log(` Script ${i} preview:`, text.slice(0, 150));
        }
      });
    } catch (e) {
      console.log('Failed:', e.message, e.response?.status);
    }
  }
}

testPutarin();
