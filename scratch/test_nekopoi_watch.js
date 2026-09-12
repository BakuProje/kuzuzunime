const https = require('https');
const axios = require('axios');
const cheerio = require('cheerio');

const dnsCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) return dnsCache.get(hostname);
  const dnsServers = ['8.8.8.8', '1.1.1.1', '9.9.9.9'];
  const agent = new https.Agent({ rejectUnauthorized: false });
  for (const dnsIp of dnsServers) {
    try {
      const hostHeader = dnsIp === '8.8.8.8' ? 'dns.google' : (dnsIp === '1.1.1.1' ? 'cloudflare-dns.com' : 'dns.quad9.net');
      const res = await axios.get(`https://${dnsIp}/resolve?name=${hostname}&type=A`, {
        httpsAgent: agent,
        headers: { 'Host': hostHeader },
        timeout: 2500
      });
      if (res.data && res.data.Answer) {
        const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
        if (ips.length > 0) {
          dnsCache.set(hostname, ips[0]);
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
  if (hostname.includes('nekopoi.care') || hostname.includes('nekopoi.org')) {
    resolveDnsDoH(hostname).then(ip => {
      if (ip) {
        if (options.all) {
          callback(null, [{ address: ip, family: 4 }]);
        } else {
          callback(null, ip, 4);
        }
      } else {
        callback(new Error(`ENOENT: DoH resolution failed for ${hostname}`), null, null);
      }
    }).catch(err => {
      callback(err, null, null);
    });
    return;
  }
  require('dns').lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

async function testNekopoiWatch() {
  try {
    const res = await axios.get('https://nekopoi.care/category/hentai/', {
      httpsAgent: dohAgent,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    const firstPost = $('a.nk-search-item, .result-post a, article a').first().attr('href');
    console.log('Sample Hentai post URL:', firstPost);

    if (firstPost) {
      const postRes = await axios.get(firstPost, {
        httpsAgent: dohAgent,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      });
      const $p = cheerio.load(postRes.data);
      console.log('Hentai Title:', $p('title').text());
      const iframes = $p('iframe').map((i, el) => $p(el).attr('src')).get();
      console.log('Hentai Iframes:', iframes);
    }
  } catch (e) {
    console.error('Nekopoi watch error:', e.message);
  }
}

testNekopoiWatch();
