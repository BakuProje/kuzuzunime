const axios = require('axios');

async function test() {
  const genres = ['Action', 'Romance', 'Fantasy', 'Isekai', 'Comedy', 'Adventure', 'Mecha'];
  for (const g of genres) {
    try {
      const res = await axios.get(`http://localhost:3000/api/search?genre=${encodeURIComponent(g)}`, { timeout: 8000 });
      console.log(`[GET /api/search?genre=${g}] success:`, res.data.success, 'count:', res.data.data?.length);
      if (res.data.data?.length > 0) {
        console.log('Sample title:', res.data.data[0].title, 'url:', res.data.data[0].url);
      }
    } catch (e) {
      console.log(`[GET /api/search?genre=${g}] Error:`, e.message);
    }
  }
}
test();
