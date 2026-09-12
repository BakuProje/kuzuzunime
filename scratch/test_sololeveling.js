const axios = require('axios');
const cheerio = require('cheerio');

async function testSearch(q) {
  const res = await axios.get(`https://ww2.samehadaku.pro/?s=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  console.log(`\nSearch "${q}" found:`);
  $('article a, .animpost a, a[href*="/anime/"]').each((i, el) => {
    console.log(' ->', $(el).attr('href'), $(el).text().trim().slice(0, 50));
  });
}

async function run() {
  await testSearch('Solo Leveling');
  await testSearch('Ore dake Level Up');
}
run();
