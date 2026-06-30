'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EpisodeList from '@/app/components/EpisodeList';
import Skeleton from '@/app/components/Skeleton';
import AnimeCard from '@/app/components/AnimeCard';
import { supabase } from '@/lib/supabase';
import { usePlayer } from '@/app/components/PlayerContext';

export default function AnimeDetail() {
  const params = useParams();
  const { activeEpisode, currentTime, duration } = usePlayer();
  const router = useRouter();
  const [data, setData] = useState(() => {
    if (typeof window !== 'undefined') {
      const pending = sessionStorage.getItem('pending_anime_detail');
      if (pending) {
        try {
          return JSON.parse(pending);
        } catch (_) {}
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const pending = sessionStorage.getItem('pending_anime_detail');
      if (pending) return false;
    }
    return true;
  });
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState(null);
  const [progressList, setProgressList] = useState([]);

  const rawSlug = params.slug;
  let slug = '';
  const rawPath = Array.isArray(rawSlug) ? rawSlug.map(decodeURIComponent).join('/') : decodeURIComponent(rawSlug || '');
  const cleanPath = rawPath.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
  if (cleanPath.startsWith('anime/')) {
    slug = '/' + cleanPath + '/';
  } else {
    slug = '/anime/' + cleanPath + '/';
  }


  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/detail?url=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (json.success) {
          setData(prev => {
            const merged = { ...prev, ...json.data };
            // Keep preloaded card cover image if API returns placeholder or fallback
            const apiImage = json.data.image || '';
            const isPlaceholder = !apiImage || apiImage === '/placeholder.jpg' || apiImage === '/Zunime.png';
            if (prev && prev.image && prev.image !== '/Zunime.png' && prev.image !== '/placeholder.jpg' && isPlaceholder) {
              merged.image = prev.image;
            }
            return merged;
          });
          checkFavStatus(slug);
          saveToHistory(json.data);
          fetchProgress();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }

    async function fetchProgress() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cleanAnime = slug ? slug.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';
      const { data } = await supabase
        .from('watch_progress')
        .select('episode_id, progress, duration')
        .eq('user_id', user.id)
        .eq('anime_id', cleanAnime);
      if (data) {
        setProgressList(data);
      }
    }

    fetchData();
    getSession();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pending_anime_detail');
    }
  }, [slug]);

  const checkFavStatus = async (url) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('anime_id', url).maybeSingle();
    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) return router.push('/auth');

    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('anime_id', slug);
      setIsFavorite(false);
    } else {
      const animeData = {
        url: slug,
        title: data.title,
        image: data.image,
        score: data.rating || data.info?.skor || '8.5',
        episode: data.totalEpisodes ? `${data.totalEpisodes} Eps` : (getStatusLabel(data.status) === 'Completed' ? 'Tamat' : 'Ongoing'),
        status: getStatusLabel(data.status)
      };
      await supabase.from('favorites').insert({
        user_id: user.id,
        anime_id: slug,
        anime_data: animeData
      });
      setIsFavorite(true);
    }
  };

  const saveToHistory = async (anime) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from('watch_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('anime_url', slug)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('watch_history')
        .update({
          title: anime.title,
          image: anime.image,
          score: anime.rating || anime.info?.skor || '8.5',
          updated_at: new Date()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('watch_history')
        .insert({
          user_id: user.id,
          anime_url: slug,
          title: anime.title,
          image: anime.image,
          score: anime.rating || anime.info?.skor || '8.5',
          updated_at: new Date()
        });
    }
  };

  if (loading) return <div className="section-container"><Skeleton className="hero-slide" style={{ height: '400px' }} /></div>;
  if (!data) return <div className="section-container">Anime tidak ditemukan.</div>;

  const genres = (data.genres && data.genres.length > 0)
    ? data.genres
    : (data?.info?.genre && data.info.genre.trim() !== '' ? data.info.genre.split(',').map(g => g.trim()) : ['Fantasy', 'Comedy', 'Slice of Life', 'Action']);

  const getStatusLabel = (status) => {
    if (status === 'FINISHED') return 'Completed';
    if (status === 'RELEASING') return 'Ongoing';
    return status || data?.info?.status || 'Ongoing';
  };

  return (
    <div id="detail-view" className="section-container page-transition">
      <div className="premium-detail-header">
        <div className="premium-cover-wrapper">
          <img src={data.image} className="premium-cover-bg" alt="Cover" />
          <div className="premium-cover-overlay"></div>
          
          <button className="premium-back-btn" onClick={() => router.back()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
        </div>

        <div className="premium-content">
          <div className="update-badge" style={{ background: getStatusLabel(data.status) === 'Completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 184, 0, 0.15)', color: getStatusLabel(data.status) === 'Completed' ? '#22c55e' : '#ffb800' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            {getStatusLabel(data.status)}
          </div>

          <h1 className="premium-title">{data.title}</h1>
          <p className="premium-subtitle">{data?.info?.japanese || data?.info?.english || ''}</p>

          <div className="detail-info-row" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="info-box">
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>Rating</span>
              <div className="stat-pill" style={{ background: 'rgba(255, 184, 0, 0.1)', border: '1px solid rgba(255, 184, 0, 0.2)', color: '#ffb800' }}>
                <span style={{ color: '#ffb800' }}>⭐</span> {data.rating && data.rating !== 'N/A' ? data.rating : (data?.info?.skor && data.info.skor !== 'N/A' ? data.info.skor : '8.5')}
              </div>
            </div>
            <div className="info-box">
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>Studio</span>
              <div className="stat-pill" style={{ fontWeight: '800' }}>{data.studio || data?.info?.studio || 'Zunime'}</div>
            </div>
            <div className="info-box">
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', display: 'block', marginBottom: '5px' }}>Rilis</span>
              <div className="stat-pill">{data.startDate || data?.info?.dirilis || 'Unknown'}</div>
            </div>
          </div>

          <div className="genre-section" style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '4px', height: '16px', background: 'var(--primary)', borderRadius: '2px' }}></div>
              Genre
            </h3>
            <div className="premium-genres" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {genres.map((g, i) => <span key={`${g}-${i}`} className="premium-genre-tag" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem' }}>{g}</span>)}
            </div>
          </div>

          <div className="premium-main-actions">
            <button className="btn-mulai" onClick={() => data.episodes?.[0] && router.push(`/watch/${encodeURIComponent(data.episodes[data.episodes.length - 1].url)}`)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Nonton
            </button>
            <button id="favBtn" className={`btn-sub ${isFavorite ? 'active' : ''}`} onClick={toggleFavorite}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              Favorit
            </button>
          </div>

          <div className="premium-synopsis-section">
            <h3>Synopsis</h3>
            <p style={{ textAlign: 'left' }}>{data.description || (data.episodes ? 'Tidak ada deskripsi tersedia.' : 'Memuat deskripsi...')}</p>
          </div>

          {data.relatedAnime && data.relatedAnime.length > 0 && (
            <div className="related-anime-section" style={{ marginTop: '25px' }}>
              <h3>Musim Terkait</h3>
              <div className="horizontal-scroll" style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                {data.relatedAnime.map((rel) => (
                  <div key={rel.url || rel.id} className="scroll-card" style={{ minWidth: '140px', cursor: 'pointer' }} onClick={() => {
                    if (typeof window !== 'undefined') {
                      const dataToSave = {
                        title: rel.title,
                        image: rel.image,
                        rating: rel.rating,
                        banner: rel.image,
                        genres: [],
                        status: 'Ongoing'
                      };
                      sessionStorage.setItem('pending_anime_detail', JSON.stringify(dataToSave));
                    }
                    router.push(`/anime/${encodeURIComponent(rel.id)}`);
                  }}>
                    <div className="scroll-card-img">
                      <img src={rel.image} alt={rel.title} />
                      <div className="ep-badge">⭐ {rel.rating}</div>
                    </div>
                    <div className="scroll-card-title">{rel.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="episode-section-container" style={{ padding: '20px' }}>
        <h2 style={{ color: 'white', marginBottom: '15px' }}>Daftar Episode</h2>
        {data.episodes ? (() => {
          const mergedProgressList = [...progressList];
          if (activeEpisode) {
            const cleanActiveSlug = activeEpisode.slug.replace(/^\/|\/$/g, '');
            const existingIdx = mergedProgressList.findIndex(p => {
              const cleanId = p.episode_id ? p.episode_id.replace(/^\/|\/$/g, '') : '';
              return cleanId === cleanActiveSlug;
            });
            const currentProg = {
              episode_id: activeEpisode.slug,
              progress: currentTime,
              duration: duration
            };
            if (existingIdx !== -1) {
              mergedProgressList[existingIdx] = currentProg;
            } else {
              mergedProgressList.push(currentProg);
            }
          }
          return <EpisodeList episodes={data.episodes} progressList={mergedProgressList} />;
        })() : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton style={{ width: '100%', height: '52px', borderRadius: '12px' }} />
            <Skeleton style={{ width: '100%', height: '52px', borderRadius: '12px' }} />
            <Skeleton style={{ width: '100%', height: '52px', borderRadius: '12px' }} />
          </div>
        )}
      </div>
    </div>
  );
}
