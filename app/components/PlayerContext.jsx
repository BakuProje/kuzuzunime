'use client';
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculateLevelUp } from '@/lib/levelUtils';
import ExpNotificationOverlay from './ExpNotificationOverlay';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [activeEpisode, setActiveEpisode] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = 24 * 60; // 24 minutes standard episode duration

  // State untuk notifikasi perolehan EXP
  const [showExpNotification, setShowExpNotification] = useState(false);
  const [expNotificationData, setExpNotificationData] = useState(null);

  // Fungsi untuk menutup notifikasi EXP secara bersih dan mengosongkan state (Root Cause Fix - Rule 4 & 6)
  // Dibungkus useCallback dengan dependency kosong agar referensi fungsinya stabil 100% dan tidak memicu rerender ulang useEffect di overlay
  const handleCloseExpNotification = useCallback(() => {
    setShowExpNotification(false);
    setExpNotificationData(null);
  }, []);

  // Cache to immediately reflect progress updates in the UI
  const [watchedEpisodes, setWatchedEpisodes] = useState({});

  const timerRef = useRef(null);
  const pendingExpTimeoutRef = useRef(null);
  const currentPlayingSlugRef = useRef(null);

  // Cleanup pending EXP popup timeout and refs on unmount
  useEffect(() => {
    return () => {
      if (pendingExpTimeoutRef.current) {
        clearTimeout(pendingExpTimeoutRef.current);
      }
      currentPlayingSlugRef.current = null;
    };
  }, []);

  // Simulated playback progress timer
  useEffect(() => {
    if (isOpen && isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            clearInterval(timerRef.current);
            return duration;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, isPlaying]);

  // Sync route changes to manage minimized/full states
  useEffect(() => {
    if (activeEpisode) {
      const isWatchPage = pathname.startsWith('/watch/');
      if (isWatchPage) {
        const decodedPathSlug = decodeURIComponent(pathname.replace('/watch/', ''));
        if (decodedPathSlug === activeEpisode.slug) {
          setIsMinimized(false);
        }
      } else {
        setIsMinimized(true);
      }
    }
  }, [pathname, activeEpisode]);

  const saveWatchProgress = async (episodeUrl, animeUrl, anime, progressSec) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Normalize slugs: remove leading/trailing slashes and route prefixes (e.g. 'anime/' or 'watch/')
      const cleanEpUrl = episodeUrl ? episodeUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';
      const cleanAnimeUrl = animeUrl ? animeUrl.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';

      // Update local cache immediately so UI reacts
      setWatchedEpisodes(prev => ({
        ...prev,
        [cleanEpUrl]: { progress: progressSec, duration: duration }
      }));

      await supabase.from('watch_progress').upsert({
        user_id: user.id,
        anime_id: cleanAnimeUrl,
        episode_id: cleanEpUrl,
        anime_title: anime?.title || 'Anime',
        anime_image: anime?.image || '/Zunime.png',
        progress: progressSec,
        duration: duration,
        updated_at: new Date()
      }, { onConflict: 'user_id,episode_id' });
    } catch (e) {
      console.error('Error saving progress in global context:', e);
    }
  };

  // Save progress periodically (every 5 seconds)
  useEffect(() => {
    if (!isOpen || !activeEpisode || currentTime === 0) return;

    if (currentTime % 5 === 0 || currentTime === duration) {
      saveWatchProgress(activeEpisode.slug, activeEpisode.parentSlug, activeEpisode.parentData, currentTime);
    }
  }, [currentTime, isOpen, activeEpisode]);

  // Helper untuk mengekstrak nomor episode dari judul
  const getEpNum = (title) => {
    if (!title) return null;
    const match = title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
    return match ? parseFloat(match[1]) : null;
  };

  // Fungsi untuk menganugerahi EXP ke user
  const awardExp = async (amount, reason) => {
    // Validasi awal: abaikan jika EXP yang didapatkan <= 0 atau tidak valid (Rule 1 & 5)
    if (!amount || amount <= 0) return;

    // Batalkan timeout pop-up sebelumnya jika ada yang tertunda
    if (pendingExpTimeoutRef.current) {
      clearTimeout(pendingExpTimeoutRef.current);
      pendingExpTimeoutRef.current = null;
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Ambil data profil saat ini
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('level, exp, total_exp, role, unlimited_exp')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile for EXP:', error);
        return;
      }

      const userRole = profile?.role || 'Anime Lover';
      const isUnlimited = profile?.unlimited_exp || userRole === 'Teman' || userRole === 'Dewa';

      // Buat ID unik berupa timestamp + random string untuk mencegah eksekusi ganda (Rule 8 & 9)
      const notificationId = `exp-notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (isUnlimited) {
        // Jika unlimited, cukup tampilkan pop-up animasi tanpa mengubah nilai angka di DB
        const notificationData = {
          id: notificationId,
          amount,
          reason,
          oldLevel: 1,
          newLevel: 1,
          oldExp: 0,
          newExp: 0,
          role: userRole,
          isUnlimited: true
        };

        if (reason === 'Tutup Player') {
          setExpNotificationData(notificationData);
          setShowExpNotification(true);
        } else {
          // Delay pop-up selama 2 detik saat masuk video agar iframe selesai loading terlebih dahulu
          pendingExpTimeoutRef.current = setTimeout(() => {
            setExpNotificationData(notificationData);
            setShowExpNotification(true);
            pendingExpTimeoutRef.current = null;
          }, 2000);
        }
        return;
      }

      // Hitung level baru
      const currentLvl = profile?.level || 1;
      const currentExp = profile?.exp || 0;
      const currentTotal = parseInt(profile?.total_exp) || 0;

      const { newLevel, newExp } = calculateLevelUp(currentLvl, currentExp, amount);
      const newTotal = currentTotal + amount;

      // Update database secara instan demi integritas data
      await supabase
        .from('profiles')
        .update({
          level: newLevel,
          exp: newExp,
          total_exp: newTotal
        })
        .eq('id', currentUser.id);

      // Siapkan data pop-up visual dengan ID unik
      const notificationData = {
        id: notificationId,
        amount,
        reason,
        oldLevel: currentLvl,
        newLevel: newLevel,
        oldExp: currentExp,
        newExp: newExp,
        role: userRole,
        isUnlimited: false
      };

      if (reason === 'Tutup Player') {
        setExpNotificationData(notificationData);
        setShowExpNotification(true);
      } else {
        // Delay pop-up selama 2 detik saat masuk video agar iframe selesai loading terlebih dahulu
        pendingExpTimeoutRef.current = setTimeout(() => {
          setExpNotificationData(notificationData);
          setShowExpNotification(true);
          pendingExpTimeoutRef.current = null;
        }, 2000);
      }
    } catch (e) {
      console.error('Error in awardExp:', e);
    }
  };

  const playEpisode = async (episodeData) => {
    // Deteksi alasan EXP berdasarkan episode sebelumnya
    let expReason = 'Nonton Anime';
    if (activeEpisode) {
      const prevAnime = activeEpisode.parentSlug || '';
      const newAnime = episodeData.parentSlug || '';
      
      if (prevAnime === newAnime && activeEpisode.slug !== episodeData.slug) {
        const prevNum = getEpNum(activeEpisode.title);
        const newNum = getEpNum(episodeData.title);
        
        if (prevNum !== null && newNum !== null) {
          if (newNum > prevNum) {
            expReason = 'Next Episode';
          } else if (newNum < prevNum) {
            expReason = 'Kembali ke Episode Sebelumnya';
          } else {
            expReason = 'Pilih Episode';
          }
        } else {
          expReason = 'Pilih Episode';
        }
      } else {
        expReason = 'Nonton Anime';
      }
    } else {
      expReason = 'Nonton Anime';
    }

    // Hanya beri EXP jika episode yang diputar berbeda dari yang aktif (menggunakan Ref sinkron untuk mencegah animasi berulang akibat race condition)
    if (currentPlayingSlugRef.current !== episodeData.slug) {
      currentPlayingSlugRef.current = episodeData.slug;
      const randExp = Math.floor(Math.random() * 191) + 10; // acak 10 s.d. 200 EXP
      awardExp(randExp, expReason);
    }

    setActiveEpisode(episodeData);
    setIsOpen(true);
    setIsMinimized(false);
    setIsPlaying(true);

    let initialTime = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const cleanEpUrl = episodeData.slug ? episodeData.slug.replace(/^\/|\/$/g, '').replace(/^(anime|watch)\//, '') : '';
        const { data } = await supabase
          .from('watch_progress')
          .select('progress')
          .eq('user_id', user.id)
          .or(`episode_id.eq.${episodeData.slug},episode_id.eq.${cleanEpUrl}`)
          .maybeSingle();

        if (data && data.progress) {
          initialTime = data.progress;
        }
      }
    } catch (e) {
      console.error('Error loading initial watch progress:', e);
    }

    setCurrentTime(initialTime);

    // Save initial progress to Supabase when starting play
    if (episodeData.slug && episodeData.parentSlug && episodeData.parentData) {
      saveWatchProgress(episodeData.slug, episodeData.parentSlug, episodeData.parentData, initialTime);
    }
  };

  const closePlayer = () => {
    if (activeEpisode) {
      if (currentTime > 0) {
        saveWatchProgress(activeEpisode.slug, activeEpisode.parentSlug, activeEpisode.parentData, currentTime);
      }
      
      // Berikan EXP saat player ditutup
      const randExp = Math.floor(Math.random() * 191) + 10; // acak 10 s.d. 200 EXP
      awardExp(randExp, 'Tutup Player');
    }
    
    setIsOpen(false);
    setActiveEpisode(null);
    currentPlayingSlugRef.current = null; // Reset ref agar bisa mendapat EXP lagi di pemutaran berikutnya
    setIsMinimized(false);
    setCurrentTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  return (
    <PlayerContext.Provider value={{
      activeEpisode,
      setActiveEpisode,
      isMinimized,
      setIsMinimized,
      isOpen,
      setIsOpen,
      isPlaying,
      setIsPlaying,
      currentTime,
      setCurrentTime,
      duration,
      playEpisode,
      closePlayer,
      watchedEpisodes
    }}>
      {children}
      <ExpNotificationOverlay
        isVisible={showExpNotification}
        onClose={handleCloseExpNotification}
        data={expNotificationData}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
