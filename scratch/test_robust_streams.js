const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const dns = require('dns');

const agent = new https.Agent({ rejectUnauthorized: false });

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

const SAMEHADAKU_DOMAINS = [
  'https://ww2.samehadaku.pro',
  'https://samehadaku.care',
  'https://v2.samehadaku.how',
  'https://samehadaku.how'
];

async function getTitleSynonyms(query) {
  const synonyms = new Set();
  const cleanQ = query.replace(/[★☆♥♪×…\.#@!%^&*()+=\[\]{}|\\:;"'<>,?/~`]/g, ' ')
    .replace(/\b(?:sub\s*indo|subtitle\s*indonesia|tv|ona|ova|movie|bd|uncensored|batch|season\s*\d+|\d+nd\s*season|\d+th\s*season|\d+rd\s*season|part\s*\d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanQ) synonyms.add(cleanQ);

  try {
    const res = await axios.get(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanQ)}&page[limit]=3`, {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 3000
    });
    const dataList = res.data?.data || [];
    for (const item of dataList) {
      const attr = item.attributes;
      if (!attr) continue;
      if (attr.canonicalTitle) synonyms.add(attr.canonicalTitle);
      if (attr.titles) {
        if (attr.titles.en_jp) synonyms.add(attr.titles.en_jp);
        if (attr.titles.ja_jp) synonyms.add(attr.titles.ja_jp);
        if (attr.titles.en) synonyms.add(attr.titles.en);
        if (attr.titles.en_us) synonyms.add(attr.titles.en_us);
      }
      if (Array.isArray(attr.abbreviatedTitles)) {
        attr.abbreviatedTitles.forEach(t => synonyms.add(t));
      }
    }
  } catch (e) {
    console.warn('Kitsu error:', e.message);
  }

  // Also try Jikan (MyAnimeList) as second translation source if needed
  if (synonyms.size <= 1) {
    try {
      const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanQ)}&limit=2`, {
        timeout: 3000
      });
      const jData = jikanRes.data?.data || [];
      for (const item of jData) {
        if (item.title) synonyms.add(item.title);
        if (item.title_english) synonyms.add(item.title_english);
        if (item.title_japanese) synonyms.add(item.title_japanese);
        if (Array.isArray(item.titles)) {
          item.titles.forEach(t => synonyms.add(t.title));
        }
      }
    } catch (e) {}
  }

  return Array.from(synonyms).filter(s => s && s.trim().length >= 2);
}

