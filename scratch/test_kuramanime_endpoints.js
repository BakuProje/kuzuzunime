const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const dns = require('dns');

const dohCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dohCache.has(hostname)) return dohCache.get(hostname);
  const dnsServers = ['8.8.8.8', '1.1.1.1', '9.9.9.9'];
  const agent = new https.Agent({ rejectUnauthorized: false });
  for (const dnsIp of dnsServers) {
    try {
      const hostHeader = dnsIp === '8.8.8.8' ? 'dns.google' : (dnsIp === '1.1.1.1' ? 'cloudflare-dns.com' : 'dns.quad9.net');
      const res = await axios.get(`https://${dnsIp}/resolve?name=${hostname}&type=A`, {
        httpsAgent: agent,
        headers: { 'Host': hostHeader },
        timeout: 3000
      });
      if (res.data && res.data.Answer) {
        const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
        if (ips.length > 0) {
          dohCache.set(hostname, ips[0]);
          return ips[0];
        }
      }
    } catch (err) {}
  }
  return null;
}

function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('kuramanime') || hostname.includes('nekopoi') || hostname.includes('nyomo')) {
    resolveDnsDoH(hostname).then(ip => {
      if (ip) {
        if (options.all) {
          callback(null, [{ address: ip, family: 4 }]);
        } else {
          callback(null, ip, 4);
        }
      } else {
        dns.lookup(hostname, options, callback);
      }
    }).catch(err => {
      dns.lookup(hostname, options, callback);
    });
    return;
  }
  dns.lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function testKuramanimeEndpoints() {
  try {
    // 1. Test Latest Ongoing: /anime?order_by=updated / /anime?status=ongoing
    console.log('--- 1. Testing Ongoing / Latest Anime ---');
    const ongoingRes = await axios.get('https://kuramanime.pro/anime?order_by=updated&page=1', {
      httpsAgent: dohAgent,
      headers,
      timeout: 8000
    });
    const $o = cheerio.load(ongoingRes.data);
    console.log('Ongoing items count:', $o('.product__item, .anime__item, .col-lg-4, .col-6').length);
    $o('.product__item, .anime__item').slice(0, 5).each((i, el) => {
      const title = $o(el).find('h5, h6, a').first().text().trim().replace(/\s+/g, ' ');
      const href = $o(el).find('a').attr('href');
      const img = $o(el).find('[data-setbg]').attr('data-setbg') || $o(el).find('img').attr('src');
      const ep = $o(el).find('.ep').text().trim();
      console.log(`[Item ${i}] Title: "${title}" | Link: ${href} | Img: ${img} | Ep: ${ep}`);
    });

    // 2. Test Popular: /anime?order_by=popular
    console.log('\n--- 2. Testing Popular Anime ---');
    const popRes = await axios.get('https://kuramanime.pro/anime?order_by=popular&page=1', {
      httpsAgent: dohAgent,
      headers,
      timeout: 8000
    });
    const $p = cheerio.load(popRes.data);
    console.log('Popular items count:', $p('.product__item, .anime__item').length);
    $p('.product__item, .anime__item').slice(0, 3).each((i, el) => {
      const title = $p(el).find('h5, a').first().text().trim().replace(/\s+/g, ' ');
      console.log(`[Pop ${i}] Title: "${title}" | Link: ${$p(el).find('a').attr('href')}`);
    });

    // 3. Test Schedule: /schedule
    console.log('\n--- 3. Testing Schedule / Properties ---');
    try {
      const schedRes = await axios.get('https://kuramanime.pro/schedule', {
        httpsAgent: dohAgent,
        headers,
        timeout: 8000
      });
      const $sc = cheerio.load(schedRes.data);
      console.log('Schedule status:', schedRes.status, 'Title:', $sc('title').text());
    } catch (schedErr) {
      console.log('Schedule failed:', schedErr.message);
    }

    // 4. Test Episode Links in Detail Page
    console.log('\n--- 4. Detail & Episode HTML breakdown ---');
    const detailRes = await axios.get('https://kuramanime.pro/anime/2475/ore-dake-level-up-na-ken', {
      httpsAgent: dohAgent,
      headers,
      timeout: 8000
    });
    const $d = cheerio.load(detailRes.data);
    console.log('All links inside detail page:');
    $d('a').each((i, el) => {
      const href = $d(el).attr('href') || '';
      if (href.includes('/episode') || href.includes('/ep/') || href.includes('watch') || href.includes('play')) {
        console.log(` Ep link: text="${$d(el).text().trim()}" href="${href}"`);
      }
    });

    console.log('All IDs and classes in detail page:');
    $d('[id*="episode"], [class*="episode"], [id*="list"], [class*="list"]').each((i, el) => {
      const id = $d(el).attr('id');
      const cls = $d(el).attr('class');
      console.log(` container: id="${id}" class="${cls}" tag="${el.tagName}"`);
    });

  } catch (e) {
    console.error('Endpoints test error:', e.message);
  }
}

testKuramanimeEndpoints();
