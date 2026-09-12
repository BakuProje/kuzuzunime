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

async function inspectWatchPlayer() {
  const watchUrl = 'https://kuramanime.pro/anime/2475/ore-dake-level-up-na-ken/episode/1';
  const res = await axios.get(watchUrl, { httpsAgent: dohAgent, headers, timeout: 8000 });
  const $ = cheerio.load(res.data);

  console.log('--- Video / Player Section in Watch Page ---');
  console.log('player element html:', $('#player, #video-player, .anime__video__player, .player').html()?.slice(0, 500));
  
  console.log('\n--- Server selector / options ---');
  $('select, .server, #changeServer, .server-selector, [data-server]').each((i, el) => {
    console.log(`server el ${i}: tag=${el.tagName} id=${$(el).attr('id')} class=${$(el).attr('class')} html=${$(el).html()?.slice(0, 200)}`);
  });

  console.log('\n--- Script tags in Watch Page ---');
  $('script').each((i, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('player') || txt.includes('video') || txt.includes('source') || txt.includes('kura') || txt.includes('hls') || txt.includes('m3u8') || txt.includes('eval')) {
      console.log(`\nScript ${i} (length ${txt.length}):`, txt.slice(0, 500));
    }
  });
}

inspectWatchPlayer();
