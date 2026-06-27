'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Custom premium modal notification state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const [modalType, setModalType] = useState('success'); // 'success' or 'error'

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/');
    }
    checkSession();
  }, []);

  // Password requirement regex checks
  const hasMinLength = password.length >= 5;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\\/]/.test(password);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        let loginEmail = email.trim();

        // If the user inputs a username (no '@' character), fetch the corresponding email
        if (!loginEmail.includes('@')) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', loginEmail)
            .maybeSingle();

          if (profileError) throw profileError;
          if (!profileData || !profileData.email) {
            throw new Error('Username tidak ditemukan.');
          }
          loginEmail = profileData.email;
        }

        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        router.push('/');
      } else {
        // Password strength validation check
        if (!hasMinLength || !hasUpperCase || !hasNumber || !hasSymbol) {
          setModalTitle('Password Lemah');
          setModalMsg('Password harus memenuhi semua kriteria keamanan yang tertera di bawah kolom password.');
          setModalType('error');
          setModalOpen(true);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
              username
            }
          }
        });
        if (error) throw error;

        // Create or update profile in profiles table with user role and plain text password
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username,
            email: email,
            role: 'User'
          });

          // Trigger welcome email via Resend API
          try {
            await fetch('/api/send-welcome', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, username })
            });
          } catch (welcomeErr) {
            console.error('Failed to trigger welcome email:', welcomeErr);
          }
        }

        // Show custom success modal
        setModalTitle('Pendaftaran Berhasil! ');
        setModalMsg('Akun Anda berhasil didaftarkan. Silakan periksa kotak masuk email Anda atau kotak spam untuk melakukan verifikasi akun.');
        setModalType('success');
        setModalOpen(true);
      }
    } catch (error) {
      setModalTitle('Autentikasi Gagal');
      setModalMsg(error.message || 'Terjadi kesalahan sistem.');
      setModalType('error');
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-view">
      <div className="auth-container">
        <button className="btn-auth-back-top" onClick={() => router.push('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>

        <div className="auth-header">
          <img src="/Zunime.png" className="auth-logo" alt="Logo" />
          <h1>{mode === 'login' ? 'Selamat Datang' : 'Buat Akun'}</h1>
          <p>{mode === 'login' ? 'Masuk dan mulai untuk nonton anime di zunime' : 'Gabung Dengan ribuan user zunime'}</p>
        </div>

        <div className="auth-form-card">
          <form onSubmit={handleAuth} className="auth-form-inner">
            {mode === 'register' && (
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Nama"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}

            <div className="input-group">
              <label>{mode === 'login' ? 'Username / Email' : 'Email Address'}</label>
              <input
                type={mode === 'login' ? 'text' : 'email'}
                placeholder={mode === 'login' ? 'Username atau email...' : 'email@contoh.com'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    outline: 'none'
                  }}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirement Indicators */}
            {mode === 'register' && password.length > 0 && (
              <div style={{
                marginTop: '10px',
                padding: '12px 14px',
                background: 'rgba(10, 10, 12, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                animation: 'fadeIn 0.25s ease-out',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <div style={{ color: '#888', fontWeight: '800', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.65rem' }}>
                  Kekuatan Password:
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasMinLength ? '#4BB543' : '#ef4444', transition: 'all 0.2s ease', fontWeight: '500' }}>
                  <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', height: '14px' }}>{hasMinLength ? '✓' : '✗'}</span>
                  <span>Minimal 5 karakter</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasUpperCase ? '#4BB543' : '#ef4444', transition: 'all 0.2s ease', fontWeight: '500' }}>
                  <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', height: '14px' }}>{hasUpperCase ? '✓' : '✗'}</span>
                  <span>Mengandung huruf besar (A-Z)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasNumber ? '#4BB543' : '#ef4444', transition: 'all 0.2s ease', fontWeight: '500' }}>
                  <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', height: '14px' }}>{hasNumber ? '✓' : '✗'}</span>
                  <span>Mengandung angka (0-9)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasSymbol ? '#4BB543' : '#ef4444', transition: 'all 0.2s ease', fontWeight: '500' }}>
                  <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', height: '14px' }}>{hasSymbol ? '✓' : '✗'}</span>
                  <span>Mengandung simbol (e.g. @, #, $, !)</span>
                </div>
              </div>
            )}

            <button type="submit" className="btn-auth-primary" disabled={loading} style={{ marginTop: '10px' }}>
              {loading ? 'Memproses...' : (mode === 'login' ? 'MASUK SEKARANG' : 'DAFTAR SEKARANG')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ color: '#666', fontSize: '0.85rem' }}>
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
              <span
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{ color: 'var(--primary)', fontWeight: 'bold', marginLeft: '5px', cursor: 'pointer' }}
              >
                {mode === 'login' ? 'Daftar' : 'Login'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Custom Premium Modal Popup Notification */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'rgba(15, 15, 18, 0.95)',
            border: `1px solid ${modalType === 'success' ? 'rgba(75, 181, 67, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            borderRadius: '24px',
            padding: '35px 28px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px ${modalType === 'success' ? 'rgba(75, 181, 67, 0.08)' : 'rgba(239, 68, 68, 0.08)'}`,
            animation: 'modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Icon Circle */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: modalType === 'success' ? 'rgba(75, 181, 67, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: modalType === 'success' ? '#4BB543' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              boxShadow: `inset 0 0 12px ${modalType === 'success' ? 'rgba(75, 181, 67, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`
            }}>
              {modalType === 'success' ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              )}
            </div>

            {/* Header Title */}
            <h3 style={{
              color: 'white',
              fontSize: '1.35rem',
              fontWeight: '800',
              marginBottom: '12px',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.3px'
            }}>
              {modalTitle}
            </h3>

            {/* Body Message */}
            <p style={{
              color: '#a1a1aa',
              fontSize: '0.86rem',
              lineHeight: '1.6',
              marginBottom: '28px',
              fontFamily: "'Outfit', sans-serif"
            }}>
              {modalMsg}
            </p>

            {/* Action Confirmation Button */}
            <button
              onClick={() => {
                setModalOpen(false);
                if (modalType === 'success' && mode === 'register') {
                  setMode('login');
                }
              }}
              className="btn-auth-primary"
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '0.9rem',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                background: modalType === 'success' ? 'var(--primary)' : '#27272a',
                border: 'none',
                boxShadow: modalType === 'success' ? '0 6px 20px rgba(255, 0, 0, 0.3)' : 'none',
                cursor: 'pointer'
              }}
            >
              {modalType === 'success' ? 'Masuk Sekarang' : 'Tutup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
