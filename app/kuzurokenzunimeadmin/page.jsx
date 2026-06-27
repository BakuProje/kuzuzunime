'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseAdminClient as supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { getLevelData, calculateLevelUp } from '@/lib/levelUtils';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Dewa Mode / Full Access States
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);

  const handleDewaClick = () => {
    if (isFullAccess) {
      setIsFullAccess(false);
      localStorage.setItem('zunime-dewa-mode', 'false');
      showToast("Mode Dewa Dinonaktifkan: Akses Kembali Terbatas!");
    } else {
      if (pinAttempts >= 5) {
        showToast("Akses Terkunci: Terlalu banyak percobaan PIN salah (Batas 5x).");
        return;
      }
      setPinInput('');
      setIsPinModalOpen(true);
    }
  };

  const handleAutoVerify = (pinVal) => {
    if (pinAttempts >= 5) {
      showToast("Akses Terkunci: Anda telah salah memasukkan PIN sebanyak 5 kali.");
      setPinInput('');
      return;
    }

    if (pinVal === '669509') {
      setIsFullAccess(true);
      localStorage.setItem('zunime-dewa-mode', 'true');
      setIsPinModalOpen(false);
      setPinAttempts(0);
      setPinInput('');
      showToast("AKSES DEWA DIAKTIFKAN - KONTROL PENUH DIBUKA!");
    } else {
      const nextAttempts = pinAttempts + 1;
      setPinAttempts(nextAttempts);
      setPinInput('');
      if (nextAttempts >= 5) {
        setIsPinModalOpen(false);
        showToast("PIN SALAH! Batas percobaan (5x) tercapai. Akses diblokir!");
      } else {
        showToast(`PIN SALAH! Sisa percobaan: ${5 - nextAttempts}x.`);
      }
    }
  };

  const handleAdminEditAction = (actionFn) => {
    if (!isFullAccess) {
      showToast("Akses Ditolak: Aktifkan mode Dewa (Full Access) di sidebar terlebih dahulu!");
      return;
    }
    actionFn();
  };
  const [systemLogs, setSystemLogs] = useState([]);
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [modalTab, setModalTab] = useState('overview');
  const [selectedUserHistory, setSelectedUserHistory] = useState([]);
  const [selectedUserFavorites, setSelectedUserFavorites] = useState([]);
  const [selectedUserStatsLoading, setSelectedUserStatsLoading] = useState(false);
  const presenceChannelRef = useRef(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const d = new Date(timeStr);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}.${minutes}`;
  };

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Admin Login states
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeSubModal, setActiveSubModal] = useState(null); // null | 'username' | 'role' | 'password' | 'email'
  const [editValue, setEditValue] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  
  // Loading & Toast states
  const [modalLoading, setModalLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const router = useRouter();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    if (!selectedUser?.id) {
      setSelectedUserHistory([]);
      setSelectedUserFavorites([]);
      return;
    }

    let isMounted = true;
    async function fetchUserStats() {
      setSelectedUserStatsLoading(true);
      try {
        const [historyRes, favoritesRes] = await Promise.all([
          supabase.from('watch_progress').select('*').eq('user_id', selectedUser.id),
          supabase.from('favorites').select('anime_data').eq('user_id', selectedUser.id)
        ]);

        if (isMounted) {
          if (historyRes.data) setSelectedUserHistory(historyRes.data);
          if (favoritesRes.data) setSelectedUserFavorites(favoritesRes.data);
        }
      } catch (err) {
        console.error("Error fetching user stats for admin:", err);
      } finally {
        if (isMounted) setSelectedUserStatsLoading(false);
      }
    }

    fetchUserStats();
    return () => { isMounted = false; };
  }, [selectedUser?.id]);

  // Real-time presence tracking
  useEffect(() => {
    if (!isAdmin) return;
    
    const channel = supabase.channel('online-users', {
      config: { presence: { key: 'admin-tracker' } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineSet = new Set();
        Object.values(state).forEach(presenceList => {
          presenceList.forEach(p => {
            if (p.user_id) onlineSet.add(p.user_id);
          });
        });
        setOnlineUsers(onlineSet);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          newPresences.forEach(p => { if (p.user_id) next.add(p.user_id); });
          return next;
        });

        // Add real-time login logs
        newPresences.forEach(p => {
          if (p.user_id && p.email) {
            setSystemLogs(prev => {
              // Deduplicate login events within 5 seconds for the same user
              const duplicate = prev.some(l => l.type === 'MASUK' && l.email === p.email && Date.now() - new Date(l.timestamp).getTime() < 5000);
              if (duplicate) return prev;
              
              return [
                {
                  id: `login-${p.user_id}-${Date.now()}`,
                  timestamp: new Date(),
                  type: 'MASUK',
                  email: p.email,
                  username: p.email.split('@')[0],
                  details: 'Masuk / aktif memakai website'
                },
                ...prev
              ];
            });
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          leftPresences.forEach(p => { if (p.user_id) next.delete(p.user_id); });
          return next;
        });

        // Add real-time logout logs
        leftPresences.forEach(p => {
          if (p.user_id && p.email) {
            setSystemLogs(prev => {
              const duplicate = prev.some(l => l.type === 'KELUAR' && l.email === p.email && Date.now() - new Date(l.timestamp).getTime() < 5000);
              if (duplicate) return prev;

              return [
                {
                  id: `logout-${p.user_id}-${Date.now()}`,
                  timestamp: new Date(),
                  type: 'KELUAR',
                  email: p.email,
                  username: p.email.split('@')[0],
                  details: 'Keluar / menutup website'
                },
                ...prev
              ];
            });
          }
        });
      })
      .subscribe();

    presenceChannelRef.current = channel;

    // Real-time profiles listener for new signups
    const profilesChannel = supabase
      .channel('profiles-realtime-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        const newUser = payload.new;
        setSystemLogs(prev => [
          {
            id: `signup-live-${newUser.id}-${Date.now()}`,
            timestamp: new Date(),
            type: 'SIGNUP',
            email: newUser.email,
            username: newUser.username || newUser.email.split('@')[0],
            details: 'Mendaftar akun baru di Zunime'
          },
          ...prev
        ]);
        // Auto reload user table to show the new user
        loadUsers();
      })
      .subscribe();

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      supabase.removeChannel(profilesChannel);
    };
  }, [isAdmin]);

  useEffect(() => {
    setMounted(true);
    async function checkAdmin() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.warn("Admin check auth error:", error.message);
          await supabase.auth.signOut();
          setIsAdmin(false);
          return;
        }
        if (user && user.email === 'kuzunime@admin.com') {
          setIsAdmin(true);
          await loadUsers();
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        console.error("Error checking admin status:", e);
      } finally {
        setLoading(false);
      }
    }
    checkAdmin();

    // Load Dewa mode status
    const saved = localStorage.getItem('zunime-dewa-mode') === 'true';
    setIsFullAccess(saved);
  }, []);

  async function loadUsers() {
    try {
      console.log("Admin: loadUsers called. Triggering sync_profiles RPC...");
      // Try to sync profiles from auth.users to public.profiles first
      const { error: syncError } = await supabase.rpc('sync_profiles');
      if (syncError) {
        console.warn("Admin: sync_profiles RPC failed (this is normal if SQL migration is not applied yet):", syncError.message);
      } else {
        console.log("Admin: sync_profiles RPC completed successfully.");
      }
      
      console.log("Admin: Fetching profiles from DB...");
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log("Admin: Fetching profiles result:", { data, error });
      if (error) throw error;
      if (data) {
        setUsers(data);
        setSystemLogs(prev => {
          const signupLogs = data.map(u => ({
            id: `signup-${u.id}`,
            timestamp: new Date(u.created_at),
            type: 'SIGNUP',
            email: u.email,
            username: u.username || u.email.split('@')[0],
            details: 'Mendaftar akun baru di Zunime'
          }));
          const liveLogs = prev.filter(l => !l.id.startsWith('signup-'));
          return [...liveLogs, ...signupLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        });
      }
    } catch (e) {
      console.error("Admin: Error in loadUsers:", e);
      // Fallback: If rpc sync failed, still try to load users directly
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) {
          setUsers(data);
          setSystemLogs(prev => {
            const signupLogs = data.map(u => ({
              id: `signup-${u.id}`,
              timestamp: new Date(u.created_at),
              type: 'SIGNUP',
              email: u.email,
              username: u.username || u.email.split('@')[0],
              details: 'Mendaftar akun baru di Zunime'
            }));
            const liveLogs = prev.filter(l => !l.id.startsWith('signup-'));
            return [...liveLogs, ...signupLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          });
        }
      } catch (err) {
        showToast("Gagal memuat data user: " + err.message);
      }
    }
  }

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });
      if (error) throw error;
      
      if (data.user && data.user.email === 'kuzunime@admin.com') {
        setIsAdmin(true);
        showToast("Login Admin Berhasil!");
        await loadUsers();
      } else {
        await supabase.auth.signOut();
        showToast("Akses Ditolak: Hanya Admin Zunime yang diizinkan!");
      }
    } catch (err) {
      showToast("Gagal Login: " + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    router.push('/');
  };

  // Action methods for updating user profiles
  const openUserDetail = (u) => {
    setSelectedUser(u);
    setActiveSubModal(null);
    setModalTab('overview');
  };

  const handleUpdateUsername = async () => {
    if (!editValue.trim()) return showToast("Username tidak boleh kosong!");
    setModalLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: editValue })
      .eq('id', selectedUser.id);
    setModalLoading(false);

    if (error) {
      showToast("Gagal: " + error.message);
    } else {
      showToast("Username Berhasil Diubah!");
      setSelectedUser({ ...selectedUser, username: editValue });
      setActiveSubModal(null);
      loadUsers();
    }
  };

  const handleUpdateEmail = async () => {
    if (!editValue.trim()) return showToast("Email tidak boleh kosong!");
    setModalLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ email: editValue })
      .eq('id', selectedUser.id);
    setModalLoading(false);

    if (error) {
      showToast("Gagal: " + error.message);
    } else {
      showToast("Email Profile Diperbarui!");
      setSelectedUser({ ...selectedUser, email: editValue });
      setActiveSubModal(null);
      loadUsers();
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return showToast("Pilih salah satu role!");
    setModalLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: selectedRole })
      .eq('id', selectedUser.id);
    setModalLoading(false);

    if (error) {
      showToast("Gagal: " + error.message);
    } else {
      showToast("Role Berhasil diubah!");
      setSelectedUser({ ...selectedUser, role: selectedRole });
      setActiveSubModal(null);
      loadUsers();
    }
  };

  const handleUpdatePassword = async () => {
    if (!editValue || editValue.length < 6) {
      showToast("Password minimal 6 karakter!");
      return;
    }
    setModalLoading(true);
    // Call RPC to reset encrypted password in auth.users table
    const { error } = await supabase.rpc('admin_change_password', {
      target_user_id: selectedUser.id,
      new_password: editValue
    });

    if (!error) {
      showToast("Password Berhasil Diperbarui!");
      setActiveSubModal(null);
      loadUsers();
    } else {
      showToast("Gagal: " + error.message);
    }
    setModalLoading(false);
  };

  const handleDeleteUser = async () => {
    if (editValue !== (selectedUser.username || '')) {
      showToast("Username konfirmasi tidak cocok!");
      return;
    }
    setModalLoading(true);
    
    // Call RPC to delete user from both profiles and auth.users tables
    const { error } = await supabase.rpc('admin_delete_user', {
      target_user_id: selectedUser.id
    });

    if (!error) {
      showToast("User Berhasil Dihapus Permanen!");
      setActiveSubModal(null);
      setSelectedUser(null); // Close the detail modal
      loadUsers();
    } else {
      showToast("Gagal menghapus user: " + error.message);
    }
    setModalLoading(false);
  };

  if (!mounted) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh' }}></div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '15px' }}>
        <div className="spinner"></div>
        <p style={{ fontFamily: 'Outfit', fontWeight: 'bold', color: 'var(--text-muted)' }}>CHECKING ADMIN STATUS...</p>
      </div>
    );
  }

  // If not logged in as Admin, show the Dedicated Admin Login page!
  if (!isAdmin) {
    return (
      <div className="admin-login-overlay">
        {toastMessage && (
          <div id="toast-container" className="toast-top-center-premium">
            <div className="toast-premium error">
              <span className="toast-icon">✗</span>
              <span className="toast-text">{toastMessage}</span>
            </div>
          </div>
        )}

        <div className="admin-login-card">
          <div className="admin-login-header">
            <img src="/Zunime.png" className="admin-login-logo" alt="Logo" />
            <h1>ZUNIME PANEL</h1>
            <p>Masukkan Kredensial Administrator untuk mengakses dashboard Zunime.</p>
          </div>

          <form onSubmit={handleAdminLogin}>
            <div className="premium-input-group">
              <label style={{ color: '#666', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>EMAIL ADMIN</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="nama@contoh.com"
              />
            </div>

            <div className="premium-input-group" style={{ marginBottom: '25px' }}>
              <label style={{ color: '#666', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>PASSWORD ADMIN</label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-modal-save" style={{ width: '100%', padding: '16px', fontSize: '0.95rem' }} disabled={modalLoading}>
              {modalLoading ? 'MEMPROSES...' : 'MASUK DASHBOARD ADMIN'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast Alert positioned outside admin-view to render in front of the modal pop-up */}
      {toastMessage && (
        <div id="toast-container" className="toast-top-center-premium" style={{ zIndex: 99999999 }}>
          <div className="toast-premium success">
            <span className="toast-icon">✓</span>
            <span className="toast-text">{toastMessage}</span>
          </div>
        </div>
      )}

      <div id="admin-view">

      {/* Sidebar Navigation */}
      <div className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-logo">
          <img src="/Zunime.png" alt="Zunime" />
          {!sidebarCollapsed && <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>ZUNIME ADMIN</span>}
        </div>
        <nav className="admin-nav" style={{ flex: 1 }}>
          <div className="admin-nav-section-title">Management</div>
          <button
            className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
            data-tooltip="Manage Users"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            {!sidebarCollapsed && 'Manage Users'}
          </button>
          
          <button
            className={`admin-nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
            data-tooltip="System Logs"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            {!sidebarCollapsed && 'System Logs'}
          </button>
          
          <div className="admin-nav-section-title">Settings</div>
          {/* Menu Dewa Mode */}
          <button
            className={`admin-nav-item ${isFullAccess ? 'active' : ''}`}
            onClick={handleDewaClick}
            data-tooltip={isFullAccess ? 'Matikan Mode Dewa' : 'Aktifkan Mode Dewa'}
            style={{
              color: isFullAccess ? '#ff003c' : undefined,
              textShadow: isFullAccess ? '0 0 10px rgba(255, 0, 60, 0.5)' : undefined,
              borderLeft: isFullAccess ? '3px solid #ff003c' : undefined
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a5 5 0 0 0-5 5v4H4v11h16V11h-3V7a5 5 0 0 0-5-5zM9 11V7a3 3 0 0 1 6 0v4H9zm3 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill={isFullAccess ? '#ff003c' : 'none'}/>
            </svg>
            {!sidebarCollapsed && (isFullAccess ? 'Dewa Mode (ON)' : 'Dewa Mode')}
          </button>

          <button
            className="admin-nav-item"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-tooltip={sidebarCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <>
                  <path d="M13 17l5-5-5-5"></path>
                  <path d="M6 17l5-5-5-5"></path>
                </>
              ) : (
                <>
                  <path d="M11 17l-5-5 5-5"></path>
                  <path d="M18 17l-5-5 5-5"></path>
                </>
              )}
            </svg>
            {!sidebarCollapsed && 'Hide Sidebar'}
          </button>

          <button 
            className="admin-nav-item danger-logout" 
            onClick={handleAdminLogout} 
            data-tooltip="Keluar Admin"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {!sidebarCollapsed && 'Logout Admin'}
          </button>
        </nav>
      </div>

      {/* Main Panel Content */}
      <main className="admin-main">
        <div className="admin-content">
          <div className="admin-card">
            {/* Card Header inside the Table Card */}
            <div className="admin-card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderBottom: '1px solid #1a1a1a',
              background: '#0c0c0c'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'white', fontFamily: 'Outfit' }}>
                  {activeTab === 'users' ? 'Daftar User' : 'Log Aktivitas Real-time'}
                </h3>
                <span style={{
                  background: 'rgba(255, 0, 0, 0.1)',
                  color: 'var(--primary)',
                  fontSize: '0.65rem',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 0, 0, 0.2)'
                }}>
                  {activeTab === 'users' ? `${users ? users.length : 0} Total` : `${systemLogs ? systemLogs.length : 0} Logs`}
                </span>
              </div>
              
              {activeTab === 'users' && (
                <button 
                  onClick={async () => {
                    showToast("Memulai sinkronisasi...");
                    await loadUsers();
                  }}
                  className="btn-sync-database"
                  style={{
                    background: 'var(--gradient)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(255, 0, 0, 0.2)'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sync-icon">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                  Sync Database
                </button>
              )}
            </div>

            {activeTab === 'users' ? (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingLeft: '15px', width: '20%' }}>User</th>
                      <th style={{ width: '35%' }}>Email</th>
                      <th style={{ width: '20%' }}>Role</th>
                      <th style={{ width: '20%' }}>Terdaftar</th>
                      <th style={{ textAlign: 'right', paddingRight: '15px', width: '5%' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody id="admin-user-list">
                    {users && users.map((u, idx) => {
                      const isOnline = onlineUsers.has(u.id);
                      return (
                      <tr key={idx} style={{ borderBottom: '1px solid #151515' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ position: 'relative' }}>
                              <div className="user-list-avatar">
                                <img src={u.avatar_url || '/Zunime.png'} alt="Avatar" onError={(e) => { e.target.onerror = null; e.target.src = '/Zunime.png'; }} />
                              </div>
                              <div style={{
                                position: 'absolute', bottom: '-2px', right: '-2px',
                                width: '12px', height: '12px', borderRadius: '50%',
                                background: isOnline ? '#4BB543' : '#ff4d4d',
                                border: '2px solid #0c0c0c',
                                boxShadow: isOnline ? '0 0 6px rgba(75,181,67,0.6)' : '0 0 6px rgba(255,77,77,0.4)',
                                transition: 'all 0.3s ease'
                              }} title={isOnline ? 'Online' : 'Offline'}></div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <span style={{ fontWeight: '700', color: 'white', fontSize: '0.9rem' }}>{u.username || 'Anonymous'}</span>
                              <span style={{ 
                                fontSize: '0.6rem', 
                                color: isOnline ? '#4BB543' : '#888', 
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <span style={{
                                  width: '4px', height: '4px', borderRadius: '50%',
                                  background: isOnline ? '#4BB543' : '#ff4d4d',
                                  boxShadow: isOnline ? '0 0 4px #4BB543' : 'none',
                                  display: 'inline-block'
                                }}></span>
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#ccc' }}>{u.email}</td>
                        <td>
                          <span 
                            className={`role-badge-admin ${u.role ? u.role.replace(' ', '') : 'User'}`}
                            style={{
                              background: u.role === 'Teman' ? 'rgba(34, 197, 94, 0.15)' : u.role === 'Dewa' ? 'rgba(255, 0, 60, 0.15)' : u.role === 'Admin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: u.role === 'Teman' ? '#22c55e' : u.role === 'Dewa' ? '#ff003c' : u.role === 'Admin' ? '#ef4444' : '#888',
                              border: u.role === 'Teman' ? '1px solid rgba(34, 197, 94, 0.3)' : u.role === 'Dewa' ? '1px solid rgba(255, 0, 60, 0.3)' : u.role === 'Admin' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                              textShadow: u.role === 'Dewa' ? '0 0 10px rgba(255, 0, 60, 0.3)' : undefined
                            }}
                          >
                            {u.role || 'User'}
                          </span>
                        </td>

                        <td style={{ color: '#888' }}>
                          {formatDate(u.created_at)}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '15px' }}>
                          <button
                            onClick={() => openUserDetail(u)}
                            className="actions-dropdown-trigger"
                            title="Detail & Kelola"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#888',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '6px',
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--primary)';
                              e.currentTarget.style.background = 'rgba(255, 0, 0, 0.06)';
                              e.currentTarget.style.transform = 'rotate(45deg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#888';
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="3"></circle>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );})}
                    {(!users || users.length === 0) && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                          Belum ada user terdaftar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-table-wrapper no-scrollbar" style={{ padding: '0 20px 20px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0 10px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    AKTIVITAS SISTEM TERKINI
                  </h4>
                  <button 
                    onClick={() => setSystemLogs([])}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#ccc',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    className="btn-clear-logs"
                  >
                    Bersihkan Log
                  </button>
                </div>
                <div className="logs-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {systemLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Belum ada aktivitas terekam.
                    </div>
                  ) : (
                    systemLogs.map((log) => (
                      <div 
                        key={log.id} 
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.02)', 
                          border: '1px solid rgba(255, 255, 255, 0.04)', 
                          borderRadius: '10px', 
                          padding: '10px 16px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          gap: '15px',
                          animation: 'slideUp 0.3s ease-out'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <span style={{ 
                            background: log.type === 'SIGNUP' ? 'rgba(0, 255, 0, 0.08)' : (log.type === 'MASUK' || log.type === 'LOGIN') ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255, 77, 77, 0.08)', 
                            color: log.type === 'SIGNUP' ? '#00ff00' : (log.type === 'MASUK' || log.type === 'LOGIN') ? '#00ffff' : '#ff4d4d', 
                            fontSize: '0.65rem', 
                            fontWeight: '800', 
                            padding: '3px 8px', 
                            borderRadius: '5px',
                            border: log.type === 'SIGNUP' ? '1px solid rgba(0, 255, 0, 0.15)' : (log.type === 'MASUK' || log.type === 'LOGIN') ? '1px solid rgba(0, 255, 255, 0.15)' : '1px solid rgba(255, 77, 77, 0.15)',
                            minWidth: '70px',
                            textAlign: 'center',
                            textTransform: 'uppercase'
                          }}>
                            {log.type === 'SIGNUP' ? 'SIGNUP' : (log.type === 'MASUK' || log.type === 'LOGIN') ? 'Masuk' : 'Keluar'}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ fontWeight: '700', color: 'white', fontSize: '0.85rem' }}>{log.username}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>({log.email})</span>
                            <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '1px' }}>{log.details}</div>
                          </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {formatTime(log.timestamp)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      </div>

      {/* Admin Action Details Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content-premium widest" onClick={(e) => e.stopPropagation()} style={{ padding: '35px' }}>
            
            {/* Absolute Close Button */}
            <button 
              className="modal-close-btn-details" 
              onClick={() => setSelectedUser(null)}
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Dynamic Modal Header */}
            {activeSubModal !== null && (
              <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '1.5rem', color: 'white', fontWeight: '800', marginBottom: '6px' }}>
                  {activeSubModal === 'username' && "Ubah Username"}
                  {activeSubModal === 'email' && "Ganti Email Direct"}
                  {activeSubModal === 'role' && "Ganti Role User"}
                  {activeSubModal === 'password' && "Ubah Password User"}
                  {activeSubModal === 'delete' && "Hapus Akun User"}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  {activeSubModal === 'username' && `Username saat ini: ${selectedUser.username || 'Anonymous'}`}
                  {activeSubModal === 'email' && "Update tanpa verifikasi Gmail"}
                  {activeSubModal === 'role' && `Role saat ini: ${selectedUser.role || 'User'}`}
                  {activeSubModal === 'password' && `Set password baru untuk ${selectedUser.email}`}
                  {activeSubModal === 'delete' && `Konfirmasi penghapusan akun untuk ${selectedUser.username || 'user ini'}`}
                </p>
              </div>
            )}

            {activeSubModal === null ? (
              // Redesigned Modern Premium Detail Modal (V3 Layout)
              <div className="modal-grid-v3" style={{ color: 'white', fontFamily: 'Outfit' }}>
                {/* Left Pane - Profile Summary (matches the rich main profile style) */}
                <div className="modal-left-pane" style={{ paddingRight: '20px' }}>
                  <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '12px' }}>
                    <img
                      src={selectedUser.avatar_url || '/Zunime.png'}
                      alt="Avatar"
                      onError={(e) => { e.target.onerror = null; e.target.src = '/Zunime.png'; }}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #ff003c', padding: '4px', background: '#000', objectFit: 'cover', boxShadow: '0 4px 15px rgba(255, 0, 60, 0.3)' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: '2px', right: '2px',
                      background: onlineUsers.has(selectedUser.id) ? '#4BB543' : '#ff4d4d',
                      width: '18px', height: '18px', borderRadius: '50%',
                      border: '2px solid #0c0c0c',
                      boxShadow: onlineUsers.has(selectedUser.id) ? '0 0 8px rgba(75,181,67,0.6)' : '0 0 8px rgba(255,77,77,0.4)',
                      transition: 'all 0.3s ease'
                    }}></div>
                  </div>
                  
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px', color: 'white', letterSpacing: '0.5px' }}>
                    {selectedUser.username || 'Anonymous'}
                  </h3>
                  
                  <p style={{ fontSize: '0.75rem', color: '#b1b1b6', marginBottom: '15px', wordBreak: 'break-all', maxWidth: '210px', fontWeight: '600' }}>
                    {selectedUser.email}
                  </p>
                  
                  {/* Sistem Level & EXP Ringkasan pada Left Pane (Miniatur Halaman Profil Utama) */}
                  {(() => {
                    const userLevelInfo = getLevelData(selectedUser.level || 1, selectedUser.role, selectedUser.unlimited_exp);
                    const userLevelPercent = selectedUser.unlimited_exp ? 100 : Math.round(((selectedUser.exp || 0) / userLevelInfo.nextLevelExp) * 100);
                    
                    return (
                      <div className="wibu-level-section" style={{ 
                        width: '100%', 
                        padding: '12px 0', 
                        background: 'transparent', 
                        border: 'none', 
                        borderRadius: '0',
                        textAlign: 'left',
                        boxShadow: 'none'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          {/* Mini Rank Icon, cropped cleanly */}
                          <div style={{ 
                            position: 'relative', 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '50%', 
                            overflow: 'hidden', 
                            border: '1px solid rgba(255,255,255,0.15)',
                            flexShrink: 0,
                            background: '#0a0a0c'
                          }}>
                            <img 
                              src={userLevelInfo.icon} 
                              alt="Rank" 
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userLevelInfo.rankName}>
                                {userLevelInfo.rankName}
                              </span>
                              <span style={{ background: '#ff0055', color: 'white', fontWeight: '900', padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
                                LV. {userLevelInfo.level}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar Mini (Merah Saja) */}
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#050505',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          position: 'relative',
                          marginTop: '8px'
                        }}>
                          <div style={{
                            width: `${userLevelPercent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #ff0000 0%, #ff4d4d 100%)',
                            borderRadius: '10px',
                            boxShadow: '0 0 6px rgba(255, 0, 0, 0.3)'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#b1b1b6', marginTop: '6px', display: 'block', fontWeight: '700' }}>
                          {selectedUser.unlimited_exp ? 'EXP: Unlimited' : `EXP: ${selectedUser.exp || 0} / ${userLevelInfo.nextLevelExp}`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Stats Grid (TONTON, DURASI, FAVORITE) */}
                  {(() => {
                    const uniqueAnimeCount = new Set(selectedUserHistory.map(h => h.anime_id)).size;
                    const totalWatchMinutes = Math.floor(selectedUserHistory.reduce((acc, curr) => acc + (curr.progress || 0), 0) / 60);
                    const favoriteCount = selectedUserFavorites.length;

                    return (
                      <div className="profile-stats-grid-v2" style={{ width: '100%', marginTop: '15px', gap: '8px', gridTemplateColumns: 'repeat(3, 1fr)', display: 'grid' }}>
                        <div className="profile-stat-box-v2" style={{ padding: '8px 4px', minWidth: '0', textAlign: 'center' }}>
                          <span className="stat-label-v2" style={{ fontSize: '0.6rem', letterSpacing: '0.5px', whiteSpace: 'nowrap', color: '#b1b1b6', fontWeight: '800' }}>NONTON</span>
                          {selectedUserStatsLoading ? (
                            <span className="stat-value-v2" style={{ fontSize: '0.85rem' }}>...</span>
                          ) : (
                            <span className="stat-value-v2" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {uniqueAnimeCount} <span className="stat-sub-v2" style={{ fontSize: '0.55rem', color: '#a1a1aa', fontWeight: '700' }}>Anime</span>
                            </span>
                          )}
                        </div>
                        <div className="profile-stat-box-v2" style={{ padding: '8px 4px', minWidth: '0', textAlign: 'center' }}>
                          <span className="stat-label-v2" style={{ fontSize: '0.6rem', letterSpacing: '0.5px', whiteSpace: 'nowrap', color: '#b1b1b6', fontWeight: '800' }}>DURASI</span>
                          {selectedUserStatsLoading ? (
                            <span className="stat-value-v2" style={{ fontSize: '0.85rem' }}>...</span>
                          ) : (
                            <span className="stat-value-v2" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {totalWatchMinutes} <span className="stat-sub-v2" style={{ fontSize: '0.55rem', color: '#a1a1aa', fontWeight: '700' }}>Min</span>
                            </span>
                          )}
                        </div>
                        <div className="profile-stat-box-v2" style={{ padding: '8px 4px', minWidth: '0', textAlign: 'center' }}>
                          <span className="stat-label-v2" style={{ fontSize: '0.6rem', letterSpacing: '0.5px', whiteSpace: 'nowrap', color: '#b1b1b6', fontWeight: '800' }}>FAVORITE</span>
                          {selectedUserStatsLoading ? (
                            <span className="stat-value-v2" style={{ fontSize: '0.85rem' }}>...</span>
                          ) : (
                            <span className="stat-value-v2" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {favoriteCount} <span className="stat-sub-v2" style={{ fontSize: '0.55rem', color: '#a1a1aa', fontWeight: '700' }}>Anime</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Account Meta (ROLE, TERDAFTAR SEJAK) */}
                  <div className="profile-meta-footer" style={{ width: '100%', marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="meta-footer-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="meta-label-v2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', color: '#b1b1b6', whiteSpace: 'nowrap', fontWeight: '700' }}>ROLE</span>
                      <span className={`meta-value-v2 role-pill-v2 ${selectedUser.role ? selectedUser.role.replace(' ', '').toLowerCase() : 'user'}`} style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: '800', 
                        padding: '3px 10px', 
                        borderRadius: '6px', 
                        textTransform: 'uppercase', 
                        whiteSpace: 'nowrap',
                        // Dynamic coloring matching user role (red for admin/dewa, green for teman, gray-red fallback)
                        color: selectedUser.role === 'Teman' ? '#22c55e' : (selectedUser.role === 'Dewa' || selectedUser.role === 'Admin') ? '#ff003c' : '#ef4444',
                        background: selectedUser.role === 'Teman' ? 'rgba(34, 197, 94, 0.08)' : (selectedUser.role === 'Dewa' || selectedUser.role === 'Admin') ? 'rgba(255, 0, 60, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: selectedUser.role === 'Teman' ? '1px solid rgba(34, 197, 94, 0.25)' : (selectedUser.role === 'Dewa' || selectedUser.role === 'Admin') ? '1px solid rgba(255, 0, 60, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                        textShadow: selectedUser.role === 'Teman' ? 'none' : '0 0 8px rgba(255, 0, 60, 0.25)'
                      }}>
                        {selectedUser.role || 'User'}
                      </span>
                    </div>
                    <div className="meta-footer-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="meta-label-v2" style={{ fontSize: '0.62rem', letterSpacing: '0.5px', color: '#b1b1b6', whiteSpace: 'nowrap', fontWeight: '700' }}>TERDAFTAR SEJAK</span>
                      <span className="meta-value-v2" style={{ fontSize: '0.72rem', fontWeight: '800', color: '#ffffff', whiteSpace: 'nowrap' }}>
                        {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Pane - Tabbed Content */}
                <div className="modal-right-pane">
                  <div className="modal-tabs-header">
                    <button 
                      className={`modal-tab-btn ${modalTab === 'overview' ? 'active' : ''}`}
                      onClick={() => setModalTab('overview')}
                    >
                      Overview
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'security' ? 'active' : ''}`}
                      onClick={() => setModalTab('security')}
                    >
                      Security
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'leveling' ? 'active' : ''}`}
                      onClick={() => setModalTab('leveling')}
                    >
                      Level & EXP
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'timeline' ? 'active' : ''}`}
                      onClick={() => setModalTab('timeline')}
                    >
                      Activity Timeline
                    </button>
                  </div>

                  {/* Tab content 1: Overview */}
                  {modalTab === 'overview' && (
                    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                      <div className="modal-stats-grid">
                        <div className="modal-stat-card">
                          <span className="modal-stat-label">Status Kehadiran</span>
                          <span className="modal-stat-value" style={{ color: onlineUsers.has(selectedUser.id) ? '#4BB543' : '#ff4d4d' }}>
                            {onlineUsers.has(selectedUser.id) ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="modal-stat-card">
                          <span className="modal-stat-label">Total Aktivitas</span>
                          <span className="modal-stat-value">
                            {systemLogs.filter(log => log.email === selectedUser.email).length} Logs
                          </span>
                        </div>
                        <div className="modal-stat-card">
                          <span className="modal-stat-label">Terdaftar Sejak</span>
                          <span className="modal-stat-value">
                            {formatDate(selectedUser.created_at)}
                          </span>
                        </div>
                        <div className="modal-stat-card">
                          <span className="modal-stat-label">User ID</span>
                          <span className="modal-stat-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} title={selectedUser.id}>
                            #{selectedUser.id.substring(0, 8)}
                          </span>
                        </div>
                      </div>

                      {/* Grid 1-Kolom untuk Email Address */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginTop: '15px' }}>
                        {/* Card 1: Email Address */}
                        <div style={{ 
                          background: 'rgba(20, 20, 22, 0.9)', 
                          border: '1px solid rgba(255, 255, 255, 0.12)', 
                          padding: '14px 18px', 
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          minHeight: '68px'
                        }}>
                          <div style={{ fontSize: '0.65rem', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Email Address
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', wordBreak: 'break-all' }}>
                            {selectedUser.email}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab content 2: Security */}
                  {modalTab === 'security' && (
                    <div style={{ animation: 'fadeIn 0.25s ease-out', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      
                      {/* Banner Status Akses Mode Dewa */}
                      {!isFullAccess && (
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: 'rgba(20, 20, 22, 0.9)',
                          border: '1px solid rgba(255, 0, 60, 0.25)',
                          color: '#ff003c',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)'
                        }}>
                          MODE TERBATAS - AKTIFKAN MODE DEWA DI SIDEBAR UNTUK MENGEDIT
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button 
                          onClick={() => handleAdminEditAction(() => { setEditValue(selectedUser.username || ''); setActiveSubModal('username'); })} 
                          className="btn-detail-opt" 
                          disabled={!isFullAccess}
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '12px 10px', 
                            cursor: isFullAccess ? 'pointer' : 'not-allowed', 
                            opacity: isFullAccess ? 1 : 0.4 
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          Ubah Username
                        </button>
                        <button 
                          onClick={() => handleAdminEditAction(() => { setSelectedRole(selectedUser.role || 'User'); setActiveSubModal('role'); })} 
                          className="btn-detail-opt" 
                          disabled={!isFullAccess}
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '12px 10px', 
                            cursor: isFullAccess ? 'pointer' : 'not-allowed', 
                            opacity: isFullAccess ? 1 : 0.4 
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          Ubah Role
                        </button>
                        <button 
                          onClick={() => handleAdminEditAction(() => { setEditValue(''); setActiveSubModal('password'); })} 
                          className="btn-detail-opt" 
                          disabled={!isFullAccess}
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '12px 10px', 
                            cursor: isFullAccess ? 'pointer' : 'not-allowed', 
                            opacity: isFullAccess ? 1 : 0.4 
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" /></svg>
                          Reset Password
                        </button>
                        <button 
                          onClick={() => handleAdminEditAction(() => { setEditValue(selectedUser.email || ''); setActiveSubModal('email'); })} 
                          className="btn-detail-opt" 
                          disabled={!isFullAccess}
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '12px 10px', 
                            cursor: isFullAccess ? 'pointer' : 'not-allowed', 
                            opacity: isFullAccess ? 1 : 0.4 
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                          Reset Gmail
                        </button>
                        <button 
                          onClick={() => handleAdminEditAction(() => { setEditValue(''); setActiveSubModal('delete'); })} 
                          className="btn-detail-opt" 
                          disabled={!isFullAccess}
                          style={{ 
                            gridColumn: 'span 2',
                            fontSize: '0.75rem', 
                            padding: '12px 10px', 
                            cursor: isFullAccess ? 'pointer' : 'not-allowed', 
                            opacity: isFullAccess ? 1 : 0.4 
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          Hapus User
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab content 4: Leveling */}
                  {modalTab === 'leveling' && (
                    <AdminLevelingTab
                      user={selectedUser}
                      isFullAccess={isFullAccess}
                      onUpdate={(updatedUser) => {
                        setSelectedUser(updatedUser);
                        loadUsers();
                      }}
                      showToast={showToast}
                    />
                  )}

                  {/* Tab content 3: Timeline */}
                  {modalTab === 'timeline' && (
                    <div style={{ animation: 'fadeIn 0.25s ease-out', marginTop: '-12px' }}>
                      <div className="timeline-list">
                        {systemLogs.filter(log => log.email === selectedUser.email).length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '25px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Belum ada riwayat aktivitas untuk user ini.
                          </div>
                        ) : (
                          systemLogs
                            .filter(log => log.email === selectedUser.email)
                            .map((log) => (
                              <div className="timeline-item" key={log.id}>
                                <div className={`timeline-dot ${(log.type === 'MASUK' || log.type === 'LOGIN') ? 'masuk' : (log.type === 'KELUAR' || log.type === 'LOGOUT') ? 'keluar' : 'signup'}`}></div>
                                <div className="timeline-content">
                                  <span className="timeline-text">{log.details}</span>
                                  <span className="timeline-time">
                                    {formatTime(log.timestamp)}
                                  </span>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
               // Edit Sub-modal Panels
              <div style={{ textAlign: 'left' }}>
                {activeSubModal === 'username' && (
                  <div>
                    <div className="premium-input-group" style={{ marginTop: '15px' }}>
                      <label style={{ color: '#666', fontSize: '0.75rem', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>USERNAME BARU</label>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Ketik username baru..."
                      />
                    </div>
                    <div className="modal-actions-grid">
                      <button onClick={() => setActiveSubModal(null)} className="btn-modal-cancel">Batal</button>
                      <button onClick={handleUpdateUsername} disabled={modalLoading} className="btn-modal-save">
                        {modalLoading ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSubModal === 'email' && (
                  <div>
                    <div className="premium-input-group" style={{ marginTop: '15px' }}>
                      <label style={{ color: '#666', fontSize: '0.75rem', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>EMAIL BARU</label>
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Ketik email baru..."
                      />
                    </div>
                    <p className="modal-warning-text">
                      Email akan langsung diubah di tabel profile. Catatan: Untuk mengubah email auth utama tanpa verifikasi, gunakan menu SQL di dashboard Supabase.
                    </p>
                    <div className="modal-actions-grid">
                      <button onClick={() => setActiveSubModal(null)} className="btn-modal-cancel">Batal</button>
                      <button onClick={handleUpdateEmail} disabled={modalLoading} className="btn-modal-save">
                        {modalLoading ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSubModal === 'role' && (
                  <div>
                    <div className="role-selector-grid" style={{ marginTop: '15px', marginBottom: '25px' }}>
                      {['User', 'Admin', 'Teman', 'Dewa'].map((r) => (
                        <div
                          key={r}
                          className={`role-option ${selectedRole === r ? 'active' : ''}`}
                          onClick={() => setSelectedRole(r)}
                        >
                          {r}
                        </div>
                      ))}
                    </div>
                    <div className="modal-actions-grid">
                      <button onClick={() => setActiveSubModal(null)} className="btn-modal-cancel">Batal</button>
                      <button onClick={handleUpdateRole} disabled={modalLoading} className="btn-modal-save">
                        {modalLoading ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSubModal === 'password' && (
                  <div>
                    <div className="premium-input-group" style={{ marginTop: '15px' }}>
                      <label style={{ color: '#666', fontSize: '0.75rem', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>PASSWORD BARU</label>
                      <input
                        type="text"
                        placeholder="Ketik password baru..."
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    </div>
                    <p className="modal-warning-text" style={{ color: '#ff4d4d' }}>Password auth akan langsung diperbarui di database menggunakan RPC admin.</p>
                    <div className="modal-actions-grid">
                      <button onClick={() => setActiveSubModal(null)} className="btn-modal-cancel">Batal</button>
                      <button onClick={handleUpdatePassword} disabled={modalLoading} className="btn-modal-save">
                        {modalLoading ? 'Mengubah...' : 'Update'}
                      </button>
                    </div>
                  </div>
                )}

                {activeSubModal === 'delete' && (
                  <div>
                    <p style={{ fontSize: '0.85rem', color: '#ff4d4d', lineHeight: '1.5', margin: '15px 0' }}>
                      Peringatan: Penghapusan user bersifat permanen dan tidak dapat dibatalkan. Seluruh riwayat nonton, progress, favorit, dan akun auth Supabase akan dihapus sepenuhnya.
                    </p>
                    <div className="premium-input-group" style={{ marginTop: '15px' }}>
                      <label style={{ color: '#666', fontSize: '0.75rem', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>KONFIRMASI USERNAME</label>
                      <input
                        type="text"
                        placeholder={`Ketik "${selectedUser.username || ''}" untuk konfirmasi`}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    </div>
                    <div className="modal-actions-grid" style={{ marginTop: '20px' }}>
                      <button onClick={() => setActiveSubModal(null)} className="btn-modal-cancel">Batal</button>
                      <button 
                        onClick={handleDeleteUser} 
                        disabled={modalLoading || editValue !== (selectedUser.username || '')} 
                        className="btn-modal-save"
                        style={{ backgroundColor: '#ef4444' }}
                      >
                        {modalLoading ? 'Menghapus...' : 'HAPUS PERMANEN'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AdminDewaElements
        isPinModalOpen={isPinModalOpen}
        setIsPinModalOpen={setIsPinModalOpen}
        pinInput={pinInput}
        setPinInput={setPinInput}
        handleAutoVerify={handleAutoVerify}
        pinAttempts={pinAttempts}
      />
    </>
  );
}

// Sub-komponen untuk mengelola Level & EXP Pengguna di Dashboard Admin (Mendukung Edit Level & Tambah EXP)
function AdminLevelingTab({ user, isFullAccess, onUpdate, showToast }) {
  const [expAmount, setExpAmount] = useState('');
  const [levelInputVal, setLevelInputVal] = useState(user.level || 1);
  const [isUnlimited, setIsUnlimited] = useState(user.unlimited_exp || false);
  const [loading, setLoading] = useState(false);

  const isSpecialRole = user.role === 'Teman' || user.role === 'Dewa';
  const levelInfo = getLevelData(user.level || 1, user.role, user.unlimited_exp || isUnlimited);

  // Sync state if user prop changes
  useEffect(() => {
    setIsUnlimited(user.unlimited_exp || false);
    setLevelInputVal(user.level || 1);
  }, [user]);

  const handleSaveExp = async (e) => {
    e.preventDefault();
    if (!isFullAccess) {
      showToast("Akses Ditolak: Aktifkan mode Dewa (Full Access) terlebih dahulu!");
      return;
    }
    setLoading(true);

    try {
      if (isUnlimited) {
        if (!isSpecialRole) {
          showToast("Role 'Teman' atau 'Dewa' diperlukan untuk mengaktifkan EXP Unlimited!");
          setLoading(false);
          return;
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            unlimited_exp: true,
            level: 1,
            exp: 0
          })
          .eq('id', user.id);

        if (error) throw error;

        showToast("EXP Unlimited berhasil diaktifkan!");
        onUpdate({ ...user, unlimited_exp: true, level: 1, exp: 0 });
      } else {
        const newLvlVal = parseInt(levelInputVal);
        if (isNaN(newLvlVal) || newLvlVal <= 0) {
          showToast("Masukkan level yang valid!");
          setLoading(false);
          return;
        }

        const addedExp = parseInt(expAmount) || 0;

        let finalLevel = newLvlVal;
        let finalExp = user.exp || 0;
        let finalTotalExp = parseInt(user.total_exp) || 0;

        if (addedExp > 0) {
          const { newLevel, newExp } = calculateLevelUp(finalLevel, finalExp, addedExp);
          finalLevel = newLevel;
          finalExp = newExp;
          finalTotalExp = finalTotalExp + addedExp;
        } else if (newLvlVal !== user.level) {
          finalExp = 0; // reset exp on direct level change for clean state
          // estimate total exp for the new level
          finalTotalExp = 0;
          for (let i = 1; i < finalLevel; i++) {
            finalTotalExp += (100 + i * 50);
          }
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            level: finalLevel,
            exp: finalExp,
            total_exp: finalTotalExp,
            unlimited_exp: false
          })
          .eq('id', user.id);

        if (error) throw error;

        showToast("Data Level & EXP berhasil diperbarui!");
        onUpdate({ ...user, level: finalLevel, exp: finalExp, total_exp: finalTotalExp, unlimited_exp: false });
        setExpAmount('');
      }
    } catch (err) {
      showToast("Gagal memperbarui: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', display: 'flex', flexDirection: 'column', gap: '20px', color: 'white' }}>
      {/* Notifikasi jika mode Dewa terkunci (Tanpa Emoji) */}
      {!isFullAccess && (
        <div style={{ display: 'flex', gap: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '8px', color: '#ef4444', fontSize: '0.75rem', lineHeight: '1.4' }}>
          <div>
            <strong>Mode Terbatas:</strong> Anda hanya bisa memantau data Level & EXP. Aktifkan <strong>Mode Dewa</strong> di sidebar untuk mengubah level atau menambahkan EXP.
          </div>
        </div>
      )}

      {/* Detail Ringkasan Level */}
      <div style={{ display: 'flex', gap: '15px', background: 'rgba(20, 20, 22, 0.96)', border: '1px solid rgba(255,255,255,0.16)', padding: '15px', borderRadius: '12px', alignItems: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}>
        <img 
          src={levelInfo.icon} 
          alt="Rank" 
          style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ff0055', boxShadow: '0 0 8px rgba(255,0,85,0.3)' }} 
          onError={(e) => { e.target.onerror = null; e.target.src = '/Zunime.png'; }}
        />
        <div>
          <div style={{ fontWeight: '800', fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{levelInfo.rankName}</span>
            <span style={{ background: '#ff0055', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '900', textShadow: '0 0 3px rgba(255,0,85,0.4)' }}>
              LV. {levelInfo.level}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '3px' }}>
            {user.unlimited_exp ? 'Status EXP: Tanpa Batas (Unlimited)' : `EXP Saat Ini: ${user.exp || 0} / ${levelInfo.nextLevelExp} EXP (Total: ${user.total_exp || 0} EXP)`}
          </div>
        </div>
      </div>

      {/* Form Kelola EXP */}
      <form onSubmit={handleSaveExp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ background: 'rgba(20, 20, 22, 0.96)', border: '1px solid rgba(255,255,255,0.16)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#ff0055', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800' }}>
            Panel Penyesuaian Level & EXP {!isFullAccess && ' (Terkunci)'}
          </h4>

          {/* Set Level & Tambah EXP side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {/* Input Level (Baru) */}
            <div className="premium-input-group" style={{ opacity: isUnlimited ? 0.5 : 1, transition: 'opacity 0.3s', marginBottom: 0 }}>
              <label style={{ color: '#a1a1aa', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>SET LEVEL SEKARANG</label>
              <input 
                type="number" 
                placeholder={isFullAccess ? "Contoh: 15" : "Terblokir - Aktifkan Mode Dewa"} 
                value={levelInputVal}
                onChange={(e) => setLevelInputVal(e.target.value)}
                disabled={isUnlimited || !isFullAccess}
                min="1"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'white',
                  outline: 'none',
                  cursor: isFullAccess ? 'text' : 'not-allowed'
                }}
              />
            </div>

            {/* Input Jumlah EXP */}
            <div className="premium-input-group" style={{ opacity: isUnlimited ? 0.5 : 1, transition: 'opacity 0.3s', marginBottom: 0 }}>
              <label style={{ color: '#a1a1aa', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TAMBAH EXP</label>
              <input 
                type="number" 
                placeholder={isFullAccess ? "Contoh: 500" : "Terblokir - Aktifkan Mode Dewa"} 
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                disabled={isUnlimited || !isFullAccess}
                min="1"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'white',
                  outline: 'none',
                  cursor: isFullAccess ? 'text' : 'not-allowed'
                }}
              />
            </div>
          </div>

          {/* Opsi Unlimited EXP dengan sliding toggle switch */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '12px 16px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid rgba(255, 255, 255, 0.04)', 
              borderRadius: '8px', 
              cursor: (isSpecialRole && isFullAccess) ? 'pointer' : 'not-allowed' 
            }} 
            onClick={() => isSpecialRole && isFullAccess && setIsUnlimited(!isUnlimited)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: (isSpecialRole && isFullAccess) ? 'white' : '#666' }}>Unlimited EXP</span>
              <span style={{ fontSize: '0.65rem', color: '#888' }}>Maksimal level dan EXP tidak terbatas</span>
            </div>
            
            {/* Sliding Toggle Switch */}
            <div style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              background: isUnlimited ? '#ff0055' : 'rgba(255, 255, 255, 0.1)',
              borderRadius: '100px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: (isSpecialRole && isFullAccess) ? 'pointer' : 'not-allowed',
              boxShadow: isUnlimited ? '0 0 10px rgba(255, 0, 85, 0.4)' : 'none',
              opacity: (isSpecialRole && isFullAccess) ? 1 : 0.5
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isSpecialRole && isFullAccess) {
                setIsUnlimited(!isUnlimited);
              }
            }}>
              <div style={{
                position: 'absolute',
                top: '2px',
                left: isUnlimited ? '22px' : '2px',
                width: '20px',
                height: '20px',
                background: 'white',
                borderRadius: '50%',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }} />
            </div>
          </div>

          {/* Notifikasi Alert jika user bukan role spesial */}
          {isFullAccess && !isSpecialRole && (
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255, 184, 0, 0.05)', border: '1px solid rgba(255, 184, 0, 0.15)', padding: '12px', borderRadius: '8px', color: '#ffb800', fontSize: '0.7rem', lineHeight: '1.4' }}>
              <div>
                <strong>Peringatan:</strong> Opsi Unlimited EXP terkunci. Pengguna harus memiliki role <strong>Teman</strong> atau <strong>Dewa</strong> terlebih dahulu untuk mengaktifkan fitur ini.
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="btn-modal-save" style={{ width: '100%', padding: '14px', fontSize: '0.85rem', opacity: isFullAccess ? 1 : 0.6 }} disabled={loading || !isFullAccess}>
          {loading ? 'MEMPROSES...' : (isFullAccess ? 'Terapkan Penyesuaian EXP' : 'Terapkan Penyesuaian EXP (Terblokir)')}
        </button>
      </form>
    </div>
  );
}

// Sub-komponen untuk PIN Mode Dewa & Custom Styles
export function AdminDewaElements({ isPinModalOpen, setIsPinModalOpen, pinInput, setPinInput, handleAutoVerify, pinAttempts }) {
  return (
    <>
      <style jsx global>{`
        /* Styling Premium Modal V3 */
        .modal-content-premium.widest {
          max-width: 820px !important;
          width: 90% !important;
          border: 1px solid rgba(255, 0, 60, 0.25) !important;
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 0, 60, 0.05) !important;
          background: linear-gradient(rgba(8, 8, 10, 0.76), rgba(8, 8, 10, 0.84)), url('/Zunimebanner.png') !important;
          background-size: cover !important;
          background-position: center !important;
          border-radius: 20px !important;
          position: relative !important;
          overflow: visible !important;
        }

        .modal-close-btn-details {
          position: absolute;
          top: 20px;
          right: 20px;
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          z-index: 100;
        }

        .modal-close-btn-details:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
          transform: rotate(90deg);
        }

        .modal-grid-v3 {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
          min-height: 400px;
          align-items: stretch;
        }

        .modal-left-pane {
          display: flex;
          flex-direction: column;
          align-items: center;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          padding-right: 30px;
          text-align: center;
        }

        .modal-right-pane {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .modal-tabs-header {
          display: flex;
          gap: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 8px;
          width: 100%;
        }

        .modal-tab-btn {
          background: transparent;
          border: none;
          color: #71717a;
          padding: 8px 14px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .modal-tab-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.03);
        }

        .modal-tab-btn.active {
          color: white;
          background: rgba(255, 0, 60, 0.08);
          border: 1px solid rgba(255, 0, 60, 0.25);
          box-shadow: 0 0 10px rgba(255, 0, 60, 0.15);
        }

        .modal-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 15px;
          margin-bottom: 5px;
          width: 100%;
        }

        .modal-stat-card {
          background: rgba(20, 20, 22, 0.92) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          padding: 14px 18px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .modal-stat-card:hover {
          background: rgba(30, 30, 32, 0.95) !important;
          border-color: rgba(255, 0, 60, 0.35) !important;
          transform: translateY(-2px);
        }

        .modal-stat-label {
          font-size: 0.65rem;
          color: #a1a1aa;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .modal-stat-value {
          font-size: 0.85rem;
          font-weight: 700;
          color: white;
          word-break: break-all;
          line-height: 1.3;
        }

        .btn-back-details {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(255, 0, 60, 0.3);
          color: #ff003c;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: auto;
          outline: none;
        }

        .btn-back-details:hover {
          background: rgba(255, 0, 60, 0.08);
          border-color: #ff003c;
          box-shadow: 0 0 10px rgba(255, 0, 60, 0.2);
        }

        .btn-detail-opt {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          background: rgba(20, 20, 22, 0.88) !important;
          color: #ccc;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .btn-detail-opt:hover {
          background: rgba(30, 30, 32, 0.95) !important;
          color: white;
          border-color: rgba(255, 0, 60, 0.25) !important;
          transform: translateY(-2px);
        }

        .btn-detail-opt.danger {
          border-color: rgba(239, 68, 68, 0.25) !important;
          background: rgba(239, 68, 68, 0.12) !important;
          color: #ef4444;
        }

        .btn-detail-opt.danger:hover {
          background: rgba(239, 68, 68, 0.22) !important;
          color: white;
          border-color: #ef4444 !important;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.25);
        }

        .btn-detail-opt.primary {
          border-color: rgba(255, 0, 60, 0.28) !important;
          background: rgba(255, 0, 60, 0.12) !important;
          color: #ff003c;
        }

        .btn-detail-opt.primary:hover {
          background: rgba(255, 0, 60, 0.22) !important;
          color: white;
          border-color: #ff003c !important;
          box-shadow: 0 0 10px rgba(255, 0, 60, 0.25);
        }

        /* Solid timeline content boxes for high readability */
        .timeline-content {
          background: rgba(20, 20, 22, 0.9) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.8rem;
          flex: 1;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        /* Prevent activity timeline bottom cut-off */
        .timeline-list {
          max-height: 440px !important;
          padding-bottom: 20px !important;
          overflow-y: auto !important;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 6px;
        }

        .no-scrollbar {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>

      {isPinModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPinModalOpen(false)}>
          <div className="modal-content-premium" onClick={(e) => e.stopPropagation()} style={{ border: '2px solid #ff003c', boxShadow: '0 0 25px rgba(255, 0, 60, 0.45)' }}>
            <h3 style={{ color: '#ff003c', textShadow: '0 0 8px rgba(255, 0, 60, 0.3)', fontWeight: '800' }}>Verifikasi Akses Dewa</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Masukkan 6 digit PIN khusus untuk membuka akses kontrol penuh (Full Access).</p>
            <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: '20px' }}>
              <div className="premium-input-group">
                <input 
                  type="password" 
                  maxLength={6}
                  value={pinInput} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPinInput(val);
                    if (val.length === 6) {
                      handleAutoVerify(val);
                    }
                  }} 
                  placeholder="••••••"
                  autoFocus
                  required
                  disabled={pinAttempts >= 5}
                  style={{ 
                    textAlign: 'center', 
                    fontSize: '1.8rem', 
                    letterSpacing: '12px', 
                    fontFamily: 'monospace',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255, 0, 60, 0.2)',
                    color: '#ff003c',
                    padding: '12px',
                    borderRadius: '8px',
                    outline: 'none',
                    width: '100%',
                    cursor: pinAttempts >= 5 ? 'not-allowed' : 'text'
                  }}
                />
              </div>
              {pinAttempts > 0 && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                  {pinAttempts >= 5 
                    ? "Akses Diblokir! Batas percobaan PIN salah (5x) telah tercapai." 
                    : `PIN Salah! Percobaan salah: ${pinAttempts}/5.`}
                </p>
              )}
              <div className="modal-actions-premium" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '25px' }}>
                <button type="button" className="btn-modal-cancel" onClick={() => setIsPinModalOpen(false)}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
