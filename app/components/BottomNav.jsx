'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hideOn = ['/watch', '/anime', '/auth', '/profile', '/kuzurokenzunimeadmin'];
  if (hideOn.some(path => pathname === path || pathname.includes(path))) return null;

  const handleTabClick = (path) => {
    if (path === '/' && pathname === '/') {
      window.location.reload();
    } else {
      router.push(path);
    }
  };

  const tabs = [
    { 
      name: 'Home', 
      path: '/', 
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ) 
    },
    { 
      name: 'Jadwal', 
      path: '/schedule', 
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ) 
    },
    { 
      name: 'Recent', 
      path: '/history', 
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ) 
    },
    { 
      name: 'Favorite', 
      path: '/favorite', 
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      ) 
    },
    { 
      name: 'Zunime', 
      path: '/developer', 
      icon: (
        <img 
          src="/Zunime.png" 
          alt="Zunime" 
          width="22" 
          height="22" 
          style={{ 
            borderRadius: '50%', 
            objectFit: 'cover',
            border: pathname === '/developer' ? '1.5px solid #ff0055' : '1.5px solid rgba(255, 255, 255, 0.4)',
            transition: 'all 0.2s ease',
            boxShadow: pathname === '/developer' ? '0 0 8px rgba(255, 0, 85, 0.5)' : 'none'
          }} 
        />
      ) 
    }
  ];

  return (
    <nav className="bottom-nav" id="bottomNav">
      {tabs.map((tab, idx) => (
        <div 
          key={idx} 
          onClick={() => handleTabClick(tab.path)} 
          className={`nav-item ${pathname === tab.path ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
        >
          <div className="nav-icon-wrapper">
            {tab.icon}
          </div>
          <span>{tab.name}</span>
        </div>
      ))}
      <style jsx>{`
        .nav-icon-circle {
          width: 32px;
          height: 32px;
          border: 2px solid #333;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.05);
          transition: all 0.3s ease;
        }
        .nav-item.active .nav-icon-circle {
          border-color: #ff0000;
          background: rgba(255,0,0,0.1);
        }
      `}</style>
    </nav>
  );
}
