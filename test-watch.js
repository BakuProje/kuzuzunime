import { download } from './lib/scraper.js';

async function run() {
  const url = process.argv[2] || 'anime/masamune-kun-no-revenge-episode-12/';
  console.log('Testing watch for URL:', url);
  try {
    const data = await download(url);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error in download:', err);
  }
}

run();
