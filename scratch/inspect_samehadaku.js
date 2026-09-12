const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const res = await axios.get('https://samehadaku.email/genre/action/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    console.log('Title:', $('title').text());
    console.log('Links with /anime/:', $('a[href*="/anime/"]').length);
    $('a[href*="/anime/"]').slice(0, 5).each((i, el) => {
      console.log('Sample a:', $(el).attr('href'), $(el).text().trim());
    });
  } catch (e) {
    console.log('Error:', e.message);
  }
}
test();
