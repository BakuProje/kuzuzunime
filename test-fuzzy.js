const cleanTitle = (title) => {
  return title
    .replace(/Subtitle Indonesia/gi, '')
    .replace(/Episode\s*\d+/gi, '')
    .replace(/Season\s*\d+/gi, '')
    .replace(/S\d+/gi, '')
    .replace(/Part\s*\d+/gi, '')
    .replace(/BD/gi, '')
    .replace(/Uncensored/gi, '')
    .replace(/Batch/gi, '')
    .replace(/\(\w+\)/g, '')
    .replace(/\[\w+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

function getSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const bigram of b1) {
    if (b2.has(bigram)) intersection++;
  }

  return (2.0 * intersection) / (b1.size + b2.size);
}

async function searchSamehadaku(query) {
  const url = `https://puruboy-api.vercel.app/api/anime/samehadaku/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    const json = await res.json();
    return json.success ? (json.result.data || []) : [];
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  }
}

async function smartSearch(query) {
  console.log(`Original query: "${query}"`);
  
  // 1. Try direct search
  let results = await searchSamehadaku(query);
  if (results.length > 0) {
    console.log("Direct search succeeded.");
    return results;
  }
  
  console.log("Direct search returned 0 results. Trying fuzzy fallback...");
  
  // 2. Split into words
  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3);
  
  // Sort by length descending to query the most unique words first
  words.sort((a, b) => b.length - a.length);
  console.log("Fuzzy words to try:", words);
  
  const allCandidates = new Map();
  
  for (const word of words) {
    console.log(`Querying word: "${word}"`);
    const wordResults = await searchSamehadaku(word);
    console.log(`Query for "${word}" returned ${wordResults.length} items`);
    
    let hasHighSimilarity = false;
    for (const item of wordResults) {
      if (!allCandidates.has(item.original_url)) {
        const score = getSimilarity(query, cleanTitle(item.title));
        allCandidates.set(item.original_url, { item, score });
        if (score >= 0.4) {
          hasHighSimilarity = true;
        }
      }
    }
    
    // If we found a candidate with high similarity, we can stop querying more words to save time/requests
    if (hasHighSimilarity) {
      console.log(`Found high similarity match for word "${word}". Breaking loop.`);
      break;
    }
  }
  
  const candidatesList = Array.from(allCandidates.values());
  console.log(`Total unique candidates collected: ${candidatesList.length}`);
  
  // Filter by a threshold and sort
  const threshold = 0.25;
  const filtered = candidatesList
    .filter(c => c.score >= threshold)
    .sort((a, b) => b.score - a.score);
  
  console.log(`Fuzzy match results (threshold ${threshold}) with scores:`);
  filtered.forEach(f => {
    console.log(`- ${f.item.title} (Score: ${f.score.toFixed(3)})`);
  });
  
  return filtered.map(f => f.item);
}

smartSearch('One Puch');
