'use client';
import { useRouter } from 'next/navigation';

export default function DeveloperPage() {
  const router = useRouter();

  return (
    <div id="developer-view" className="section-container page-transition">
      <div className="zutify-dev-container">
        {/* Logo Section */}
        <div className="zutify-logo-wrapper">
          <div className="zutify-logo-bg-glow"></div>
          <img src="/Zunime.png" alt="Zutify Logo" className="zutify-logo-img" />
        </div>

        {/* Title & Description */}
        <h1 className="zutify-title">
          <span className="char-z">Z</span>
          <span className="char-u">u</span>
          <span className="char-n">N</span>
          <span className="char-i">i</span>
          <span className="char-m">M</span>
          <span className="char-e">E</span>
        </h1>
        <p className="zutify-description">
          Platform streaming anime modern gratis tanpa iklan. Nikmati jutaan anime, daftar akun Anda sendiri, dan temukan anime baru setiap hari dengan kualitas tanpa batasan.
        </p>

        {/* Social Links Row (3 Columns) */}
        <div className="zutify-social-grid">
          <a href="https://kuzuroken.site" target="_blank" rel="noopener noreferrer" className="zutify-social-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="social-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>Website</span>
          </a>

          <a href="https://www.tiktok.com/@kuzuroken" target="_blank" rel="noopener noreferrer" className="zutify-social-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="social-icon">
              <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" fill="none" stroke="currentColor" strokeWidth="2"></path>
            </svg>
            <span>TikTok</span>
          </a>

          <a href="https://www.instagram.com/kuzuroken.20" target="_blank" rel="noopener noreferrer" className="zutify-social-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="social-icon">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            <span>Instagram</span>
          </a>
        </div>

        {/* Support Card (Saweria) */}
        <a href="https://saweria.co/kuzuroken" target="_blank" rel="noopener noreferrer" className="zutify-support-card">
          <div className="support-icon-circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="2" x2="6" y2="4"></line>
              <line x1="10" y1="2" x2="10" y2="4"></line>
              <line x1="14" y1="2" x2="14" y2="4"></line>
            </svg>
          </div>
          <div className="support-text-block">
            <span className="support-title">Like what I do?</span>
            <span className="support-subtitle">Buy me a coffee</span>
          </div>
        </a>
      </div>
    </div>
  );
}
