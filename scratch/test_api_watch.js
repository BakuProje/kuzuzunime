const { download } = require('../lib/scraper');

async function test() {
  const testUrls = [
    'bang-dream-garupa☆pico-episode-26-gf5g6d5',
    'kimetsu-no-yaiba-episode-1',
    'jujutsu-kaisen-episode-1',
    'one-piece-episode-1120',
    'solo-leveling-episode-1',
    'hidamari-sketch-x-☆☆☆-specials-episode-2-5a77q6c'
  ];

  for (const u of testUrls) {
    console.log(`\n================================`);
    console.log(`Testing download("${u}"):`);
    const res = await download(u);
    console.log('Result Title:', res?.title);
    console.log('Streams count:', res?.streams?.length);
    if (res?.streams?.length > 0) {
      console.log('First stream:', res.streams[0]);
    }
  }
}

test();
