const axios = require('axios');
const cheerio = require('cheerio');

async function testSearchMatching(query) {
  try {
    const res = await axios.get(`https://samehadaku.pro/?s=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $('article, .animpost, a[href*="/nonton/"], a[href*="/anime/"]').each((i, el) => {
      const href = $(el).attr('href') || $(el).find('a').attr('href');
      const title = $(el).find('.title, h2, h3').text().trim() || $(el).text().trim();
      if (href && !results.some(r => r.href === href)) {
        results.push({ title, href });
      }
    });
    console.log(`[Search Samehadaku: "${query}"] Found ${results.length} items`);
    results.slice(0, 3).forEach(r => console.log(' ->', r.title, r.href));
  } catch (e) {
    console.log(`[Search "${query}"] Error:`, e.message);
  }
}

async function run() {
  await testSearchMatching('Solo Leveling Episode 1');
  await testSearchMatching('One Piece 1120');
  await testSearchMatching('Chainsaw Man Episode 1');
  await testSearchMatching('Kimetsu no Yaiba');
  await testSearchMatching('Jujutsu Kaisen');
}

run();
