const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

// --- HELPER FUNCTIONS ---

function cleanTitle(title) {
  return title
    .replace(/Subtitle Indonesia/gi, '')
    .replace(/Episode\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRelativeUrl(fullUrl) {
  if (!fullUrl) return '';
  try {
    if (fullUrl.startsWith('/')) return fullUrl;
    const parsed = new URL(fullUrl);
    return parsed.pathname + parsed.search;
  } catch (e) {
    return fullUrl.replace(/^https?:\/\/[^\/]+/, '');
  }
}

async function getAniListData(title) {
  if (!title) return null;
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
        }
        averageScore
        bannerImage
        genres
        episodes
        status
        studios {
          nodes {
            name
          }
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              averageScore
              episodes
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query,
      variables: { search: title }
    });

    const media = response.data.data.Media;
    if (!media) return null;

    let relatedAnime = [];
    if (media.relations && media.relations.edges) {
      relatedAnime = media.relations.edges
        .filter(edge => edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL')
        .map(edge => ({
          id: edge.node.id,
          title: edge.node.title.romaji || edge.node.title.english,
          image: edge.node.coverImage?.large,
          rating: edge.node.averageScore ? (edge.node.averageScore / 10).toFixed(1) : null,
          episodes: edge.node.episodes,
          relationType: edge.relationType
        }));
    }

    const studio = media.studios && media.studios.nodes && media.studios.nodes.length > 0 ? media.studios.nodes[0].name : null;

    return {
      anilistId: media.id,
      title: media.title.romaji || media.title.english,
      rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
      banner: media.bannerImage,
      genres: media.genres,
      totalEpisodes: media.episodes,
      status: media.status,
      relatedAnime: relatedAnime,
      studio: studio
    };
  } catch (error) {
    return null;
  }
}

// --- SCRAPER REPLACEMENTS (Using puruboy-api) ---

async function animeterbaru(page = 1) {
  try {
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/home`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const updates = res.data.result.latestUpdates || [];
      return updates.map(item => ({
        title: item.title,
        url: getRelativeUrl(item.original_url),
        image: item.thumbnail,
        episode: item.episode ? item.episode.toString() : 'Ongoing',
        score: 'N/A'
      }));
    }
    return [];
  } catch (error) {
    console.error("api/index.js: animeterbaru error:", error);
    return [];
  }
}

async function search(query) {
  try {
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/search?q=${encodeURIComponent(query)}`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const items = res.data.result.data || [];
      return items.map(item => ({
        title: item.title,
        image: item.thumbnail,
        type: item.type || 'TV',
        status: item.status || 'Ongoing',
        score: item.score || 'N/A',
        url: getRelativeUrl(item.original_url)
      }));
    }
    return [];
  } catch (error) {
    console.error("api/index.js: search error:", error);
    return [];
  }
}

async function detail(link) {
  try {
    const relative = getRelativeUrl(link);
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/detail?url=${encodeURIComponent(relative)}`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const result = res.data.result;
      const episodes = (result.episodeList || []).map(ep => ({
        title: ep.title,
        url: getRelativeUrl(ep.original_url),
        date: ep.date || 'Terbaru'
      }));
      
      const info = {
        japanese: result.details?.japanese || '',
        english: result.details?.english || '',
        status: result.details?.status || 'Ongoing',
        studio: result.details?.studio || 'Unknown',
        dirilis: result.details?.released || 'Unknown',
        skor: result.rating || '8.5'
      };

      return {
        title: result.title,
        image: result.thumbnail,
        description: result.synopsis,
        episodes,
        info
      };
    }
    return null;
  } catch (error) {
    console.error("api/index.js: detail error:", error);
    return null;
  }
}

async function download(link) {
  try {
    const relative = getRelativeUrl(link);
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/stream?url=${encodeURIComponent(relative)}`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const result = res.data.result;
      const streams = (result.serverOptions || []).map(opt => ({
        server: opt.name,
        url: `/api/embed?post=${opt.post}&nume=${opt.nume}&type=${opt.type}`
      }));
      return {
        title: result.title,
        streams
      };
    }
    return null;
  } catch (error) {
    console.error("api/index.js: download error:", error);
    return null;
  }
}

// --- ROUTES API ---

app.get('/api/latest', async (req, res) => {
  try {
    const data = await animeterbaru(req.query.page || 1);
    
    const enrichedData = await Promise.all(data.map(async (item) => {
      const aniData = await getAniListData(cleanTitle(item.title));
      if (aniData) {
        return {
          ...item,
          rating: aniData.rating || item.score,
          banner: aniData.banner,
          genres: aniData.genres,
          anilistId: aniData.anilistId
        };
      }
      return { ...item, rating: item.score };
    }));

    res.json(enrichedData);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim() === "") {
      return res.json({ success: false, data: [], error: "Query parameter 'q' is required" });
    }
    const query = q.trim().toLowerCase();
    const data = await search(query);
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // Enrich with AniList
    const enrichedData = await Promise.all(data.slice(0, 15).map(async (item) => {
      try {
        const cleaned = cleanTitle(item.title);
        const aniData = await getAniListData(cleaned);
        const rawStatus = aniData?.status || item.status;
        const normalizedStatus = rawStatus === 'FINISHED' ? 'Completed' : (rawStatus === 'RELEASING' ? 'Ongoing' : rawStatus);
        return {
          ...item,
          image: aniData?.poster || item.image,
          score: aniData?.rating || item.score || '8.5',
          banner: aniData?.banner,
          genres: aniData?.genres,
          status: normalizedStatus,
          episode: aniData?.totalEpisodes ? aniData.totalEpisodes.toString() : (normalizedStatus === 'Completed' ? 'Tamat' : 'Ongoing')
        };
      } catch (err) {
        return {
          ...item,
          episode: item.status === 'Completed' ? 'Tamat' : 'Ongoing'
        };
      }
    }));

    const finalData = [
      ...enrichedData,
      ...data.slice(15).map(item => ({
        ...item,
        episode: item.status === 'Completed' ? 'Tamat' : 'Ongoing'
      }))
    ];

    res.json({ success: true, data: finalData });
  } catch (e) { res.json({ success: false, data: [], error: e.message }); }
});

