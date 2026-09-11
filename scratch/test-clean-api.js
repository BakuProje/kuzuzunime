import { animeterbaru, search, getAnimePoster } from '../lib/scraper.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function testCleanApi() {
  console.log('--- Testing animeterbaru (Latest) ---');
  const t0 = Date.now();
  const latest = await animeterbaru(1);
  console.log(`[${Date.now() - t0}ms] Latest items: ${latest.length}`);
  
  console.log('\n--- Testing popular scraper ---');
  const t1 = Date.now();
  const res = await axios.get('https://samehadaku.pro/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 5000
  });
  const $ = cheerio.load(res.data);
  const popular = [];
  const seen = new Set();
  $('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href || href.includes('anime-list') || seen.has(href)) return;
    if (!href.includes('/anime/')) return;
    seen.add(href);

    const title = $(el).find('.sh-nm').text().trim() || $(el).find('.j').text().trim() || $(el).text().trim();
    let image = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
    if (image.includes('placeholder.svg')) image = '';

    const eps = $(el).find('.jarvis-eps').text().trim() || 'Ongoing';
    const score = $(el).find('.sh-rate').text().replace(/[★\s]/g, '').trim() || '8.5';

    if (title && title.length > 1) {
      popular.push({
        title,
        image: image || '/placeholder.jpg',
        score,
        episode: eps,
        status: eps.toLowerCase().includes('tamat') ? 'Completed' : 'Ongoing',
        type: 'TV',
        url: href.startsWith('http') ? href.replace(/^https?:\/\/[^\/]+/, '') : href
      });
    }
  });
  console.log(`[${Date.now() - t1}ms] Popular items: ${popular.length}`);
}

testCleanApi();
