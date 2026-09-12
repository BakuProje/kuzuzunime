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
  if (hostname.includes('kuramanime') || hostname.includes('nekopoi')) {
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

async function deepInspect() {
  try {
    // 1. Inspect Home Sections
    console.log('=== 1. Inspecting Home Sections ===');
    const homeRes = await axios.get('https://kuramanime.pro/', { httpsAgent: dohAgent, headers, timeout: 8000 });
    const $ = cheerio.load(homeRes.data);

    // Look for cards
    $('.product__item, .anime__item, .col-lg-4, .col-md-6, .col-6, [data-setbg]').slice(0, 5).each((i, el) => {
      const title = $(el).find('h5, h6, .product__item__text a, .anime__item__text a').text().trim();
      const href = $(el).find('a').attr('href');
      const bg = $(el).find('[data-setbg]').attr('data-setbg') || $(el).attr('data-setbg') || $(el).find('img').attr('src');
      const ep = $(el).find('.ep, .episode').text().trim();
      const score = $(el).find('.rate, .comment, .view').text().trim();
      console.log(`Card ${i}: title="${title}" href="${href}" img="${bg}" ep="${ep}" score="${score}"`);
    });

    // 2. Inspect an Anime Detail Page
    console.log('\n=== 2. Inspecting Anime Detail Page ===');
    const sampleDetailUrl = 'https://kuramanime.pro/anime/4508/omae-gotoki-ga-maou-ni-kateru-to-omouna-to-yuusha-party-wo-tsuihou-sareta-node-outo-de-kimama-ni-kurashitai';
    const detailRes = await axios.get(sampleDetailUrl, { httpsAgent: dohAgent, headers, timeout: 8000 });
    const $d = cheerio.load(detailRes.data);
    console.log('Detail Title:', $d('.anime__details__title h3, .anime__details__title').text().trim() || $d('title').text());
    console.log('Synopsis:', $d('.anime__details__text p').text().trim()?.slice(0, 150));
    console.log('Image:', $d('.anime__details__pic, [data-setbg]').attr('data-setbg') || $d('.anime__details__pic img').attr('src'));

    console.log('\nInfo list items:');
    $d('.anime__details__widget ul li').each((i, el) => {
      console.log(`  info: ${$d(el).text().replace(/\s+/g, ' ').trim()}`);
    });

    console.log('\nEpisode items count:');
    const epLinks = [];
    $d('a[href*="/episode/"], a[href*="/ep/"], .anime__details__episodes a').each((i, el) => {
      epLinks.push({ text: $d(el).text().trim(), href: $d(el).attr('href') });
    });
    console.log(`Found ${epLinks.length} episodes:`);
    epLinks.slice(0, 5).forEach(e => console.log(' ->', e.text, e.href));

    // 3. Inspect a Watch Page
    if (epLinks.length > 0) {
      console.log('\n=== 3. Inspecting Watch Page ===');
      const watchUrl = epLinks[0].href.startsWith('http') ? epLinks[0].href : `https://kuramanime.pro${epLinks[0].href}`;
      console.log('Fetching Watch URL:', watchUrl);
      const watchRes = await axios.get(watchUrl, { httpsAgent: dohAgent, headers, timeout: 8000 });
      const $w = cheerio.load(watchRes.data);
      console.log('Watch Page Title:', $w('title').text());
      console.log('Iframes on watch page:');
      $w('iframe').each((i, el) => {
        console.log(` iframe ${i}: src="${$w(el).attr('src')}" data-src="${$w(el).attr('data-src')}"`);
      });

      console.log('Video tags:');
      $w('video, source').each((i, el) => {
        console.log(` video/source ${i}: src="${$w(el).attr('src')}" type="${$w(el).attr('type')}"`);
      });

      console.log('Player servers / buttons:');
      $w('#player, #embed_holder, .server, select[name="server"], .player-servers, .nav-tabs li a, .nav-pills a, [data-src], [data-video]').each((i, el) => {
        console.log(` server button: text="${$w(el).text().trim()}" href="${$w(el).attr('href')}" data-src="${$w(el).attr('data-src')}" data-video="${$w(el).attr('data-video')}"`);
      });
    }

    // 4. Inspect Quick Search / Search Query Format
    console.log('\n=== 4. Inspecting Search on Kuramanime ===');
    const searchRes = await axios.get('https://kuramanime.pro/anime?search=solo%20leveling', { httpsAgent: dohAgent, headers, timeout: 8000 });
    const $s = cheerio.load(searchRes.data);
    console.log('Search Results Count:', $s('.product__item, .anime__item').length);
    $s('.product__item, .anime__item').slice(0, 3).each((i, el) => {
      console.log(` Search Result ${i}: ${$s(el).find('h5, a').first().text().trim()} | ${$s(el).find('a').attr('href')}`);
    });

  } catch (e) {
    console.error('Deep inspect error:', e.message);
  }
}

deepInspect();
