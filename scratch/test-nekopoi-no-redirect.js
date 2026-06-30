const axios = require('axios');
const https = require('https');

async function resolveDns(hostname) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get(`https://8.8.8.8/resolve?name=${hostname}&type=A`, {
      httpsAgent: agent,
      headers: { 'Host': 'dns.google' }
    });
    if (res.data && res.data.Answer) {
      return res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
    }
    return [];
  } catch (err) {
    return [];
  }
}

async function run() {
  const hostname = 'nekopoi.care';
  const ips = await resolveDns(hostname);
  if (ips.length === 0) {
    console.log("DNS fail");
    return;
  }
  const ip = ips[0];
  const url = `https://${ip}/`;
  const agent = new https.Agent({
    servername: hostname,
    rejectUnauthorized: false
  });

  try {
    const res = await axios.get(url, {
      headers: {
        'Host': hostname,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      httpsAgent: agent,
      maxRedirects: 0,
      validateStatus: () => true
    });
    console.log("STATUS:", res.status);
    console.log("HEADERS:", res.headers);
    console.log("DATA SUBSTRING:", String(res.data).substring(0, 1000));
  } catch (err) {
    console.error("FAIL:", err.message);
  }
}

run();
