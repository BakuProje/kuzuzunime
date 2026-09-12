const axios = require('axios');
const cheerio = require('cheerio');

async function testEmbedHeaders() {
  const urls = [
    'https://vidsrc.cc/v2/embed/anime/solo-leveling/1',
    'https://autoembed.co/anime/imdb/solo-leveling-1',
    'https://puterin.biz/e/d7ZGGNT8Rj',
    'https://putarin.com/e/MZzVd8G3WF',
    'https://2embed.cc/embed/solo-leveling/1',
    'https://player.vidsrc.nl/embed/anime/solo-leveling/1',
    'https://playmogo.com/e/ni27cu3o9ne8',
    'https://streampoi.com/embed-dfh8pt1obycc.html'
  ];

  for (const u of urls) {
    try {
      const res = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': 'https://zunime.vercel.app/'
        },
        timeout: 5000,
        maxRedirects: 5
      });
      console.log(`[${u}] Status: ${res.status}`);
      console.log('  x-frame-options:', res.headers['x-frame-options']);
      console.log('  content-security-policy:', res.headers['content-security-policy']?.slice(0, 100));
      console.log('  final url:', res.request?.res?.responseUrl || u);
      console.log('  body length:', res.data?.length);
    } catch (e) {
      console.log(`[${u}] Error: ${e.response?.status || e.message}`);
    }
  }
}

testEmbedHeaders();
