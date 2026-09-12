const { download } = require('../lib/scraper.js');

async function testWatchUrls() {
  const testUrls = [
    '/anime/4624/baby-music/episode/1',
    '/anime/2475/kage-no-jitsuryokusha-ni-naritakute/episode/1',
    '/anime/3565/follow-your-fantasy/episode/1',
    '/watch/kage-no-jitsuryokusha-ni-naritakute-episode-1',
    '/watch/solo-leveling-episode-1',
    '/watch/dark-gathering-episode-1'
  ];

  for (const url of testUrls) {
    console.log(`\n========================================`);
    console.log(`TESTING API WATCH URL: "${url}"`);
    console.log(`========================================`);
    try {
      const res = await download(url);
      console.log('RESULT:', JSON.stringify(res, null, 2));
    } catch (e) {
      console.error('ERROR:', e.message);
    }
  }
}

testWatchUrls().catch(console.error);
