const { animeterbaru, populer, schedule, search, detail, download } = require('../lib/scraper');

async function testAll() {
  console.log('=== 1. Testing animeterbaru() ===');
  const latest = await animeterbaru(1);
  console.log(`animeterbaru: ${latest.length} items. Sample:`, latest[0]?.title);

  console.log('\n=== 2. Testing populer() ===');
  const pop = await populer(1);
  console.log(`populer: ${pop.length} items. Sample:`, pop[0]?.title);

  console.log('\n=== 3. Testing schedule() ===');
  const sched = await schedule();
  console.log(`schedule: ${sched.length} items. Sample:`, sched[0]?.title);

  console.log('\n=== 4. Testing search("omae gotoki") ===');
  const searchResults = await search('omae gotoki');
  console.log(`search: ${searchResults.length} items. Sample:`, searchResults[0]?.title, searchResults[0]?.url);

  if (searchResults.length > 0) {
    console.log('\n=== 5. Testing detail(searchResults[0].url) ===');
    const detailData = await detail(searchResults[0].url);
    console.log(`detail: title="${detailData?.title}", episodes count=${detailData?.episodes?.length}`);
    if (detailData?.episodes?.length > 0) {
      console.log('Sample Episode:', detailData.episodes[0]);

      console.log('\n=== 6. Testing download(detailData.episodes[0].url) ===');
      const streamData = await download(detailData.episodes[0].url);
      console.log(`download: title="${streamData?.title}", streams count=${streamData?.streams?.length}`);
      if (streamData?.streams?.length > 0) {
        console.log('Sample Stream:', streamData.streams[0]);
      }
    }
  }
}

testAll();
