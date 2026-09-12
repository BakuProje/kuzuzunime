'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Next.js Page Error caught:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
      color: 'white'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(255, 31, 79, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        border: '1px solid rgba(255, 31, 79, 0.3)'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px' }}>
        Halaman Gagal Dimuat
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '360px', marginBottom: '30px', lineHeight: '1.5' }}>
        Terjadi kendala saat memuat data halaman. Silakan coba muat ulang atau kembali ke beranda.
      </p>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => reset ? reset() : window.location.reload()}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            background: 'var(--gradient)',
            color: 'white',
            fontWeight: '700',
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(255, 31, 79, 0.35)'
          }}
        >
          Coba Lagi
        </button>
        <Link
          href="/"
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'white',
            fontWeight: '700',
            fontSize: '0.9rem',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          Beranda
        </Link>
      </div>
    </div>
  );
}
