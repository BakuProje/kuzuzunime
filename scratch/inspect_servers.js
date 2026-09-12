const axios = require('axios');
const cheerio = require('cheerio');

async function inspectNontonPage() {
  const url = 'https://ww2.samehadaku.pro/nonton/kimetsu-no-yaiba-episode-1-4ng63sx/';
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    timeout: 8000
  });
  const $ = cheerio.load(res.data);
  console.log('Title:', $('title').text());
  
  console.log('--- All a href links ---');
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('drive') || href.includes('mega') || href.includes('file') || href.includes('stream') || href.includes('embed') || href.includes('player') || href.includes('putarin') || href.includes('puterin') || href.includes('zippy') || href.includes('pixeldrain') || href.includes('kraken')) {
      console.log(`Link: text="${text}", href="${href}"`);
    }
  });

  console.log('--- All select / option elements ---');
  $('select option, .server_option, [data-post]').each((i, el) => {
    console.log(`Option: text="${$(el).text().trim()}", value="${$(el).attr('value')}", data-post="${$(el).attr('data-post')}"`);
  });

  console.log('--- Download Box .download-eps, .mctnx, .download ---');
  $('.download-eps, .mctnx, .download, .smokeurl').each((i, el) => {
    console.log('Download block:', $(el).text().slice(0, 200));
  });
}

inspectNontonPage();
