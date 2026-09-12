const axios = require('axios');
const https = require('https');
const vm = require('vm');
const cheerio = require('cheerio');

async function testExecuteLeviathan() {
  try {
    const watchUrl = 'https://kuramanime.pro/anime/2475/ore-dake-level-up-na-ken/episode/1';
    const res = await axios.get(watchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    
    // Find leviathan script src
    const leviathanSrc = $('script[src*="leviathan.js"]').attr('src');
    console.log('Leviathan Src:', leviathanSrc);

    if (leviathanSrc) {
      const levRes = await axios.get(leviathanSrc, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      });
      console.log('Got Leviathan JS length:', levRes.data.length);
      
      // Let's create a sandbox
      const context = {
        window: {},
        document: {
          getElementById: () => ({ setAttribute: () => {}, appendChild: () => {}, value: '1' }),
          createElement: () => ({ setAttribute: () => {}, addEventListener: () => {} }),
          body: { appendChild: () => {} },
          querySelector: () => null
        },
        location: { href: watchUrl, hostname: 'v20.kuramanime.ing' },
        navigator: { userAgent: 'Mozilla/5.0' },
        console: { log: console.log, warn: console.warn, error: console.error }
      };
      vm.createContext(context);
      vm.runInContext(levRes.data, context);
      console.log('Keys in window after running Leviathan:', Object.keys(context.window));
      console.log('Context keys:', Object.keys(context));
    }
  } catch (e) {
    console.error('Eval error:', e.message);
  }
}

testExecuteLeviathan();
