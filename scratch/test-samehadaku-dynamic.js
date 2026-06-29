const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://samehadaku.care/'
};

async function run() {
  try {
    // 1. Get active domain from Puruboy Home API
    const homeRes = await axios.get('https://puruboy-api.vercel.app/api/anime/samehadaku/home');
    const firstUpdate = homeRes.data?.result?.latestUpdates?.[0];
    if (!firstUpdate || !firstUpdate.original_url) {
      console.log("Could not resolve active domain from Puruboy API.");
      return;
    }
    
    const urlObj = new URL(firstUpdate.original_url);
    const activeDomain = urlObj.origin + '/';
    console.log("ACTIVE DOMAIN:", activeDomain);
    
    // 2. Fetch page 2 of updates
    const pageUrl = `${activeDomain}page/2/`;
    console.log("FETCHING PAGE 2:", pageUrl);
    
    const res = await axios.get(pageUrl, { headers });
    console.log("STATUS:", res.status);
    
    const $ = cheerio.load(res.data);
    const updates = [];
    
    $('.post-show ul li').each((i, el) => {
      const $el = $(el);
      const originalUrl = $el.find('.entry-title a').attr('href');
      updates.push({
        title: $el.find('.entry-title a').text().trim(),
        original_url: originalUrl,
        episode: $el.find('.dtla span:nth-child(2) author').text().trim() || $el.find('.dtla span:nth-child(2)').text().trim(),
        posted_by: $el.find('.author author').text().trim(),
        released: $el.find('.dtla span:last-child').text().replace(/Released on:/gi, '').trim(),
        thumbnail: $el.find('.thumb img').attr('src')
      });
    });
    
    console.log("Found updates on page 2:", updates.length);
    if (updates.length > 0) {
      console.log("First item on page 2:", updates[0]);
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
run();
