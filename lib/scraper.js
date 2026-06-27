import axios from 'axios';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

function cleanTitle(title) {
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

export async function getAniListData(title) {
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
        coverImage {
          extraLarge
          large
        }
        genres
        episodes
        status
        format
        startDate { year month day }
        endDate { year month day }
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

    const formatDate = (date) => {
        if (!date || !date.year) return null;
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[date.month-1] || ''} ${date.day || ''}, ${date.year}`;
    };

    return {
      anilistId: media.id,
      title: media.title.romaji || media.title.english,
      rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
      banner: media.bannerImage,
      poster: media.coverImage?.extraLarge || media.coverImage?.large,
      genres: media.genres,
      totalEpisodes: media.episodes,
      status: media.status,
      format: media.format,
      startDate: formatDate(media.startDate),
      endDate: formatDate(media.endDate),
      relatedAnime: relatedAnime,
      studio: studio
    };
  } catch (error) {
    return null;
  }
}

export async function animeterbaru(page = 1) {
  try {
    const res = await axios.get(`https://puruboy-api.vercel.app/api/anime/samehadaku/home`, { headers });
    if (res.data && res.data.success && res.data.result) {
      const updates = res.data.result.latestUpdates || [];
      return updates.map(item => ({
        title: item.title,
        url: getRelativeUrl(item.original_url),
        image: item.thumbnail,
        episode: item.episode ? item.episode.toString() : 'Ongoing',
        score: 'N/A',
        released: item.released || '',
        postedBy: item.posted_by || ''
      }));
    }
    return [];
  } catch (error) {
    console.error("scraper.js: animeterbaru error:", error?.message || 'Unknown error');
    return [];
  }
}

export async function search(query) {
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
    console.error("scraper.js: search error:", error?.message || 'Unknown error');
    return [];
  }
}

export async function detail(link) {
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
        skor: result.rating || '8.5',
        genre: result.details?.genre || result.details?.genres || result.genre || ''
      };

      const extractedGenres = result.genres || (result.details?.genre ? result.details.genre.split(',').map(g => g.trim()) : []);

      return {
        title: result.title,
        image: result.thumbnail,
        description: result.synopsis,
        episodes,
        info,
        genres: extractedGenres
      };
    }
    return null;
  } catch (error) {
    console.error("scraper.js: detail error:", error?.message || 'Unknown error');
    return null;
  }
}

export async function download(link) {
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
    console.error("scraper.js: download error:", error?.message || 'Unknown error');
    return null;
  }
}

export async function schedule() {
  try {
    const res = await axios.get('https://puruboy-api.vercel.app/api/anime/samehadaku/schedule', { headers });
    if (res.data && res.data.success && res.data.result) {
      return res.data.result;
    }
    return null;
  } catch (error) {
    console.error("scraper.js: schedule error:", error);
    return null;
  }
}

export { cleanTitle };
