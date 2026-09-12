const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (h, opt, cb) => {
    if (typeof opt === 'function') { cb = opt; opt = {}; }
    let ip = '172.67.179.173';
    if (opt && opt.all) cb(null, [{ address: ip, family: 4 }]);
    else cb(null, ip, 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function testKuraEmbed() {
  const res = await axios.get('https://kuramanime.pro/anime/4624/baby-music/episode/1', { httpsAgent: agent, headers, timeout: 6000 });
  const $ = cheerio.load(res.data);
  console.log('HTML len:', res.data.length);
  console.log('Video element:', $('video').html());
  console.log('Source element:', $('source').attr('src'));
  
  // Search for any embed/stream links in the html
  const matches = res.data.match(/https?:\/\/[^"'\s\)]+\.(?:mp4|m3u8|webm)/gi);
  console.log('Direct video stream matches:', matches);

  const embedMatches = res.data.match(/https?:\/\/[^"'\s\)]+(?:embed|player|stream|drive|filemoon|mega|dood)[^"'\s\)]*/gi);
  console.log('Embed matches:', embedMatches?.slice(0, 10));
}

testKuraEmbed().catch(console.error);
