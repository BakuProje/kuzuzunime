const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function testWatchPage() {
  try {
    const res = await axios.get('https://samehadaku.pro/', { headers, timeout: 6000 });
    const $ = cheerio.load(res.data);
    const nontonLinks = [];
    $('a[href*="/nonton/"]').each((i, el) => {
      nontonLinks.push($(el).attr('href'));
    });
    console.log('Found nonton links:', nontonLinks.length);

    if (nontonLinks.length > 0) {
      const sampleUrl = nontonLinks[0];
      console.log('Testing sample watch URL:', sampleUrl);

      const watchRes = await axios.get(sampleUrl, { headers, timeout: 6000 });
      const $w = cheerio.load(watchRes.data);
      console.log('Watch Page Title:', $w('title').text());

      console.log('--- Iframes on page ---');
      $w('iframe').each((i, el) => {
        console.log(`iframe ${i}: src="${$w(el).attr('src')}" data-src="${$w(el).attr('data-src')}"`);
      });

      console.log('--- Player Embed Element ---');
      console.log('embed_holder or player element:', $w('#embed_holder, #player, .player_embed, .east_player_option, .player-area').html()?.slice(0, 300));

      console.log('--- Server Buttons / Options ---');
      $w('.server_option, .east_player_option, [data-post], [data-nume], [data-type], select[name="server"] option, .server ul li, #server ul li').each((i, el) => {
        console.log(`Server item: text="${$w(el).text().trim()}" data-post="${$w(el).attr('data-post')}" data-nume="${$w(el).attr('data-nume')}" data-type="${$w(el).attr('data-type')}" data-src="${$w(el).attr('data-src')}"`);
      });

      console.log('--- Script Tags with Ajax / Player Setup ---');
      $w('script').each((i, el) => {
        const text = $w(el).html() || '';
        if (text.includes('player') || text.includes('embed') || text.includes('action:')) {
          console.log('Script excerpt:', text.slice(0, 200));
        }
      });
    }
  } catch (e) {
    console.error('Watch test error:', e.message);
  }
}

testWatchPage();
