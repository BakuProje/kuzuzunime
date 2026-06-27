'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Skeleton from '@/app/components/Skeleton';
import EpisodeList from '@/app/components/EpisodeList';
import { supabase } from '@/lib/supabase';
import { usePlayer } from '@/app/components/PlayerContext';

// Helper to extract parent anime slug from episode slug
function getParentAnimeSlug(epUrl) {
  if (!epUrl) return '';
  try {
    const pathname = epUrl.startsWith('http') ? new URL(epUrl).pathname : epUrl;
    let clean = pathname.replace(/^\/|\/$/g, '');
    if (clean.startsWith('anime/')) {
      clean = clean.substring(6);
    }
    const parts = clean.split(/-episode-|-eps-|-ep-/i);
    if (parts.length > 0) {
      return `/anime/${parts[0]}/`;
    }
  } catch (e) {
    console.error(e);
  }
  return '';
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const { playEpisode, setIsMinimized, currentTime, duration, activeEpisode } = usePlayer();

  const [data, setData] = useState(null);
  const [parentData, setParentData] = useState(null);
  const [progressList, setProgressList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentStream, setCurrentStream] = useState('');
  const [activeServer, setActiveServer] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
    }, 250);
  };

  const slug = decodeURIComponent(params.slug);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      // Check auth session first: user must be logged in to watch
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/auth');
        return;
      }
      
      if (isMounted) {
        setUser(currentUser);
        setLoading(true);
      }
      
      try {
        const res = await fetch(`/api/watch?url=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json.data);
          if (json.data.streams && json.data.streams.length > 0) {
            // Smart Selector: select first non-blogspot/non-blogger server as default to prevent initial load errors
            let defaultIdx = json.data.streams.findIndex(s => {
              const name = (s.server || '').toLowerCase();
              return !name.includes('blogspot') && !name.includes('blogger');
            });
            if (defaultIdx === -1) {
              defaultIdx = 0;
            }
            setCurrentStream(json.data.streams[defaultIdx].url);
            setActiveServer(defaultIdx);
          }
          trackView(slug);

          // Get parent slug and fetch details
          const parent = getParentAnimeSlug(slug);
          if (parent) {
            const parentRes = await fetch(`/api/detail?url=${encodeURIComponent(parent)}`);
            const parentJson = await parentRes.json();
            if (parentJson.success && isMounted) {
              setParentData(parentJson.data);
              
              // Trigger progress upsert & refresh
              await saveProgress(slug, parent, parentJson.data);
              fetchProgress(parent);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [slug, router]);

  // Synchronize local stream/metadata updates to global player context
  useEffect(() => {
    if (data && currentStream) {
      const parent = getParentAnimeSlug(slug);
      const parentTitle = parentData ? parentData.title : data.title.split(' Episode ')[0];
      playEpisode({
        slug: slug,
        title: data.title,
        parentTitle: parentTitle,
        currentStream: currentStream,
        parentData: parentData,
        parentSlug: parent,
        activeServer: activeServer,
        streams: data.streams
      });
      setIsMinimized(false);
    }
  }, [slug, data, currentStream, parentData, activeServer]);

  const trackView = async (url) => {
    try {
      const { data: current } = await supabase.from('view_counts').select('views').eq('episode_id', url).maybeSingle();
      const views = current ? current.views + 1 : 1;
      await supabase.from('view_counts').upsert({ episode_id: url, views });
    } catch (e) { }
  };

  const saveProgress = async (episodeUrl, animeUrl, anime) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Use the actual currentTime from player context (not hardcoded)
      const actualProgress = currentTime || 0;
      const actualDuration = duration || 24 * 60;

      const cleanEp = episodeUrl ? episodeUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';
      const cleanAnime = animeUrl ? animeUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';
      
      await supabase.from('watch_progress').upsert({
        user_id: user.id,
        anime_id: cleanAnime,
        episode_id: cleanEp,
        anime_title: anime.title,
        anime_image: anime.image,
        progress: actualProgress,
        duration: actualDuration,
        updated_at: new Date()
      }, { onConflict: 'user_id,episode_id' });
    } catch (e) {
      console.error('Error saving progress:', e);
    }
  };

  const fetchProgress = async (parent) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const cleanAnime = parent ? parent.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';

      const { data } = await supabase
        .from('watch_progress')
        .select('episode_id, progress, duration')
        .eq('user_id', user.id)
        .eq('anime_id', cleanAnime);
        
      if (data) {
        setProgressList(data);
      }
    } catch (e) {
      console.error('Error fetching progress:', e);
    }
  };

  const getStatusLabel = (status) => {
    if (status === 'FINISHED' || status === 'Completed') return 'Tamat';
    if (status === 'RELEASING' || status === 'Ongoing') return 'Ongoing';
    return status || 'Ongoing';
  };

  if (loading) return <div className="section-container"><Skeleton className="video-wrapper" style={{ height: '220px', borderRadius: '0' }} /></div>;
  if (!data) return <div className="section-container">Video tidak ditemukan.</div>;

  const displayRating = parentData ? (parentData.rating && parentData.rating !== 'N/A' ? parentData.rating : (parentData.info?.skor && parentData.info.skor !== 'N/A' ? parentData.info.skor : '8.5')) : '8.5';
  const displayStudio = parentData ? (parentData.studio || parentData.info?.studio || 'Zunime') : 'Zunime';
  const displayStatus = parentData ? getStatusLabel(parentData.status || parentData.info?.status) : 'Ongoing';
  const parentTitle = parentData ? parentData.title : data.title.split(' Episode ')[0];

  // Parse current episode info for Youtube channel bar
  let displayEpisodeNum = 'Episode';
  let epNumMatch = data.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
  if (epNumMatch) displayEpisodeNum = `Episode ${epNumMatch[1]}`;
  else displayEpisodeNum = data.title;

  const displayViews = (Math.floor(Math.abs(data.title.length * 8.5) % 200) + 100) + '.000';
  const displayDate = parentData?.episodes?.find(e => e.url === slug)?.date || 'Baru Saja';

  return (
    <>
    <div id="watch-view" className="watch-content-wrapper fade-slide-up visible" style={{ paddingBottom: '100px' }}>
      
      {/* Video Player Spacer */}
      <div className="watch-player-spacer"></div>

      {/* Details Row */}
      <div className="watch-info-section" style={{ padding: '20px' }}>

        {/* Dynamic Pills Badge Row */}
        <div className="watch-pills-row" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', scrollbarWidth: 'none' }}>
          <span className="pill-badge">
            <span style={{ color: '#ffb800', marginRight: '2px' }}>⭐</span> {displayRating}
          </span>
          <span className="pill-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.8 }}>
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
            {displayStudio}
          </span>
          <span className="pill-badge" style={{ color: displayStatus === 'Tamat' ? '#22c55e' : '#ffb800' }}>
            <span className={`status-dot ${displayStatus === 'Tamat' ? 'completed' : 'ongoing'}`}></span>
            {displayStatus}
          </span>
          <span className="pill-badge" style={{ color: '#ffffff' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.9 }}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
            </svg>
            1080p HD
          </span>
        </div>

        {/* Profile/Channel bar below the pills */}
        <div className="watch-profile-row" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <img src={parentData?.image || data.image || '/Zunime.png'} alt="Cover" style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.1)'
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'white', margin: 0, lineHeight: '1.2' }}>
              {parentTitle}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {displayEpisodeNum} • {displayViews} views • {displayDate}
            </span>
          </div>
        </div>

        {/* Pilih Server Button */}
        <button className="server-btn" onClick={() => setIsModalOpen(true)} style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          background: 'var(--gradient)',
          color: 'white',
          fontWeight: '700',
          fontSize: '0.95rem',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '30px',
          boxShadow: '0 4px 15px rgba(255,0,0,0.2)'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
          Pilih Server ({data.streams?.[activeServer]?.server || 'Default'})
        </button>

        {/* Episode Selector List (Vertical scrollable list) */}
        {parentData?.episodes && parentData.episodes.length > 0 && (() => {
          const mergedProgressList = [...progressList];
          if (activeEpisode && (activeEpisode.slug === slug || activeEpisode.slug.replace(/^\/|\/$/g, '') === slug.replace(/^\/|\/$/g, ''))) {
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

          return (
            <div className="watch-episodes-list-wrapper" style={{ marginTop: '20px' }}>
              <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: '800', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '4px', height: '16px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                Episode List
                <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '4px' }}>({parentData.episodes.length})</span>
              </h2>
              <EpisodeList episodes={parentData.episodes} progressList={mergedProgressList} variant="square" activeUrl={slug} />
            </div>
          );
        })()}
      </div>
    </div>

    {/* Centered Server Modal Popup */}
    {isModalOpen && (
      <div className={`server-modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleCloseModal}>
        <div className={`server-modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="bottom-sheet-drag-handle"></div>
          <button className="server-modal-close" onClick={handleCloseModal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <h3 className="server-modal-title">Pilih Server Tersedia</h3>
          <div className="server-option-list">
            {data.streams.map((stream, idx) => (
              <button
                key={idx}
                className={`server-option-item ${activeServer === idx ? 'active' : ''}`}
                onClick={() => {
                  setCurrentStream(stream.url);
                  setActiveServer(idx);
                  handleCloseModal();
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{stream.server}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Server Pilihan</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
