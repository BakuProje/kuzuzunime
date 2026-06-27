'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auth Check
    async function getAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Theme Check
    const savedTheme = typeof window !== 'undefined' ? (localStorage.getItem('theme') || 'dark') : 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    return () => subscription.unsubscribe();
  }, []);

  const hideNavbarOn = ['/watch', '/schedule', '/history', '/favorite', '/developer', '/anime', '/auth', '/profile', '/kuzurokenzunimeadmin'];
  
  if (!mounted) return null;
  if (hideNavbarOn.some(path => pathname === path || pathname.includes(path))) return null;

  const handleSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleLogoClick = () => {
    if (user) {
      router.push('/profile');
    } else {
      router.push('/auth');
    }
  };

  const isSearchPage = pathname === '/search';
  return (
    <nav className={`navbar ${isSearchPage ? 'absolute-nav' : ''}`} id="topNavbar">
        <img 
          src="/Zunime.png" 
          alt="Logo Web" 
          className="top-logo" 
          onClick={handleLogoClick}
          style={{ border: user ? '2px solid #ff0000' : 'none', cursor: 'pointer' }}
        />
        <div className="top-search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="search" 
              id="searchInput"
              placeholder="Search anime..." 
              autoComplete="off" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
        </div>
        <button className="theme-toggle-btn" id="themeBtn" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
        </button>
    </nav>
  );
}
