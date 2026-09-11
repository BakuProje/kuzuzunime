import { animeterbaru, search, detail, download, schedule } from '../lib/scraper.js';

async function verifyAll() {
  console.log('--- 1. Testing animeterbaru ---');
  const t0 = Date.now();
  const latest = await animeterbaru(1);
  console.log(`[${Date.now() - t0}ms] Count: ${latest.length}, Sample:`, latest[0]?.title, '->', latest[0]?.image);

  console.log('\n--- 2. Testing search "mecha" ---');
  const t1 = Date.now();
  const mecha = await search('mecha');
  console.log(`[${Date.now() - t1}ms] Count: ${mecha.length}, Sample:`, mecha[0]?.title, '->', mecha[0]?.image);

  console.log('\n--- 3. Testing search "historical" ---');
  const t2 = Date.now();
  const hist = await search('historical');
  console.log(`[${Date.now() - t2}ms] Count: ${hist.length}, Sample:`, hist[0]?.title, '->', hist[0]?.image);

  console.log('\n--- 4. Testing schedule ---');
  const t3 = Date.now();
  const sched = await schedule();
  console.log(`[${Date.now() - t3}ms] Count: ${sched.length}, Sample:`, sched[0]?.title, '->', sched[0]?.image);

  console.log('\n--- 5. Testing detail ---');
  const t4 = Date.now();
  const det = await detail('/anime/one-piece/');
  console.log(`[${Date.now() - t4}ms] Title:`, det?.title, 'Episodes:', det?.episodes?.length);
}

verifyAll();
