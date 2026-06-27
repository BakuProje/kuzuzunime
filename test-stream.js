async function testHome() {
  const url = `https://puruboy-api.vercel.app/api/anime/samehadaku/home`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    const json = await res.json();
    console.log("Home API response latestUpdates sample:", JSON.stringify(json.result?.latestUpdates?.[0], null, 2));
  } catch (err) {
    console.error('Error fetching home:', err.message);
  }
}

testHome();
