import axios from 'axios';

async function testDomains() {
  const domains = [
    'https://samehadaku.pro/',
    'https://samehadaku.email/',
    'https://samehadaku.care/',
    'https://corsproxy.io/?url=' + encodeURIComponent('https://samehadaku.pro/'),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://samehadaku.pro/')
  ];

  for (const d of domains) {
    const start = Date.now();
    try {
      const res = await axios.get(d, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        timeout: 6000
      });
      console.log(`[${Date.now() - start}ms] SUCCESS: ${d.slice(0, 45)} -> Status ${res.status}, size: ${res.data?.length}`);
    } catch (e) {
      console.log(`[${Date.now() - start}ms] FAIL: ${d.slice(0, 45)} -> ${e.message}`);
    }
  }
}
testDomains();
