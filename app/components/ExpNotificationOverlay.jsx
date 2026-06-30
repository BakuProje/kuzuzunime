'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLevelData } from '@/lib/levelUtils';

export default function ExpNotificationOverlay({ isVisible, onClose, data }) {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [barPercent, setBarPercent] = useState(0);
  const [isLevelUpAnim, setIsLevelUpAnim] = useState(false);
  const [showCounter, setShowCounter] = useState(0);
  const lastProcessedIdRef = useRef(null);

  useEffect(() => {
    // Guard awal: pastikan visible, data ada, dan amount > 0 (Rule 1 & 5)
    if (!isVisible || !data || Number(data.amount) <= 0) return;

    const { id, oldLevel, newLevel, oldExp, newExp, isUnlimited, amount } = data;

    // Cegah eksekusi ganda untuk ID notifikasi yang sama (Strict Mode, re-renders, dll.) (Rule 8 & 9)
    if (lastProcessedIdRef.current === id) {
      return;
    }
    lastProcessedIdRef.current = id;

    // Hitung data level awal
    const oldLevelInfo = getLevelData(oldLevel, data.role, isUnlimited);
    const newLevelInfo = getLevelData(newLevel, data.role, isUnlimited);

    const oldPercent = isUnlimited ? 100 : Math.round((oldExp / oldLevelInfo.nextLevelExp) * 100);
    const newPercent = isUnlimited ? 100 : Math.round((newExp / newLevelInfo.nextLevelExp) * 100);

    // Reset status awal
    setCurrentLevel(oldLevel);
    setIsLevelUpAnim(false);
    setBarPercent(oldPercent);
    setShowCounter(0);

    // Phase 1: Animasi angka EXP bertambah (+XP) - mengacak / tick up
    let count = 0;
    const target = amount;
    const countDuration = 800; // ms
    const stepTime = Math.max(15, Math.round(countDuration / (target / Math.ceil(target / 20))));
    
    let counterTimer;
    let barTimer1;
    let barTimer2;
    let barTimer3;
    let closeTimer;

    counterTimer = setInterval(() => {
      count += Math.ceil(target / 20); // Increment step
      if (count >= target) {
        setShowCounter(target);
        clearInterval(counterTimer);
        
        // Phase 2: Mulai animasi Progress Bar setelah angka EXP diam
        startProgressBarAnimation();
      } else {
        setShowCounter(count);
      }
    }, 40);

    function startProgressBarAnimation() {
      if (newLevel > oldLevel && !isUnlimited) {
        // 1. Isi bar lama sampai penuh (100%)
        setBarPercent(100);

        // 2. Tunggu bar penuh, lalu reset dan naik level
        barTimer1 = setTimeout(() => {
          setIsLevelUpAnim(true);
          setCurrentLevel(newLevel);
          setBarPercent(0);

          // 3. Isi bar ke persentase level baru dari 0%
          barTimer2 = setTimeout(() => {
            setBarPercent(newPercent);
            
            // 4. Tunggu bar baru selesai mengisi, lalu mulai hitung mundur 3 detik untuk tutup
            barTimer3 = setTimeout(() => {
              triggerCloseCountdown();
            }, 600); // Durasi mengisi bar baru
          }, 150); // Delay reset
        }, 600); // Durasi mengisi bar lama
      } else {
        // Hanya isi progress bar biasa
        setBarPercent(newPercent);
        
        // Tunggu bar selesai mengisi, lalu mulai hitung mundur 3 detik untuk tutup
        barTimer1 = setTimeout(() => {
          triggerCloseCountdown();
        }, 600);
      }
    }

    function triggerCloseCountdown() {
      // Phase 3: Diam selama 3 detik setelah semua animasi selesai, lalu hilangkan pop up
      closeTimer = setTimeout(() => {
        onClose();
      }, 3000);
    }

    return () => {
      clearInterval(counterTimer);
      clearTimeout(barTimer1);
      clearTimeout(barTimer2);
      clearTimeout(barTimer3);
      clearTimeout(closeTimer);
    };
  }, [isVisible, data, onClose]);

  const hasData = data && Number(data.amount) > 0;
  const showContent = isVisible && hasData;
  const currentInfo = hasData ? getLevelData(currentLevel, data.role, data.isUnlimited) : null;

  return (
    <AnimatePresence>
      {showContent && currentInfo && (
        <div className="exp-overlay-fixed-container">
          {/* Backdrop Glassmorphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="exp-overlay-backdrop"
            onClick={onClose}
          />

          {/* Card Tengah */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className={`exp-premium-card ${isLevelUpAnim ? 'level-up-glow' : ''}`}
          >
            {/* Aksen Teks Vertikal Jepang Dekoratf */}
            <div className="japanese-watermark-bg">
              {isLevelUpAnim ? 'レベルアップ' : '経験値獲得'}
            </div>

            {/* Animasi Kenaikan EXP (+XP) - Centered & Premium */}
            <div className="exp-gain-display">
              <motion.span
                initial={{ y: 15, scale: 0.7 }}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="exp-gain-number"
              >
                +{showCounter}
              </motion.span>
              <span className="exp-gain-label">EXP</span>
            </div>

            {/* Informasi Rank dan Icon */}
            <div className="exp-rank-profile">
              <div className="rank-icon-container">
                <img
                  src={currentInfo.icon}
                  alt={currentInfo.rankName}
                  className="rank-icon-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/Zunime.png';
                  }}
                />
                <div className="rank-icon-glow-ring"></div>
              </div>

              <div className="rank-text-details">
                <div className="rank-level-number">
                  {currentInfo.isUnlimited ? (
                    <span className="level-text">Lv. <span className="infinite-symbol">∞</span></span>
                  ) : (
                    <span className="level-text">Lv. {currentLevel}</span>
                  )}
                  {isLevelUpAnim && (
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: [1.3, 1], opacity: 1 }}
                      className="level-up-badge"
                    >
                      LEVEL UP!
                    </motion.span>
                  )}
                </div>
                <div 
                  className="rank-name-title"
                  style={{
                    color: currentInfo.rankName === 'Rookie Otaku' ? '#ff0000' : undefined,
                    textShadow: currentInfo.rankName === 'Rookie Otaku' ? '0 0 8px rgba(255, 0, 0, 0.5)' : undefined
                  }}
                >
                  {currentInfo.rankName}
                </div>
              </div>
            </div>

            {/* Progress Bar Tema Merah Saja */}
            <div className="exp-progress-section">
              <div className="exp-progress-labels">
                {currentInfo.isUnlimited ? (
                  <>
                    <span>EXP TERKUMPUL</span>
                    <span>UNLIMITED</span>
                  </>
                ) : (
                  <>
                    <span>PROGRESS BAR</span>
                    <span>
                      {isLevelUpAnim ? '0' : data.newExp} / {currentInfo.nextLevelExp} EXP
                    </span>
                  </>
                )}
              </div>
              
              <div className="modern-japanese-bar-container">
                <div 
                  className="modern-japanese-bar-fill" 
                  style={{ width: `${barPercent}%` }}
                >
                  <div className="bar-neon-glow"></div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CSS Stylesheet khusus bertema Premium Jepang Modern (Merah Saja) */}
          <style jsx global>{`
            .exp-overlay-fixed-container {
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              z-index: 99999;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Outfit', 'Inter', sans-serif;
              pointer-events: auto;
            }

            .exp-overlay-backdrop {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(3, 3, 3, 0.78);
              backdrop-filter: blur(14px);
              -webkit-backdrop-filter: blur(14px);
            }

            .exp-premium-card {
              position: relative;
              width: 90%;
              max-width: 340px;
              background: #09090b;
              border: 2px solid rgba(255, 0, 0, 0.25);
              border-radius: 20px;
              padding: 25px 20px;
              overflow: hidden;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8),
                          0 0 30px rgba(255, 0, 0, 0.08);
              z-index: 10;
              transition: border-color 0.4s ease, box-shadow 0.4s ease;
            }

            .exp-premium-card.level-up-glow {
              border-color: #ff0000;
              box-shadow: 0 10px 45px rgba(255, 0, 0, 0.45),
                          0 0 35px rgba(255, 0, 0, 0.2);
              animation: cardPulse 1.5s infinite alternate;
            }

            @keyframes cardPulse {
              0% { box-shadow: 0 10px 40px rgba(255, 0, 0, 0.35), 0 0 25px rgba(255, 0, 0, 0.15); }
              100% { box-shadow: 0 10px 45px rgba(255, 0, 0, 0.55), 0 0 45px rgba(255, 0, 0, 0.35); }
            }

            /* Watermark Jepang Tradisional/Modern */
            .japanese-watermark-bg {
              position: absolute;
              top: -15px;
              right: -20px;
              writing-mode: vertical-rl;
              font-size: 4rem;
              font-weight: 900;
              color: rgba(255, 255, 255, 0.012);
              letter-spacing: 5px;
              font-family: 'Noto Sans JP', sans-serif;
              pointer-events: none;
              user-select: none;
            }

            .exp-gain-display {
              display: flex;
              align-items: baseline;
              justify-content: center;
              gap: 8px;
              margin-bottom: 20px;
            }

            .exp-gain-number {
              font-size: 3.2rem;
              font-weight: 900;
              color: white;
              line-height: 1;
              font-family: 'Outfit', sans-serif;
              background: linear-gradient(135deg, #ffffff 30%, #a1a1aa 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }

            .exp-gain-label {
              font-size: 1.1rem;
              font-weight: 800;
              color: #ff0000;
              letter-spacing: 1px;
              text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
            }

            .exp-rank-profile {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
              background: rgba(255, 255, 255, 0.015);
              border: 1px solid rgba(255, 255, 255, 0.03);
              border-radius: 16px;
              padding: 12px;
              margin-bottom: 20px;
            }

            .rank-icon-container {
              position: relative;
              width: 50px;
              height: 50px;
              border-radius: 50%;
              overflow: visible;
              flex-shrink: 0;
            }

            .rank-icon-image {
              width: 100%;
              height: 100%;
              border-radius: 50%;
              object-fit: cover;
              border: 2px solid #18181b;
              z-index: 2;
              position: relative;
            }

            .rank-icon-glow-ring {
              position: absolute;
              top: -3px;
              left: -3px;
              right: -3px;
              bottom: -3px;
              border-radius: 50%;
              background: linear-gradient(45deg, #ff0000, #ff4d4d);
              z-index: 1;
              opacity: 0.8;
              box-shadow: 0 0 12px rgba(255, 0, 0, 0.3);
            }

            .rank-text-details {
              display: flex;
              flex-direction: column;
              gap: 2px;
              text-align: left;
            }

            .rank-level-number {
              display: flex;
              align-items: center;
              gap: 6px;
            }

            .level-text {
              font-size: 1.15rem;
              font-weight: 900;
              color: white;
            }

            .infinite-symbol {
              font-size: 1.35rem;
              color: #ff0000;
              text-shadow: 0 0 8px #ff0000;
              font-family: system-ui, sans-serif;
            }

            .level-up-badge {
              background: #ff0000;
              color: white;
              font-size: 0.55rem;
              font-weight: 900;
              padding: 2px 6px;
              border-radius: 4px;
              letter-spacing: 0.5px;
              box-shadow: 0 0 10px #ff0000;
            }

            .rank-name-title {
              font-size: 0.8rem;
              font-weight: 700;
              color: #a1a1aa;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            /* Desain Progress Bar Modern Jepang (Hitam, Merah) */
            .exp-progress-section {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .exp-progress-labels {
              display: flex;
              justify-content: space-between;
              font-size: 0.65rem;
              font-weight: 800;
              color: #71717a;
              letter-spacing: 1px;
            }

            .modern-japanese-bar-container {
              width: 100%;
              height: 12px;
              background: #050505; /* Hitam Pekat */
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 30px;
              overflow: hidden;
              position: relative;
              box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8);
            }

            .modern-japanese-bar-fill {
              height: 100%;
              /* Red Gradient */
              background: linear-gradient(90deg, #ff0000 0%, #ff4d4d 100%);
              border-radius: 30px;
              position: relative;
              transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .bar-neon-glow {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
              animation: barShine 2s infinite linear;
              box-shadow: 0 0 10px rgba(255, 0, 0, 0.4);
            }

            @keyframes barShine {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
}
