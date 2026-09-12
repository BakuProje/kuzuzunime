const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function inspectKuramanime() {
  try {
    console.log('--- Fetching Kuramanime Home: https://kuramanime.pro ---');
    const res = await axios.get('https://kuramanime.pro/', { headers, timeout: 8000 });
    console.log('Status:', res.status);
    const $ = cheerio.load(res.data);
    console.log('Title:', $('title').text());

    console.log('\n--- Inspecting Sections / Links ---');
    $('a').slice(0, 30).each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (href && (href.includes('/anime/') || href.includes('/watch/') || href.includes('/episode/') || href.includes('properties/'))) {
        console.log(`Link: text="${text.slice(0, 30)}" href="${href}"`);
      }
    });

    console.log('\n--- Card Selectors ---');
    console.log('anime items count (.product__item, .col-lg-4, article, etc.):');
    console.log('.product__item:', $('.product__item').length);
    console.log('.col-lg-4:', $('.col-lg-4').length);
    console.log('.col-md-6:', $('.col-md-6').length);
    console.log('.col-6:', $('.col-6').length);
    console.log('.anime__item, .card, article:', $('.anime__item, .card, article').length);

    $('.product__item, .anime__item, .col-6, .col-lg-4').slice(0, 3).each((i, el) => {
      console.log(`Item ${i}: HTML snippet:`, $(el).html()?.slice(0, 300));
    });

  } catch (e) {
    console.error('Error fetching Kuramanime:', e.message);
  }
}

inspectKuramanime();
