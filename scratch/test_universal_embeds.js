const axios = require('axios');
const cheerio = require('cheerio');

async function testWorkingEmbeds() {
  const testList = [
    'https://vidlink.pro/anime/solo-leveling/1/1',
    'https://vidsrc.in/embed/anime/solo-leveling/1',
    'https://vidsrc.pm/embed/anime/solo-leveling/1',
    'https://vidsrc.net/embed/anime/solo-leveling/1',
    'https://vidsrc.vip/embed/anime/solo-leveling/1',
    'https://multiembed.mov/directstream.php?video_id=solo-leveling&s=1&e=1',
    'https://www.2embed.skin/embed/solo-leveling',
    'https://embed.smashystream.com/playere.php?anime=solo-leveling&episode=1'
  ];

  for (const u of testList) {
    try {
      const res = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        timeout: 4000
      });
      console.log(`[${u}] Status: ${res.status}, Frame-Options: ${res.headers['x-frame-options']}`);
    } catch (e) {
      console.log(`[${u}] Error: ${e.response?.status || e.message}`);
    }
  }
}

testWorkingEmbeds();
