const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
};

async function testUniversalEmbeds(slug, ep) {
  console.log(`\n========================================`);
  console.log(`TESTING EMBEDS FOR: "${slug}" (Ep ${ep})`);
  console.log(`========================================`);

  const embeds = [
    { name: 'Vidsrc CC', url: `https://vidsrc.cc/v2/embed/anime/${slug}/${ep}` },
    { name: '2Embed VIP', url: `https://www.2embed.cc/embed/anime/${slug}/${ep}` },
    { name: 'AutoEmbed', url: `https://player.autoembed.cc/embed/anime/${slug}/${ep}` },
    { name: 'Anime AutoEmbed', url: `https://anime.autoembed.cc/embed/${slug}/${ep}` },
    { name: 'Vidsrc ME', url: `https://vidsrc.me/embed/anime/${slug}/${ep}` },
    { name: 'Embed SU', url: `https://embed.su/embed/anime/${slug}/${ep}` },
    { name: 'MovieKitsu', url: `https://moviekitsu.net/embed/anime/${slug}/${ep}` }
  ];

  for (const item of embeds) {
    try {
      const res = await axios.get(item.url, { httpsAgent: agent, headers, timeout: 3500 });
      console.log(`[${res.status}] ${item.name} -> ${item.url}`);
    } catch (err) {
      console.log(`[FAIL ${err.response?.status || 'ERR'}] ${item.name} -> ${err.message}`);
    }
  }
}

async function run() {
  await testUniversalEmbeds('daemons-of-the-shadow-realm', 2);
  await testUniversalEmbeds('the-eminence-in-shadow', 1);
  await testUniversalEmbeds('solo-leveling', 1);
}

run().catch(console.error);
