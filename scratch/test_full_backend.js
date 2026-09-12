const { detail, download, animeterbaru } = require('../lib/scraper');

async function testFullBackendFlow() {
  console.log('=== 1. Testing animeterbaru() (Home latest) ===');
  const latest = await animeterbaru(1);
  console.log('Latest items count:', latest?.length);
  if (latest && latest.length > 0) {
    console.log('Sample latest item:', latest[0]);
    console.log('\n=== 2. Testing download() on latest item URL:', latest[0].url);
    const watchRes = await download(latest[0].url);
    console.log('Watch Res on latest:', watchRes);
  }

  console.log('\n=== 3. Testing detail() and download() on popular anime ===');
  const testAnimeList = [
    'kimetsu-no-yaiba-4qyek9j',
    'solo-leveling-season-2-arise-from-the-shadow-4809jqm',
    'one-piece-sub-indo',
    'jujutsu-kaisen-tv-k28nzuf'
  ];

  for (const slug of testAnimeList) {
    console.log(`\n--- Anime: ${slug} ---`);
    const d = await detail(slug);
    console.log('Detail Title:', d?.title, 'Episodes:', d?.episodes?.length);
    if (d?.episodes && d.episodes.length > 0) {
      const ep = d.episodes[0];
      console.log('Testing Ep 0:', ep.title, ep.url);
      const w = await download(ep.url);
      console.log('Download Streams:', w?.streams);
    }
  }
}

testFullBackendFlow();
