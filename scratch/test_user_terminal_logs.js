const { detail, download, extractParentAnimeSlug } = require('../lib/scraper.js');

async function testUserLogs() {
  const urls = [
    '/anime/shokugeki-no-souma-gou-no-sara-episode-13-9pic9au/',
    '/watch/shokugeki-no-souma-gou-no-sara-episode-1-xpnzwxn/',
    '/anime/shingeki-no-kyojin-s3-part-2-episode-8-fc6ypi7/',
    '/watch/shingeki-no-kyojin-s3-part-2-episode-8-fc6ypi7/'
  ];

  for (const u of urls) {
    console.log('\n========================================');
    console.log('INPUT URL:', u);
    console.log('EXTRACTED PARENT SLUG:', extractParentAnimeSlug(u));
    
    if (u.includes('anime')) {
      const d = await detail(u);
      console.log('DETAIL RESULT Title:', d?.title, 'Episodes:', d?.episodes?.length, 'Sample Ep:', d?.episodes?.[0]);
    } else {
      const w = await download(u);
      console.log('WATCH RESULT Title:', w?.title, 'Streams:', w?.streams);
    }
  }
}

testUserLogs().catch(console.error);
