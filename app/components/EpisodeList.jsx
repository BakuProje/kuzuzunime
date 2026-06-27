'use client';
import Link from 'next/link';
import { usePlayer } from './PlayerContext';

export default function EpisodeList({ episodes, progressList = [], variant = 'grid', activeUrl = '' }) {
  // Pull active episode and currentTime in real-time from the player context
  const { watchedEpisodes, activeEpisode, currentTime } = usePlayer() || { 
    watchedEpisodes: {}, 
    activeEpisode: null, 
    currentTime: 0 
  };

  if (!episodes || episodes.length === 0) return <p>No episodes found.</p>;

  // Helper to normalize slugs consistently
  const normalizeSlug = (slug) => {
    if (!slug) return '';
    return slug
      .replace(/^\/|\/$/g, '')              // remove leading/trailing slashes
      .replace(/^(anime|watch)\//, '');     // remove leading anime/ or watch/ prefixes
  };

  // Map database progress list for quick lookup
  const progressMap = {};
  progressList.forEach(item => {
    if (item.episode_id) {
      const cleanPath = normalizeSlug(item.episode_id);
      progressMap[cleanPath] = item;
      progressMap[item.episode_id] = item;
    }
  });

  // Merge local cache from PlayerContext into progressMap to immediately reflect closed/saved episodes
  if (watchedEpisodes) {
    Object.keys(watchedEpisodes).forEach(rawUrl => {
      const cleanKey = normalizeSlug(rawUrl);
      progressMap[cleanKey] = {
        progress: watchedEpisodes[rawUrl].progress,
        duration: watchedEpisodes[rawUrl].duration,
        episode_id: cleanKey
      };
    });
  }

  // Sort episodes ascending (episode 1 first)
  const sortedEpisodes = [...episodes].reverse();

  // Custom SVG Lock Icon matching the premium theme
  const LockIcon = () => (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={{ opacity: 0.6, verticalAlign: 'middle' }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  // Helper to format seconds to M:SS
  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanActiveUrl = normalizeSlug(activeUrl);

  // 1. Horizontal scrollable square selector (Watch Page)
  if (variant === 'square') {
    return (
      <div className="square-ep-scroll">
        {sortedEpisodes.map((ep, idx) => {
          let epNum = idx + 1;
          let epNumMatch = ep.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
          if (epNumMatch) epNum = parseFloat(epNumMatch[1]);

          const cleanEpUrl = normalizeSlug(ep.url);
          
          // Check if this specific episode is currently active and playing in the player
          const isCurrentlyPlaying = activeEpisode && (
            normalizeSlug(activeEpisode.slug) === cleanEpUrl
          );

          let currentProgress = 0;
          let currentDuration = 24 * 60; // default 24 minutes

          const prog = progressMap[cleanEpUrl] || progressMap[ep.url];
          if (prog) {
            currentProgress = prog.progress;
            currentDuration = prog.duration || 24 * 60;
          }

          // Real-time Override: If currently playing, use the live currentTime from context
          if (isCurrentlyPlaying) {
            currentProgress = currentTime;
          }

          const progressPercent = currentDuration > 0 ? Math.min(100, Math.round((currentProgress / currentDuration) * 100)) : 0;
          const isActive = cleanEpUrl === cleanActiveUrl || isCurrentlyPlaying;
          const isWatched = progressPercent > 0 || currentProgress > 0;

          return (
            <Link href={`/watch/${encodeURIComponent(ep.url)}`} key={ep.url}>
              <div className={`square-ep-item ${isActive ? 'active' : ''} ${isWatched ? 'watched' : ''}`}>
                {epNum}
                {/* Show lock only if not watched and not active */}
                {!isWatched && !isActive && (
                  <div className="square-ep-lock">
                    <LockIcon />
                  </div>
                )}
                {/* Progress bar at bottom */}
                {progressPercent > 0 && (
                  <div className="square-ep-progress" style={{ width: `${progressPercent}%`, background: '#ff0000', boxShadow: '0 0 5px #ff0000' }} />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  // 2. Vertical list of premium cards (Anime Details Page)
  return (
    <div className="episode-grid" id="episode-grid">
      {sortedEpisodes.map((ep, idx) => {
        let epNum = idx + 1;
        let epNumMatch = ep.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
        if (epNumMatch) epNum = parseFloat(epNumMatch[1]);

        let displayTitle = ep.title;
        if (epNumMatch) displayTitle = `Episode ${epNumMatch[1]}`;

        const views = ((parseInt(epNum) || idx + 1) * 12.3 + 30).toFixed(1) + 'K';
        const timeAgo = ep.date || 'Terbaru';

        const cleanEpUrl = normalizeSlug(ep.url);
        
        // Check if this specific episode is currently active and playing in the player
        const isCurrentlyPlaying = activeEpisode && (
          normalizeSlug(activeEpisode.slug) === cleanEpUrl
        );

        let currentProgress = 0;
        let currentDuration = 24 * 60; // default 24 minutes

        const prog = progressMap[cleanEpUrl] || progressMap[ep.url];
        if (prog) {
          currentProgress = prog.progress;
          currentDuration = prog.duration || 24 * 60;
        }

        // Real-time Override: If currently playing, use the live currentTime from context
        if (isCurrentlyPlaying) {
          currentProgress = currentTime;
        }

        const progressPercent = currentDuration > 0 ? Math.min(100, Math.round((currentProgress / currentDuration) * 100)) : 0;
        const progressTime = `${formatTime(currentProgress)}/${formatTime(currentDuration)}`;
        const isActive = cleanEpUrl === cleanActiveUrl || isCurrentlyPlaying;
        const isWatched = progressPercent > 0 || currentProgress > 0;

        return (
          <Link href={`/watch/${encodeURIComponent(ep.url)}`} key={ep.url}>
            <div className="premium-ep-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div className="ep-left">
                <span className="ep-main-title">{displayTitle}</span>
                <div className="ep-meta-bottom">
                  <span>👁 {views}</span>
                </div>
              </div>

              <div className="ep-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span className="ep-time">{timeAgo}</span>
                {(isWatched || isActive) ? (
                  <span style={{ fontSize: '0.7rem', color: '#ff0000', fontWeight: '600' }}>{progressTime}</span>
                ) : (
                  <LockIcon />
                )}
              </div>

              {/* Watch Progress Red Line at bottom of the card */}
              {progressPercent > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: `${progressPercent}%`,
                  height: '3px',
                  background: '#ff0000',
                  boxShadow: '0 0 5px #ff0000',
                  transition: 'width 0.3s ease'
                }} />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
