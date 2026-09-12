const axios = require('axios');

async function inspectPutarinCode() {
  try {
    const res = await axios.get('https://puterin.biz/e/d7ZGGNT8Rj', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://ww2.samehadaku.pro/'
      }
    });
    console.log('Full Puterin HTML:');
    console.log(res.data);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectPutarinCode();
