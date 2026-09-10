import axios from 'axios';
import * as cheerio from 'cheerio';

async function searchVariations() {
  const queries = [
    'Omae Gotoki ga Maou',
    'Outo de Kimama ni Kurashitai',
    'Tsuihou sareta node',
    'Omae Gotoki'
  ];

  for (const q of queries) {
    console.log(`\n--- Searching: "${q}" ---`);
    try {
      const res = await axios.get(`https://samehadaku.pro/?s=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(res.data);
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (href.includes('omae') || href.includes('kimama') || href.includes('tsuihou')) {
          console.log(`- [${text}] => ${href}`);
        }
      });
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

searchVariations();
