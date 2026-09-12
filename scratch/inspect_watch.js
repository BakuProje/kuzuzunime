const axios = require('axios');
const cheerio = require('cheerio');

async function testWatch() {
  // Let's test a real anime watch slug from latest
  try {
    const latestRes = await axios.get('https://samehadaku.email/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const $ = cheerio.load(latestRes.data);
    const firstWatchHref = $('a[href*="/nonton/"]').first().attr('href');
    console.log('Sample watch URL from latest:', firstWatchHref);

    if (firstWatchHref) {
      const watchUrl = firstWatchHref.startsWith('http') ? firstWatchHref : `https://samehadaku.email${firstWatchHref}`;
      const pageRes = await axios.get(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        timeout: 8000
      });
      const $w = cheerio.load(pageRes.data);
      console.log('Page Title:', $w('title').text());
      console.log('All iframes:');
      $w('iframe').each((i, el) => {
        console.log(`iframe ${i}: src="${$w(el).attr('src')}" data-src="${$w(el).attr('data-src')}" data-litespeed-src="${$w(el).attr('data-litespeed-src')}"`);
      });

      console.log('All player options / server buttons / embed containers:');
      console.log('player div:', $w('#player, #embed_holder, .player_embed, .east_player_option, #server, .server_option, .server, #select-server, select[name="server"]').length);

      $w('.server_option, .east_player_option, .server, #select-server option, select option, [data-post], [data-nume], [data-type]').each((i, el) => {
        console.log(`server item ${i}: text="${$w(el).text().trim()}", data-post="${$w(el).attr('data-post')}", data-nume="${$w(el).attr('data-nume')}", data-type="${$w(el).attr('data-type')}", value="${$w(el).attr('value')}", data-src="${$w(el).attr('data-src')}"`);
      });

      console.log('Download links or video elements:');
      $w('.download-eps a, .download a, .mctnx a, a[href*="drive.google"], a[href*="mega.nz"], a[href*="files.im"]').slice(0, 5).each((i, el) => {
        console.log('Download a:', $w(el).text().trim(), $w(el).attr('href'));
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testWatch();
