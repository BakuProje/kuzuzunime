const axios = require('axios');
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
  'Accept': '*/*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function inspectJs() {
  try {
    const res = await axios.get('https://kuramanime.pro/assets/page-js/min/anime-episode.min.js?v=420', {
      httpsAgent: dohAgent,
      headers,
      timeout: 8000
    });
    console.log('Script Length:', res.data.length);
    // Find all URL/ajax/fetch endpoints in the js
    const matches = res.data.match(/(\/[a-zA-Z0-9_\-\.\/]+|https?:\/\/[a-zA-Z0-9_\-\.\/]+)/g) || [];
    console.log('URLs/Endpoints inside anime-episode.min.js:');
    const unique = [...new Set(matches.filter(m => m.length > 4 && (m.includes('anime') || m.includes('api') || m.includes('episode') || m.includes('stream') || m.includes('server'))))];
    unique.forEach(u => console.log(' ->', u));
    
    console.log('\nSample JS with ajax/fetch:');
    const lines = res.data.split(';');
    lines.filter(l => l.includes('ajax') || l.includes('fetch') || l.includes('post') || l.includes('get')).slice(0, 10).forEach(l => console.log('Snippet:', l.slice(0, 200)));

  } catch (e) {
    console.error('JS inspect error:', e.message);
  }
}

inspectJs();
