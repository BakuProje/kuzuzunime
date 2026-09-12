const axios = require('axios');
const cheerio = require('cheerio');

async function testDetailAndWatch() {
  try {
    // 1. Get latest
    const res = await axios.get('https://samehadaku.pro/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    const nontonList = [];
    $('a[href*="/nonton/"]').slice(0, 5).each((i, el) => {
      nontonList.push({
        title: $(el).text().trim(),
        href: $(el).attr('href')
      });
    });

    console.log('Latest Episodes from samehadaku.pro:');
    for (const item of nontonList) {
      console.log('--- Testing Watch:', item.title, item.href);
      const watchRes = await axios.get(item.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        timeout: 6000
      });
      const $w = cheerio.load(watchRes.data);
      const iframes = $w('iframe').map((i, el) => $w(el).attr('src') || $w(el).attr('data-src')).get().filter(Boolean);
      console.log('Iframes found:', iframes);
      
      // Check server elements
      const servers = [];
      $w('#server ul li div, .server_option, .east_player_option, select option, #select-server option, [data-post], [data-nume], [data-type], [data-src]').each((i, el) => {
        servers.push({
          text: $w(el).text().trim(),
          post: $w(el).attr('data-post'),
          nume: $w(el).attr('data-nume'),
          type: $w(el).attr('data-type'),
          src: $w(el).attr('data-src') || $w(el).attr('value')
        });
      });
      console.log('Server items found:', servers.length, servers.slice(0, 3));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testDetailAndWatch();
