const axios = require('axios');

async function testDetailAndWatchFlow() {
  const testAnimeUrls = [
    '/anime/kimetsu-no-yaiba-4qyek9j/',
    '/anime/solo-leveling-season-2-arise-from-the-shadow-4809jqm/',
    '/anime/one-piece-sub-indo/',
    '/anime/jujutsu-kaisen-tv-k28nzuf/'
  ];

  for (const aUrl of testAnimeUrls) {
    console.log(`\n========================================`);
    console.log(`1. Testing /api/detail for: ${aUrl}`);
    try {
      const detailRes = await axios.get(`http://localhost:3000/api/detail?url=${encodeURIComponent(aUrl)}`);
      console.log('Detail Success:', detailRes.data.success);
      console.log('Title:', detailRes.data.data?.title);
      console.log('Episodes count:', detailRes.data.data?.episodes?.length);
      
      if (detailRes.data.data?.episodes?.length > 0) {
        const firstEp = detailRes.data.data.episodes[0];
        console.log('First Episode:', firstEp.title, firstEp.url);
        
        console.log(`2. Testing /api/watch for first episode: ${firstEp.url}`);
        const watchRes = await axios.get(`http://localhost:3000/api/watch?url=${encodeURIComponent(firstEp.url)}`);
        console.log('Watch Success:', watchRes.data.success);
        console.log('Watch Title:', watchRes.data.data?.title);
        console.log('Streams found:', watchRes.data.data?.streams?.length);
        console.log('Streams list:', watchRes.data.data?.streams);
      }
    } catch (e) {
      console.error('Error:', e.message, e.response?.data);
    }
  }
}

testDetailAndWatchFlow();
