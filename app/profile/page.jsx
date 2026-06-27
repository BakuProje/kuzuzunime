'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { getLevelData, calculateLevelDown } from '@/lib/levelUtils';

// Removed PRESET_AVATARS as we now upload from local device

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    username: 'User Zunime',
    email: 'loading...',
    role: 'User',
    created_at: new Date().toISOString(),
    avatar_url: '/Zunime.png'
  });
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [globalRank, setGlobalRank] = useState(null);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' or 'history'

  // Modals state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const fileInputRef = useRef(null);

  const [modalLoading, setModalLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const router = useRouter();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };

  // Prevent scrolling when any full-screen modal is open
  useEffect(() => {
    if (isUsernameModalOpen || isEmailModalOpen || isPasswordModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isUsernameModalOpen, isEmailModalOpen, isPasswordModalOpen]);

  useEffect(() => {
    async function fetchProfileAndData() {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error || !currentUser) {
          if (error) {
            console.warn("Auth error:", error.message);
            await supabase.auth.signOut();
          }
          router.push('/auth');
          return;
        }

        // 1. Profile Query & Fallback Upsert
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
        } else {
          const fallback = {
            id: currentUser.id,
            username: currentUser.user_metadata?.display_name || currentUser.email.split('@')[0] || 'User Zunime',
            email: currentUser.email,
            role: 'User',
            avatar_url: '/Zunime.png',
            created_at: currentUser.created_at,
            level: 1,
            exp: 0,
            total_exp: 0,
            unlimited_exp: false
          };
          await supabase.from('profiles').insert(fallback);
          setProfile(fallback);
        }

        // Fetch Global Rank using RPC
        const { data: rankData, error: rankError } = await supabase.rpc('get_user_rank', {
          target_user_id: currentUser.id
        });
        if (!rankError && rankData !== null) {
          setGlobalRank(rankData);
        }

        // 2. Favorites Query
        const { data: favData } = await supabase
          .from('favorites')
          .select('anime_data, created_at')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (favData) {
          setFavorites(favData.map(item => {
            const anime = item.anime_data || {};
            return {
              title: anime.title || 'Anime',
              image: anime.image || '/Zunime.png',
              url: anime.url || anime.anime_id || '',
              score: anime.score || '0.0',
              episode: anime.episode || 'Ongoing',
              status: anime.status || 'Ongoing'
            };
          }));
        }

        // 3. Watch Progress Query (Watch History)
        const { data: histData } = await supabase
          .from('watch_progress')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('updated_at', { ascending: false });

        if (histData) {
          setHistory(histData);
        }

      } catch (e) {
        console.error('Error fetching profile data:', e);
        showToast('Gagal memuat data profil!', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchProfileAndData();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      showToast("Password tidak boleh kosong!", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password minimal 6 karakter!", "error");
      return;
    }

    setModalLoading(true);

    // 1. Update password in Supabase Auth
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });

    if (authError) {
      setModalLoading(false);
      showToast("Gagal mereset password: " + authError.message, "error");
      return;
    }

    setModalLoading(false);
    showToast("Password berhasil diperbarui!");
    setIsPasswordModalOpen(false);
    setNewPassword('');
  };

  const handleEmailChangeSubmit = async (e) => {
    e.preventDefault();
    if (!newEmail || newEmail === profile.email) {
      showToast("Masukkan email baru yang berbeda!", "error");
      return;
    }

    setModalLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setModalLoading(false);

    if (error) {
      showToast("Gagal: " + error.message, "error");
    } else {
      showToast("Cek inbox email BARU kamu untuk konfirmasi!");
      setIsEmailModalOpen(false);
      setNewEmail('');
    }
  };

  const handleUsernameChangeSubmit = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      showToast("Username tidak boleh kosong!", "error");
      return;
    }

    setModalLoading(true);

    const userRole = profile.role || 'User';
    const isSpecial = userRole === 'Admin' || userRole === 'Teman' || userRole === 'Dewa';

    if (isSpecial) {
      // Admin, Teman, Dewa tidak dipotong EXP
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', profile.id);

      setModalLoading(false);

      if (error) {
        showToast("Gagal mengubah username: " + error.message, "error");
      } else {
        showToast("Username berhasil diperbarui!");
        setProfile({ ...profile, username: newUsername });
        setIsUsernameModalOpen(false);
        setNewUsername('');
      }
    } else {
      // User biasa dipotong EXP acak (antara 50 s.d. 300 EXP)
      const deductAmount = Math.floor(Math.random() * 251) + 50;

      const currentLvl = profile.level || 1;
      const currentExp = profile.exp || 0;
      const currentTotal = parseInt(profile.total_exp) || 0;

      const { newLevel, newExp, newTotalExp } = calculateLevelDown(currentLvl, currentExp, currentTotal, deductAmount);

      const { error } = await supabase
        .from('profiles')
        .update({
          username: newUsername,
          level: newLevel,
          exp: newExp,
          total_exp: newTotalExp
        })
        .eq('id', profile.id);

      setModalLoading(false);

      if (error) {
        showToast("Gagal mengubah username: " + error.message, "error");
      } else {
        showToast(`Username diperbarui! EXP dipotong ${deductAmount} EXP.`);
        setProfile({
          ...profile,
          username: newUsername,
          level: newLevel,
          exp: newExp,
          total_exp: newTotalExp
        });

        // Panggil ulang peringkat global karena total_exp berubah
        const { data: rankData } = await supabase.rpc('get_user_rank', {
          target_user_id: profile.id
        });
        if (rankData !== null) {
          setGlobalRank(rankData);
        }

        setIsUsernameModalOpen(false);
        setNewUsername('');
      }
    }
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast("Hanya file gambar yang diperbolehkan!", "error");
      return;
    }

    setModalLoading(true);
    showToast("Memproses foto...", "success");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: dataUrl })
          .eq('id', profile.id);

        setModalLoading(false);

        if (error) {
          showToast("Gagal menyimpan avatar: " + error.message, "error");
        } else {
          showToast("Avatar berhasil diperbarui!");
          setProfile({ ...profile, avatar_url: dataUrl });
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
      };
    };
    reader.onerror = () => {
      setModalLoading(false);
      showToast("Gagal membaca file gambar", "error");
    };
  };

  // Stats Calculations
  const totalWatchMinutes = Math.floor(
    history.reduce((acc, curr) => acc + (curr.progress || 0), 0) / 60
  );

  const uniqueAnimeCount = new Set(history.map((h) => h.anime_id)).size;

  // Level Progression System (New Database-backed Level System)
  const userLevel = profile.level || 1;
  const userExp = profile.exp || 0;
  const userTotalExp = profile.total_exp || 0;
  const isUnlimited = profile.unlimited_exp || profile.role === 'Teman' || profile.role === 'Dewa';

  const levelInfo = getLevelData(userLevel, profile.role, isUnlimited);
  const levelPercent = isUnlimited ? 100 : Math.round((userExp / levelInfo.nextLevelExp) * 100);
  const nextLevelInfo = getLevelData(userLevel + 1, profile.role, isUnlimited);
  const nextRankName = nextLevelInfo.rankName !== levelInfo.rankName
    ? nextLevelInfo.rankName
    : `${nextLevelInfo.rankName} (Lv. ${userLevel + 1})`;

  const roleClass = profile.role ? profile.role.replace(' ', '').toLowerCase() : 'user';
  const createdDate = new Date(profile.created_at || new Date()).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (loading) {
    return (
      <div id="profile-view-v2" className="profile-container-premium">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '15px' }}>
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Outfit', fontWeight: 'bold' }}>ZUNIME PROFILE...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="profile-view-v2" className="profile-container-premium">
      {/* Toast Notification */}
      {toast.message && (
        <div id="toast-container" className="toast-top-center-premium">
          <div className={`toast-premium ${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? '✓' : '✗'}</span>
            <span className="toast-text">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Full-width Hero Banner */}
      <div className="profile-hero-banner">
        <div className="banner-overlay-grad"></div>
        <button className="btn-profile-banner-back" onClick={() => router.push('/')} aria-label="Go Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Full Content Stream */}
      <div className="profile-content-full">
        <div className="profile-details-content">
          {/* Profile picture inside the card */}
          <div className="profile-avatar-wrapper" style={{ marginTop: '-15px', marginBottom: '20px' }}>
            <div className="profile-avatar-container" onClick={() => fileInputRef.current?.click()}>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
              <img src={profile.avatar_url || '/Zunime.png'} alt="Profile" className="profile-avatar-img" />
              <div className="avatar-edit-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="profile-username-row">
            <h2>{profile.username || 'User Zunime'}</h2>
            <button className="btn-icon-edit-username" onClick={() => { setNewUsername(profile.username); setIsUsernameModalOpen(true); }} aria-label="Edit Username">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
          <p className="profile-email-sub">{profile.email}</p>

          {/* Sistem Level & EXP Baru */}
          <div className="wibu-level-section new-level-theme" style={{ marginTop: '5px', padding: '12px 0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <div className="wibu-level-info" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              {/* Left: Rank Badge Icon, cropped cleanly to remove the red border */}
              <div className="profile-rank-badge-img" style={{
                position: 'relative',
                width: '56px',
                height: '56px',
                flexShrink: 0,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#0a0a0c'
              }}>
                <img
                  src={levelInfo.icon}
                  alt={levelInfo.rankName}
                  style={{
                    width: '126%',
                    height: '126%',
                    position: 'absolute',
                    top: '-13%',
                    left: '-13%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/Zunime.png'; }}
                />
              </div>

              {/* Right: Info Column stacked vertically for clean layout on mobile */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px', textAlign: 'left' }}>
                {/* Row 1: Lv. X Rank Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    className="lvl-title"
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: '800',
                      color: levelInfo.rankName.includes('Rookie Otaku') || levelInfo.rankName === 'Rookie Otaku' ? '#ff0055' : 'white',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      textShadow: levelInfo.rankName.includes('Rookie Otaku') || levelInfo.rankName === 'Rookie Otaku' ? '0 0 8px rgba(255,0,85,0.5)' : 'none',
                      margin: 0
                    }}
                  >
                    {levelInfo.rankName}
                  </span>
                  <span className="lvl-badge" style={{ background: '#ff0055', color: 'white', fontWeight: '900', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', textShadow: '0 0 4px rgba(255,0,85,0.4)' }}>
                    LV. {levelInfo.level}
                  </span>
                </div>

                {/* Row 2: Rank Global (on a separate line, not combined) */}
                {globalRank !== null && (
                  <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#00f0ff', textShadow: '0 0 5px rgba(0,240,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                    Rank Global: {globalRank}
                  </div>
                )}

                {/* Row 3: EXP Information */}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  {isUnlimited ? 'EXP Terkumpul: Tanpa Batas (Unlimited)' : `EXP: ${userExp} / ${levelInfo.nextLevelExp}`}
                </span>
              </div>
            </div>

            {/* Progress Bar Tema Jepang Modern (Merah Saja) */}
            <div className="modern-japanese-bar-container-profile" style={{
              width: '100%',
              height: '12px',
              background: '#050505',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '30px',
              overflow: 'hidden',
              position: 'relative',
              marginTop: '15px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)'
            }}>
              <div className="modern-japanese-bar-fill-profile" style={{
                width: `${levelPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ff0000 0%, #ff4d4d 100%)',
                borderRadius: '30px',
                position: 'relative',
                boxShadow: '0 0 8px rgba(255, 0, 0, 0.4)',
                transition: 'width 0.5s ease'
              }}>
                <div className="bar-glow-profile" style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                  animation: 'barShine 2s infinite linear'
                }}></div>
              </div>
            </div>

            {isUnlimited ? (
              <p className="wibu-next-level-tip" style={{ color: '#ff0000', textShadow: '0 0 8px rgba(255,0,0,0.3)', marginTop: '8px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Status Level Maksimal / Unlimited EXP Aktif!
              </p>
            ) : (
              <p className="wibu-next-level-tip" style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Butuh {levelInfo.nextLevelExp - userExp} EXP lagi untuk naik ke Lv. {userLevel + 1}
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="profile-stats-grid-v2">
            <div className="profile-stat-box-v2">
              <span className="stat-label-v2">NONTON</span>
              <span className="stat-value-v2">{uniqueAnimeCount} <span className="stat-sub-v2">Anime</span></span>
            </div>
            <div className="profile-stat-box-v2">
              <span className="stat-label-v2">DURASI</span>
              <span className="stat-value-v2">{totalWatchMinutes} <span className="stat-sub-v2">Min</span></span>
            </div>
            <div className="profile-stat-box-v2">
              <span className="stat-label-v2">FAVORITE</span>
              <span className="stat-value-v2">{favorites.length} <span className="stat-sub-v2">Anime</span></span>
            </div>
          </div>

          {/* Account Meta */}
          <div className="profile-meta-footer">
            <div className="meta-row">
              <span className="meta-label">Role</span>
              <span className="meta-value" style={{ color: '#ff0055', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {profile.role || 'User'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Terdaftar Sejak</span>
              <span className="meta-value">{createdDate}</span>
            </div>
          </div>

          {/* Actions Grid */}
          <div className="profile-buttons-group">
            <button className="btn-premium-action" onClick={() => setIsEmailModalOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              Ganti Email
            </button>
            <button className="btn-premium-action" onClick={() => { setNewPassword(''); setIsPasswordModalOpen(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" /></svg>
              Reset Password
            </button>
            <button className="btn-premium-action logout-btn-premium" onClick={handleSignOut}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              Logout Akun
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Edit Username */}
      <div className={`modal-full-overlay ${isUsernameModalOpen ? 'open' : ''}`} onClick={() => setIsUsernameModalOpen(false)}>
        <div className="modal-full-content" onClick={(e) => e.stopPropagation()}>
          <h3>Ubah Username</h3>
          <p style={{ color: '#ffb800', fontSize: '0.85rem', marginBottom: '15px', background: 'rgba(255, 255, 255, 0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 184, 0, 0.2)', lineHeight: '1.4', fontWeight: '700' }}>
            Mengubah username akan memotong EXP kamu sebanyak 50 - 300 EXP
          </p>
          <p>Masukkan username baru kamu untuk di tampilkan di profil.</p>
          <form onSubmit={handleUsernameChangeSubmit}>
            <div className="premium-input-group">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Ketik username baru..."
                required
              />
            </div>
            <div className="modal-actions-premium">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsUsernameModalOpen(false)}>Batal</button>
              <button type="submit" className="btn-modal-save" disabled={modalLoading}>
                {modalLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: Edit Email */}
      <div className={`modal-full-overlay ${isEmailModalOpen ? 'open' : ''}`} onClick={() => setIsEmailModalOpen(false)}>
        <div className="modal-full-content" onClick={(e) => e.stopPropagation()}>
          <h3>Ganti Email Akun</h3>
          <p>Email saat ini: <strong>{profile.email}</strong></p>
          <form onSubmit={handleEmailChangeSubmit}>
            <div className="premium-input-group">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Ketik email baru..."
                required
              />
            </div>
            <p className="modal-warning-text">Kami akan mengirimkan link verifikasi ke email baru kamu untuk memvalidasi perubahan ini.</p>
            <div className="modal-actions-premium">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsEmailModalOpen(false)}>Batal</button>
              <button type="submit" className="btn-modal-save" disabled={modalLoading}>
                {modalLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: Reset Password */}
      <div className={`modal-full-overlay ${isPasswordModalOpen ? 'open' : ''}`} onClick={() => setIsPasswordModalOpen(false)}>
        <div className="modal-full-content" onClick={(e) => e.stopPropagation()}>
          <h3>Reset Password</h3>
          <p>Masukkan password baru kamu untuk mengamankan akun.</p>
          <form onSubmit={handlePasswordResetSubmit}>
            <div className="premium-input-group" style={{ marginBottom: '15px' }}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ketik password baru..."
                required
              />
            </div>
            <div className="modal-actions-premium">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsPasswordModalOpen(false)}>Batal</button>
              <button type="submit" className="btn-modal-save" disabled={modalLoading}>
                {modalLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
