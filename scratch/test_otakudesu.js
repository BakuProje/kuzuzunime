const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({
  lookup: (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    let ip = '104.21.72.29';
    if (options && options.all) callback(null, [{ address: ip, family: 4 }]);
    else callback(null, ip, 4);
  },
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function testOtakudesu(query) {
  console.log(`Searching Otakudesu: https://otakudesu.best/?s=${encodeURIComponent(query)}&post_type=anime`);
  const res = await axios.get(`https://otakudesu.best/?s=${encodeURIComponent(query)}&post_type=anime`, { httpsAgent: agent, headers, timeout: 5000 });
  const $ = cheerio.load(res.data);
  console.log('Search page title:', $('title').text());
  
  const results = [];
  $('ul.chivsrc li, .venz li').each((i, el) => {
    const a = $(el).find('h2 a').first();
    results.push({
      title: a.text().trim(),
      href: a.attr('href'),
      img: $(el).find('img').attr('src')
    });
  });
  console.log('Results:', results);

  if (results.length > 0) {
    console.log('\nFetching detail page:', results[0].href);
    const dRes = await axios.get(results[0].href, { httpsAgent: agent, headers, timeout: 5000 });
    const $d = cheerio.load(dRes.data);
    const eps = [];
    $d('.episodelist ul li span a').each((i, el) => {
      eps.push({ text: $(el).text().trim(), href: $(el).attr('href') });
    });
    console.log('Episodes count:', eps.length, 'Sample:', eps.slice(0, 3));

    if (eps.length > 0) {
      console.log('\nFetching episode watch page:', eps[eps.length - 1].href);
      const epRes = await axios.get(eps[eps.length - 1].href, { httpsAgent: agent, headers, timeout: 5000 });
      const $ep = cheerio.load(epRes.data);
      console.log('Episode Title:', $ep('title').text());
      $ep('iframe').each((i, el) => {
        console.log('iframe:', $ep(el).attr('src') || $ep(el).attr('data-src'));
      });
      $ep('.responsive-embed-stream iframe, .player-embed iframe, #embed_holder iframe').each((i, el) => {
        console.log('Stream iframe:', $ep(el).attr('src'));
      });
    }
  }
}

testOtakudesu('bocchi').catch(console.error);
