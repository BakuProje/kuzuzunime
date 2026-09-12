const { detail, download, animeterbaru, populer, search } = require('../lib/scraper.js');

async function testFullAppScraper() {
  console.log('\n--- TEST 1: ANIMETERBARU ---');
  const latest = await animeterbaru(1);
  console.log('Latest items count:', latest.length);
  console.log('First latest item:', latest[0]);

  console.log('\n--- TEST 2: POPULER ---');
  const pop = await populer(1);
  console.log('Popular items count:', pop.length);
  console.log('First popular item:', pop[0]);

  console.log('\n--- TEST 3: DETAIL FOR SLUG "kage-no-jitsuryokusha-ni-naritakute" ---');
  const d1 = await detail('/anime/kage-no-jitsuryokusha-ni-naritakute');
  console.log('Detail Title:', d1?.title);
  console.log('Total Episodes:', d1?.episodes?.length);
  console.log('Sample Episode:', d1?.episodes?.[0]);

  console.log('\n--- TEST 4: DETAIL FOR SLUG "/anime/4624/baby-music/episode/1" ---');
  const d2 = await detail('/anime/4624/baby-music/episode/1');
  console.log('Detail Title:', d2?.title);
  console.log('Total Episodes:', d2?.episodes?.length);
  console.log('Sample Episode:', d2?.episodes?.[0]);

  console.log('\n--- TEST 5: WATCH STREAM FOR SAMPLE EPISODE ---');
  if (d1?.episodes?.[0]?.url) {
    const stream = await download(d1.episodes[0].url);
    console.log('Stream Title:', stream?.title);
    console.log('Stream Count:', stream?.streams?.length);
    console.log('First Stream:', stream?.streams?.[0]);
  }
}

testFullAppScraper().catch(console.error);
