'use client';
// Zunime Premium Global Player Component
import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlayer } from './PlayerContext';
import { motion, useMotionValue, animate } from 'framer-motion';

export default function GlobalPlayer() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeEpisode,
    isMinimized,
    setIsMinimized,
    isOpen,
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    closePlayer
  } = usePlayer();

  const dragY = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startScrollRef = useRef(0);

  // Reset drag position when minimized, expanded, or closed
  useEffect(() => {
    dragY.set(0);
    setIsDragging(false);
    startYRef.current = 0;
  }, [isMinimized, isOpen, dragY]);

  // Minimize helper
  const handleMinimize = (e) => {
    if (e) e.stopPropagation();
    setIsMinimized(true);
    const parent = activeEpisode?.parentSlug || '/';
    router.push(parent);
  };

  if (!isOpen || !activeEpisode) return null;

  const handleExpand = () => {
    setIsMinimized(false);
    setIsPlaying(true);
    router.push(`/watch/${encodeURIComponent(activeEpisode.slug)}`);
  };

  const togglePlayPause = (e) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  // Determine if bottom nav is currently visible on this path
  const hideOn = ['/watch', '/anime', '/auth', '/profile'];
  const hasBottomNav = !hideOn.some(path => pathname === path || pathname.includes(path));

  // Parse episode display text
  let displayEpisodeNum = 'Episode';
  let epNumMatch = activeEpisode.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
  if (epNumMatch) displayEpisodeNum = `Episode ${epNumMatch[1]}`;
  else displayEpisodeNum = activeEpisode.title;

  // Format time helper
  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const fullTitleText = `${activeEpisode.parentTitle || ''} ${displayEpisodeNum}`;
  const displayImage = activeEpisode.parentData?.image || activeEpisode.image || '/Zunime.png';

  const playerStyle = isMinimized
    ? {
        y: dragY,
        top: 'auto',
        bottom: hasBottomNav ? '80px' : '15px',
        left: '10px',
        right: '10px',
        width: 'calc(100vw - 20px)',
        height: '72px'
      }
    : {
        y: dragY,
        top: 0,
        bottom: 'auto',
        left: 0,
        right: 'auto',
        width: '100vw',
        height: 'auto'
      };

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      style={playerStyle}
      className={`global-player-container ${isMinimized ? 'minimized' : 'expanded'} ${hasBottomNav ? 'with-nav' : ''}`}
    >
      {/* Video Viewport Frame — iframe is ALWAYS mounted, never changes src */}
      <div className="global-player-video-section" style={{ position: 'relative' }}>
        {!isMinimized && (
          <button
            className="player-minimize-top-btn"
            onClick={handleMinimize}
            aria-label="Minimize Player"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 30,
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        )}

        {activeEpisode.currentStream ? (
          <iframe
            key={activeEpisode.currentStream}
            id="video-player-iframe"
            src={activeEpisode.currentStream}
            allowFullScreen
            referrerPolicy="no-referrer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            style={{ 
              pointerEvents: (isMinimized || isDragging) ? 'none' : 'auto',
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
          ></iframe>
        ) : (
          <div 
            key="maintenance-fallback"
            style={{
            width: '100%',
            height: '100%',
            background: '#050505',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
            color: 'white',
            aspectRatio: '16/9'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff0000" strokeWidth="2" style={{ marginBottom: '10px' }}>
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '5px' }}>Server Sedang Sibuk / Maintenance</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
              Link video dari server Nekopoi/Samehadaku tidak tersedia saat ini. Silakan coba beberapa saat lagi.
            </p>
          </div>
        )}
      </div>

      {/* Mini-player content bar (visible in minimized state) */}
      {isMinimized && (
        <div className="mini-player-contents" onClick={handleExpand}>
          <div className="mini-player-info">
            <span className="mini-player-title">{fullTitleText}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
              Sedang Diputar
            </span>
          </div>

          <div className="mini-player-controls" onClick={(e) => e.stopPropagation()}>
            {/* Play/Pause button and fake timer removed because external iframes cannot be synced or paused programmatically without restarting */}
            <button className="mini-control-btn close-btn" onClick={closePlayer} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
