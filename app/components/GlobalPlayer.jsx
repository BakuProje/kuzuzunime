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

  // Swipe-down minimize gesture — works on ENTIRE watch page, no button needed
  useEffect(() => {
    if (isMinimized || !isOpen) return;

    let touchStartY = 0;
    let scrollAtStart = 0;
    let isSwipeActive = false;

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      scrollAtStart = window.scrollY;
      isSwipeActive = false;
    };

    const handleTouchMove = (e) => {
      // Only activate swipe-to-minimize when scrolled to top
      if (scrollAtStart > 10) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY;

      // Only trigger downward swipe, ignore upward
      if (diffY > 15) {
        isSwipeActive = true;
        if (e.cancelable) e.preventDefault();
        dragY.set(diffY);
      }
    };

    const handleTouchEnd = () => {
      if (!isSwipeActive) {
        dragY.set(0);
        return;
      }

      const currentDragY = dragY.get();
      if (currentDragY > 80) {
        // Trigger minimize
        setIsMinimized(true);
        const parent = activeEpisode?.parentSlug || '/';
        router.push(parent);
      } else {
        // Spring back
        animate(dragY, 0, { type: 'spring', stiffness: 300, damping: 25 });
      }

      isSwipeActive = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMinimized, isOpen, dragY, activeEpisode, router, setIsMinimized]);

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
        {activeEpisode.currentStream && (
          <iframe
            id="video-player-iframe"
            src={activeEpisode.currentStream}
            allowFullScreen
            allow="autoplay"
            style={{ 
              pointerEvents: (isMinimized || isDragging) ? 'none' : 'auto',
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
          ></iframe>
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
