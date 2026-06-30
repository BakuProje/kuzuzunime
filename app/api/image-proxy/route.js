import { NextResponse } from 'next/server';
import dns from 'dns';
import https from 'https';
import axios from 'axios';

const dnsCache = new Map();

async function resolveDnsDoH(hostname) {
  if (dnsCache.has(hostname)) {
    return dnsCache.get(hostname);
  }
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get(`https://8.8.8.8/resolve?name=${hostname}&type=A`, {
      httpsAgent: agent,
      headers: { 'Host': 'dns.google' },
      timeout: 3000
    });
    if (res.data && res.data.Answer) {
      const ips = res.data.Answer.filter(ans => ans.type === 1).map(ans => ans.data);
      if (ips.length > 0) {
        dnsCache.set(hostname, ips[0]);
        return ips[0];
      }
    }
  } catch (err) {
    console.error(`[DoH Error] Failed resolving ${hostname}:`, err.message);
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
  return dns.lookup(hostname, options, callback);
}

const dohAgent = new https.Agent({
  lookup: customLookup,
  rejectUnauthorized: false
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      httpsAgent: dohAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://nekopoi.care/'
      },
      timeout: 8000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    return new Response(response.data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400' // cache for 1 day
      }
    });
  } catch (err) {
    console.error("Image proxy failed:", err.message);
    return new Response('Failed to proxy image', { status: 500 });
  }
}
