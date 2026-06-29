import { NextResponse } from 'next/server';
import { detail, getAniListData, cleanTitle, search, getSimilarity } from '@/lib/scraper';

// Extract a readable title from the slug URL
function titleFromSlug(slug) {
  // e.g. "one-piece-episode-1-sub-indo" → "One Piece"
  const cleaned = slug
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .pop()
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-sub-indo.*$/i, '')
    .replace(/-batch.*$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return cleaned;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, message: 'Query parameter "url" is required' }, { status: 400 });
  }

  try {
    let samehadakuUrl = url;
    const cleanSlug = url.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');

    // Check if it is a Nekopoi Hentai ID
    if (cleanSlug.startsWith('hentai-')) {
      const nekopoiId = cleanSlug.replace('hentai-', '');
      console.log("Loading Nekopoi details for ID:", nekopoiId);
      try {
        const nekopoi = require('nekopoi-scraper');
        const detailData = await nekopoi.detail(nekopoiId);
        
        if (detailData && !detailData.error) {
          const title = detailData.title || detailData.info_meta?.title || 'Hentai Series';
          const image = detailData.thumbnail || detailData.image || '/placeholder.jpg';
          const description = detailData.synopsis || detailData.content || 'Nonton anime hentai sub indo gratis.';
          
          let episodes = [];
          if (Array.isArray(detailData.episode)) {
            episodes = detailData.episode.map(ep => ({
              title: ep.title || `Episode ${ep.id}`,
              url: `/watch/hentai-${ep.id}/`,
              date: ep.date || 'Terbaru'
            }));
          } else if (Array.isArray(detailData.stream)) {
            episodes = [{
              title: title,
              url: `/watch/hentai-post-${nekopoiId}/`,
              date: 'Terbaru'
            }];
          }

          const genres = [];
          if (detailData.info_meta?.genre) {
            genres.push(...detailData.info_meta.genre.split(',').map(g => g.trim()));
          } else {
            genres.push('Hentai');
          }

          const info = {
            japanese: detailData.info_meta?.japanese || '',
            english: detailData.info_meta?.english || '',
            status: detailData.info_meta?.status || 'Completed',
            studio: detailData.info_meta?.producer || 'Unknown',
            dirilis: detailData.info_meta?.released || 'Unknown',
            skor: detailData.info_meta?.score || '9.0',
            genre: genres.join(', ')
          };

          return NextResponse.json({
            success: true,
            data: {
              title,
              image,
              description,
              episodes,
              info,
              genres,
              relatedAnime: []
            }
          });
        }
      } catch (nekopoiErr) {
        console.error("Nekopoi detail scrape error:", nekopoiErr.message);
      }
    }

    // Check if url contains a numeric AniList ID
    if (/^\d+$/.test(cleanSlug)) {
      console.log("Detail URL contains an AniList ID:", cleanSlug);
      try {
        const aniDataForId = await getAniListData(cleanSlug);
        if (aniDataForId) {
          const romaji = aniDataForId.romajiTitle;
          const english = aniDataForId.englishTitle;
          
          if (romaji || english) {
            console.log(`Searching Samehadaku for AniList ID titles. Romaji: "${romaji}", English: "${english}"`);
            
            // Search Samehadaku in parallel
            const searchPromises = [];
            if (romaji) searchPromises.push(search(romaji));
            if (english) searchPromises.push(search(english));
            
            const resultsArrays = await Promise.all(searchPromises);
            const searchResults = [];
            const seenUrls = new Set();
            for (const arr of resultsArrays) {
              if (arr) {
                for (const item of arr) {
                  if (!seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    searchResults.push(item);
                  }
                }
              }
            }
            
            if (searchResults.length > 0) {
              let bestMatch = null;
              let bestScore = 0;
              for (const item of searchResults) {
                const scoreRomaji = romaji ? getSimilarity(romaji, item.title) : 0;
                const scoreEnglish = english ? getSimilarity(english, item.title) : 0;
                const score = Math.max(scoreRomaji, scoreEnglish);
                
                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = item;
                }
              }
              if (bestMatch && bestScore >= 0.45) {
                samehadakuUrl = bestMatch.url;
                console.log(`Mapped AniList ID to Samehadaku URL: ${samehadakuUrl} (Score: ${bestScore})`);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to map AniList ID to Samehadaku:", err);
      }
    }

    // Try to get detail from Samehadaku
    let data = null;
    try {
      if (samehadakuUrl.startsWith('/anime/') || samehadakuUrl.startsWith('http')) {
        const unmatchedSlug = samehadakuUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
        // Discard if the slug is still a raw numeric ID (mapping failed) to prevent invalid API calls
        if (!/^\d+$/.test(unmatchedSlug)) {
          const detailData = await detail(samehadakuUrl);
          // Verify returned data actually contains a title (prevent success:true with empty fields)
          if (detailData && detailData.title && detailData.title.trim() !== '') {
            data = detailData;
          }
        }
      }
    } catch (e) {
      console.error('Samehadaku detail failed:', e?.message || e);
    }

    // Determine the title for AniList lookup
    const lookupSlug = samehadakuUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
    const title = data?.title || ( /^\d+$/.test(lookupSlug) ? lookupSlug : titleFromSlug(samehadakuUrl) );
    
    let aniData = null;
    try {
      const urlSlug = url.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '');
      const aniLookupKey = /^\d+$/.test(urlSlug) ? urlSlug : cleanTitle(title);
      aniData = await getAniListData(aniLookupKey);
    } catch (e) {
      console.error('AniList lookup failed:', e?.message || e);
    }
    
    // If both sources failed, return an error
    if (!data && !aniData) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unable to fetch anime details. The source API may be temporarily unavailable.' 
      }, { status: 503 });
    }

    // Build result - use data as base if available, otherwise create from AniList
    let result;
    if (data) {
      result = { ...data };
      if (aniData) {
        result = {
          ...data,
          rating: aniData.rating || data.info?.skor || '8.5',
          banner: aniData.banner,
          genres: aniData.genres || data.genres || [],
          totalEpisodes: aniData.totalEpisodes,
          relatedAnime: aniData.relatedAnime || [],
          studio: aniData.studio || data.info?.studio || 'Unknown',
          status: aniData.status,
          format: aniData.format,
          startDate: aniData.startDate,
          endDate: aniData.endDate,
          image: aniData.poster || data.image
        };
      } else {
        result.relatedAnime = [];
      }
    } else {
      // AniList-only fallback (Samehadaku is completely down)
      result = {
        title: aniData.title || title,
        image: aniData.poster,
        banner: aniData.banner,
        rating: aniData.rating || '8.5',
        genres: aniData.genres || [],
        totalEpisodes: aniData.totalEpisodes,
        relatedAnime: aniData.relatedAnime || [],
        studio: aniData.studio || 'Unknown',
        status: aniData.status,
        format: aniData.format,
        startDate: aniData.startDate,
        endDate: aniData.endDate,
        description: aniData.description || null,
        episodes: [], // No episodes available without Samehadaku
        info: {
          genre: (aniData.genres || []).join(', '),
          status: aniData.status === 'RELEASING' ? 'Ongoing' : (aniData.status === 'FINISHED' ? 'Completed' : aniData.status),
          studio: aniData.studio || 'Unknown',
          skor: aniData.rating || '8.5'
        },
        synopsis: aniData.description || 'Tidak ada deskripsi tersedia.'
      };
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('Error in /api/detail:', e?.message || e);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
