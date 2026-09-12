import dns from 'dns';
import https from 'https';
import axios from 'axios';

const dnsCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) {
    return dnsCache.get(hostname);
  }
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
  resolveDnsDoH(hostname).then(ip => {
    if (ip) {
      if (options && options.all) {
        callback(null, [{ address: ip, family: 4 }]);
      } else {
        callback(null, ip, 4);
      }
    } else {
      dns.lookup(hostname, options, callback);
    }
  }).catch(() => {
    dns.lookup(hostname, options, callback);
  });
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl || targetUrl.trim() === '') {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/placeholder.jpg' }
    });
  }

  let cleanUrl = targetUrl.trim();
  if (cleanUrl.startsWith('//')) {
    cleanUrl = `https:${cleanUrl}`;
  }

  if (cleanUrl.startsWith('/')) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': cleanUrl }
    });
  }

  try {
    const urlObj = new URL(cleanUrl);
    const referer = `${urlObj.protocol}//${urlObj.hostname}/`;

    const response = await axios.get(cleanUrl, {
      responseType: 'arraybuffer',
      httpsAgent: dohAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 5000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';

    return new Response(response.data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
      }
    });
  } catch (err) {
    // Graceful fallback to redirect or placeholder without breaking the UI with 500 error
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/placeholder.jpg',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
}
