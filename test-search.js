async function testSamehadaku(query) {
  const url = `https://puruboy-api.vercel.app/api/anime/samehadaku/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    const json = await res.json();
    console.log(`Samehadaku query for "${query}":`, JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error fetching from Samehadaku:', err.message);
  }
}

async function run() {
  await testSamehadaku('One Puch');
  await testSamehadaku('One Punch');
}

run();