function cleanForSearch(str) {
  return str
    .replace(/[★☆♥♪×…\.#@!%^&*()+=\[\]{}|\\:;"'<>,?/~`]/g, ' ')
    .replace(/\b(?:sub\s*indo|subtitle\s*indonesia|tv|ona|ova|movie|bd|uncensored|batch|season\s*\d+|\d+nd\s*season|\d+th\s*season|\d+rd\s*season|part\s*\d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findStreamsForAnime(titleQuery, epNum = 1) {
  console.log(`\n========================================`);
  console.log(`TESTING: "${titleQuery}" (Episode ${epNum})`);
  console.log(`========================================`);

  const synonyms = await getTitleSynonyms(titleQuery);
  console.log(`Extracted synonyms (${synonyms.length}):`, synonyms.slice(0, 6));

  const queries = new Set();
  for (const syn of synonyms) {
    const cleaned = cleanForSearch(syn);
    if (cleaned) {
      queries.add(cleaned);
      const words = cleaned.split(' ').filter(Boolean);
      if (words.length > 3) {
        queries.add(words.slice(0, 3).join(' '));
      }
    }
  }

  console.log(`Generated Search Queries:`, Array.from(queries));

  // Search Samehadaku
  let foundStreams = [];
  let foundTitle = '';

  for (const q of queries) {
    if (foundStreams.length > 0) break;
    for (const domain of SAMEHADAKU_DOMAINS) {
      if (foundStreams.length > 0) break;
      try {
        const sUrl = `${domain}/?s=${encodeURIComponent(q)}`;
        const res = await axios.get(sUrl, { httpsAgent: agent, headers, timeout: 3500 });
        if (!res.data || res.data.length < 200) continue;

        const $s = cheerio.load(res.data);
        const animeList = [];
        $s('.sh-grid a, a[href*="/anime/"]').each((i, el) => {
          const href = $s(el).attr('href');
          const title = $s(el).find('.j, .sh-nm').text().trim() || $s(el).text().trim();
          if (href && href.includes('/anime/') && !animeList.some(x => x.href === href)) {
            animeList.push({ title, href });
          }
        });

        if (animeList.length === 0) continue;
        console.log(`[Samehadaku Match] Query "${q}" on ${domain} found ${animeList.length} anime: "${animeList[0].title}"`);

        // Check top 2 anime
        for (const item of animeList.slice(0, 2)) {
          if (foundStreams.length > 0) break;
          const aRes = await axios.get(item.href, { httpsAgent: agent, headers, timeout: 4000 });
          const $a = cheerio.load(aRes.data);
          const epLinks = [];

          $a('a[href*="/nonton/"]').each((i, el) => {
            const href = $a(el).attr('href');
            const text = $a(el).text().trim();
            if (href && !epLinks.some(x => x.href === href)) {
              epLinks.push({ text, href });
            }
          });

          console.log(`  Found ${epLinks.length} episodes on anime page: ${item.href}`);

          // Match episode
          const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
          let matchedEp = epLinks.find(e => epRegex.test(e.text) || epRegex.test(e.href)) || (epNum === 1 ? epLinks[epLinks.length - 1] : null);

          if (matchedEp) {
            console.log(`  Matched Episode URL: ${matchedEp.href}`);
            const epRes = await axios.get(matchedEp.href, { httpsAgent: agent, headers, timeout: 4000 });
            const $ep = cheerio.load(epRes.data);
            foundTitle = $ep('title').text().split(' Subtitle ')[0].replace(/ – Samehadaku$/i, '').trim();

            $ep('iframe').each((i, el) => {
              let src = $ep(el).attr('src') || $ep(el).attr('data-src') || $ep(el).attr('data-litespeed-src');
              if (src) {
                if (src.startsWith('//')) src = `https:${src}`;
                if (!foundStreams.some(s => s.url === src)) {
                  let name = `Putarin HD ${foundStreams.length + 1}`;
                  if (src.includes('mogo')) name = `Mogo HD ${foundStreams.length + 1}`;
                  if (src.includes('streampoi')) name = `Streampoi HD ${foundStreams.length + 1}`;
                  foundStreams.push({ server: name, url: src });
                }
              }
            });
          }
        }
      } catch (e) {
        // domain or search failed
      }
    }
  }

  // Also Search Otakudesu if Samehadaku failed
  if (foundStreams.length === 0) {
    const OTAKU_DOMAINS = ['https://otakudesu.cloud', 'https://otakudesu.best'];
    for (const q of queries) {
      if (foundStreams.length > 0) break;
      for (const domain of OTAKU_DOMAINS) {
        if (foundStreams.length > 0) break;
        try {
          const oUrl = `${domain}/?s=${encodeURIComponent(q)}&post_type=anime`;
          const res = await axios.get(oUrl, { httpsAgent: agent, headers, timeout: 3500 });
          const $o = cheerio.load(res.data);
          const animeList = [];
          $o('ul.chlist li a, .venz a, .jdlflm a, a[href*="/anime/"]').each((i, el) => {
            const href = $o(el).attr('href');
            const title = $o(el).text().trim();
            if (href && href.includes('/anime/') && !animeList.some(x => x.href === href)) {
              animeList.push({ title, href });
            }
          });

          if (animeList.length === 0) continue;
          console.log(`[Otakudesu Match] Query "${q}" on ${domain} found: "${animeList[0].title}"`);

          const aRes = await axios.get(animeList[0].href, { httpsAgent: agent, headers, timeout: 4000 });
          const $a = cheerio.load(aRes.data);
          const epLinks = [];
          $a('.episodelist a, a[href*="/episode/"]').each((i, el) => {
            const href = $a(el).attr('href');
            const text = $a(el).text().trim();
            if (href && !epLinks.some(x => x.href === href)) {
              epLinks.push({ text, href });
            }
          });

          const epRegex = new RegExp(`(?:episode|eps|ep)[-_ ]*0*${epNum}\\b|\\b${epNum}\\b`, 'i');
          let matchedEp = epLinks.find(e => epRegex.test(e.text) || epRegex.test(e.href)) || (epNum === 1 ? epLinks[epLinks.length - 1] : null);

          if (matchedEp) {
            console.log(`  Otakudesu Matched Episode: ${matchedEp.href}`);
            const epRes = await axios.get(matchedEp.href, { httpsAgent: agent, headers, timeout: 4000 });
            const $ep = cheerio.load(epRes.data);
            foundTitle = $ep('.postcontent h1, title').first().text().trim();

            $ep('iframe').each((i, el) => {
              let src = $ep(el).attr('src') || $ep(el).attr('data-src');
              if (src) {
                if (src.startsWith('//')) src = `https:${src}`;
                if (!foundStreams.some(s => s.url === src)) {
                  foundStreams.push({ server: `DesuStream HD ${foundStreams.length + 1}`, url: src });
                }
              }
            });
          }
        } catch (e) {}
      }
    }
  }

  console.log(`\nRESULT for "${titleQuery} Ep ${epNum}":`);
  console.log(`Title: ${foundTitle || titleQuery}`);
  console.log(`Total Native Streams:`, foundStreams);
  return foundStreams;
}

async function runAllTests() {
  await findStreamsForAnime('the eminence in shadow', 1);
  await findStreamsForAnime('solo leveling', 1);
  await findStreamsForAnime('dark gathering', 1);
  await findStreamsForAnime('duel masters lost tsuioku no suishou', 1);
}

runAllTests().catch(console.error);
