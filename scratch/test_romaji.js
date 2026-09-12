const axios = require('axios');
const cheerio = require('cheerio');

async function getRomajiTitle(name) {
  try {
    const res = await axios.get(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(name)}&page[limit]=1`, {
      headers: { 'Accept': 'application/vnd.api+json' },
      timeout: 3000
    });
    const attr = res.data?.data?.[0]?.attributes;
    if (attr) {
      return [
        attr.canonicalTitle,
        attr.titles?.en_jp,
        attr.titles?.ja_jp,
        attr.titles?.en
      ].filter(Boolean);
    }
  } catch (e) {}
  return [];
}

async function testSmartRomajiSearch(slug) {
  const cleanName = slug
    .replace(/(?:-episode-|-eps-|-ep-)\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/-/g, ' ')
    .trim();

  console.log(`\nTesting search aliases for: "${cleanName}"`);
  const aliases = await getRomajiTitle(cleanName);
  console.log('Aliases from Kitsu:', aliases);

  for (const alias of [cleanName, ...aliases]) {
    try {
      const searchRes = await axios.get(`https://ww2.samehadaku.pro/?s=${encodeURIComponent(alias)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 4000
      });
      const $ = cheerio.load(searchRes.data);
      const links = [];
      $('a[href*="/anime/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !links.includes(href)) links.push(href);
      });
      if (links.length > 0) {
        console.log(`-> FOUND with query "${alias}":`, links.slice(0, 2));
        break;
      }
    } catch (e) {}
  }
}

async function run() {
  await testSmartRomajiSearch('solo-leveling-season-2-episode-1');
  await testSmartRomajiSearch('attack-on-titan-episode-1');
  await testSmartRomajiSearch('demon-slayer-episode-1');
  await testSmartRomajiSearch('my-hero-academia-episode-1');
}

run();
