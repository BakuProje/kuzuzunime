const axios = require('axios');
const https = require('https');
const dns = require('dns');

async function resolveDnsDoH(hostname) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get(`https://8.8.8.8/resolve?name=${hostname}&type=A`, {
      httpsAgent: agent,
      headers: { 'Host': 'dns.google' },
      timeout: 3000
    });
    if (res.data && res.data.Answer) {
      const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
      if (ips.length > 0) return ips[0];
    }
  } catch (err) {}
  return null;
}

async function testDoHDomains() {
  const hosts = [
    'ww2.samehadaku.pro',
    'samehadaku.care',
    'samehadaku.how',
    'otakudesu.cloud',
    'otakudesu.best',
    'otakudesu.cam',
    'animeindo.bz',
    'anoboy.show'
  ];

  for (const h of hosts) {
    const ip = await resolveDnsDoH(h);
    console.log(`Host: ${h} -> DoH IP: ${ip || 'NONE'}`);
    if (ip) {
      const dohAgent = new https.Agent({
        lookup: (hostname, opt, cb) => {
          if (typeof opt === 'function') { cb = opt; opt = {}; }
          if (opt && opt.all) cb(null, [{ address: ip, family: 4 }]);
          else cb(null, ip, 4);
        },
        rejectUnauthorized: false
      });

      try {
        const res = await axios.get(`https://${h}/`, { httpsAgent: dohAgent, timeout: 3500 });
        console.log(`  [SUCCESS HTTP 200] https://${h}/ -> Title: ${res.data.match(/<title>([^<]+)<\/title>/i)?.[1]}`);
      } catch (err) {
        console.log(`  [FAIL HTTP] https://${h}/ -> ${err.message}`);
      }
    }
  }
}

testDoHDomains().catch(console.error);
