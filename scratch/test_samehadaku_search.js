import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  try {
    const res = await axios.get('https://samehadaku.care/?s=mushoku+tensei', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });
    console.log('Status:', res.status);
    const $ = cheerio.load(res.data);
    $('a[href*="/anime/"]').each((i, el) => {
      console.log($(el).text().trim().replace(/\s+/g, ' ').substring(0, 50), '->', $(el).attr('href'));
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
