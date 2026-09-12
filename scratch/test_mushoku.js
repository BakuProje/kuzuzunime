const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const { download, getTitleSynonyms } = require('../lib/scraper.js');

async function testMushoku() {
  const query = 'mushoku-tensei-isekai-ittara-honki-dasu-3rd-season-episode-1';
  console.log('Testing download for:', query);

  const synonyms = await getTitleSynonyms('mushoku-tensei-isekai-ittara-honki-dasu-3rd-season');
  console.log('Synonyms:', synonyms);

  const res = await download(`/watch/${query}`);
  console.log('DOWNLOAD RESULT:', JSON.stringify(res, null, 2));
}

testMushoku().catch(console.error);
