const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (h, opt, cb) => {
    if (typeof opt === 'function') { cb = opt; opt = {}; }
    if (opt && opt.all) cb(null, [{ address: '104.21.89.196', family: 4 }]);
    else cb(null, '104.21.89.196', 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const musicAnimeList = [
  'Bocchi the Rock',
  'K-On',
  'Bang Dream',
  'Love Live',
  'Oshi no Ko',
  'Vivy',
  'Beck',
  'Given',
  'Idolish7',
  'Carole & Tuesday',
  'Detroit Metal City',
  'Ya Boy Kongming',
  'Shigatsu wa Kimi no Uso'
];

async function testMusicList() {
  for (const name of musicAnimeList) {
    const q = name.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const url = `https://ww2.samehadaku.pro/?s=${encodeURIComponent(q)}`;
    try {
      const res = await axios.get(url, { httpsAgent: agent, headers, timeout: 4000 });
      const $ = cheerio.load(res.data);
      const links = [];
      $('a[href*="/anime/"]').each((i, el) => {
        links.push({
          title: $(el).text().trim().replace(/\s+/g, ' '),
          href: $(el).attr('href')
        });
      });
      console.log(`[${name}] -> Found ${links.length} results:`, links.slice(0, 2));
    } catch (e) {
      console.log(`[${name}] -> ERR: ${e.message}`);
    }
  }
}

testMusicList().catch(console.error);
