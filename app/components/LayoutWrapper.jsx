'use client';
import { usePathname } from 'next/navigation';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const fullViewPages = ['/watch', '/schedule', '/history', '/favorite', '/dev', '/anime', '/', '/auth', '/profile', '/kuzurokenzunimeadmin', '/search'];
  const isFullView = fullViewPages.some(path => path === '/' ? pathname === '/' : pathname.includes(path));

  return (
    <main id="app" style={{ paddingTop: isFullView ? '0' : '90px' }}>
      {children}
    </main>
  );
}