const POPULAR_KEYWORDS = ["One Piece", "Naruto", "Bleach", "Solo Leveling", "Kaiju No. 8", "Jujutsu Kaisen", "Demon Slayer", "Mushoku Tensei", "Black Clover", "Hunter x Hunter", "Wind Breaker", "That Time I Got Reincarnated as a Slime", "My Hero Academia", "Haikyuu", "Attack on Titan", "Frieren", "Blue Lock", "Classroom of the Elite", "Oshi no Ko", "Dr. Stone"];

app.get('/api/popular', async (req, res) => {
  try {
    const searchPromises = POPULAR_KEYWORDS.map(k => search(k));
    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flat().filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
    
    const enrichedData = await Promise.all(allResults.slice(0, 50).map(async (item) => {
      const aniData = await getAniListData(cleanTitle(item.title));
      const rawStatus = aniData?.status || item.status;
      const normalizedStatus = rawStatus === 'FINISHED' ? 'Completed' : (rawStatus === 'RELEASING' ? 'Ongoing' : rawStatus);
      return {
        ...item,
        score: aniData?.rating || item.score || '8.5',
        episode: aniData?.totalEpisodes ? aniData.totalEpisodes.toString() : (normalizedStatus === 'Completed' ? 'Tamat' : 'Ongoing'),
        status: normalizedStatus,
        image: aniData?.poster || item.image || aniData?.banner
      };
    }));
    
    res.json({ success: true, data: enrichedData });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/schedule', async (req, res) => {
  try {
    const response = await axios.get('https://puruboy-api.vercel.app/api/anime/samehadaku/schedule', { headers });
    if (!response.data || !response.data.success || !response.data.result) {
      return res.json({ success: true, data: [] });
    }

    const json = response.data;
    const dayMapping = {
      'sunday': 'MIN', 'monday': 'SEN', 'tuesday': 'SEL', 'wednesday': 'RAB', 
      'thursday': 'KAM', 'friday': 'JUM', 'saturday': 'SAB'
    };

    const daysOrder = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
    const grouped = daysOrder.map(d => ({ day: d, list: [] }));

    // Get current time in WIB (Asia/Jakarta)
    const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const todayIndex = nowWib.getDay(); // 0 (Sunday) to 6 (Saturday)
    const currentHour = nowWib.getHours();
    const currentMinute = nowWib.getMinutes();

    const dayToIndex = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };

    Object.keys(json.result).forEach(key => {
      const dayShortId = dayMapping[key.toLowerCase()];
      if (!dayShortId) return;

      const dayIdx = daysOrder.indexOf(dayShortId);
      const dayWeekIndex = dayToIndex[key.toLowerCase()];

      const list = json.result[key] || [];
      list.forEach(item => {
        let status = 'Akan Tayang';
        if (dayWeekIndex < todayIndex) {
          status = 'Sudah Tayang';
        } else if (dayWeekIndex === todayIndex) {
          if (item.time) {
            const [hour, minute] = item.time.split(':').map(Number);
            if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
              status = 'Sudah Tayang';
            }
          }
        }

        const relativeUrl = item.original_url ? item.original_url.replace(/^https?:\/\/[^\/]+/, '') : '';

        const entry = {
          id: relativeUrl || item.title,
          title: item.title,
          image: item.thumbnail,
          time: item.time || '00:00',
          episode: 'Ongoing',
          score: item.score ? parseFloat(item.score).toFixed(1) : '8.5',
          status,
          airingAt: 0,
          day: dayShortId
        };

        if (dayIdx !== -1) {
          grouped[dayIdx].list.push(entry);
        }
      });
    });

    // Sort lists by release time
    grouped.forEach(day => {
      day.list.sort((a, b) => a.time.localeCompare(b.time));
    });

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Express Schedule API Error:', error);
    res.json({ success: false, data: [] });
  }
});

app.get('/api/detail', async (req, res) => {
  try {
    const data = await detail(req.query.url);
    const aniData = await getAniListData(cleanTitle(data.title));
    
    if (aniData) {
      res.json({
        ...data,
        rating: aniData.rating || data.info.skor,
        banner: aniData.banner,
        genres: aniData.genres,
        totalEpisodes: aniData.totalEpisodes,
        relatedAnime: aniData.relatedAnime || [],
        studio: aniData.studio || null
      });
    } else {
      res.json({
        ...data,
        rating: data.info.skor,
        relatedAnime: []
      });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/watch', async (req, res) => {
  try {
    const data = await download(req.query.url);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/embed', async (req, res) => {
  try {
    const { post, nume, type } = req.query;
    if (!post || !nume || !type) {
      return res.status(400).send('Missing required parameters: post, nume, type');
    }
    const response = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/embed?post=${post}&nume=${nume}&type=${type}`);
    const embed_url = response.data?.result?.embed_url;
    if (embed_url) {
      res.redirect(embed_url);
    } else {
      res.status(404).send('Embed URL not found');
    }
  } catch (e) {
    console.error("Express embed proxy error:", e);
    res.status(500).send(e.message);
  }
});

// Untuk Local Development
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
