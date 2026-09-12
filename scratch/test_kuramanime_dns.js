const axios = require('axios');
const https = require('https');

async function testDoH(domain) {
  const dnsServers = ['8.8.8.8', '1.1.1.1', '9.9.9.9'];
  const agent = new https.Agent({ rejectUnauthorized: false });
  for (const dnsIp of dnsServers) {
    try {
      const hostHeader = dnsIp === '8.8.8.8' ? 'dns.google' : (dnsIp === '1.1.1.1' ? 'cloudflare-dns.com' : 'dns.quad9.net');
      const res = await axios.get(`https://${dnsIp}/resolve?name=${domain}&type=A`, {
        httpsAgent: agent,
        headers: { 'Host': hostHeader },
        timeout: 3000
      });
      if (res.data && res.data.Answer) {
        const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
        if (ips.length > 0) {
          console.log(`[DoH ${dnsIp}] ${domain} ->`, ips);
          return ips[0];
        }
      }
    } catch (e) {
      console.log(`[DoH ${dnsIp}] ${domain} failed:`, e.message);
    }
  }
  console.log(`[DoH] ${domain} -> No DNS records found`);
  return null;
}

async function run() {
  const domains = [
    'kuramanime.pro',
    'kuramanime.org',
    'kuramanime.vip',
    'kuramanime.net',
    'kuramanime.run',
    'kuramanime.top',
    'kuramanime.me',
    'kuramanime.xyz',
    'v7.kuramanime.run',
    'kuramanime.buzz'
  ];
  for (const d of domains) {
    await testDoH(d);
  }
}

run();
