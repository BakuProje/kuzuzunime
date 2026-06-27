'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollAnimations() {
  const pathname = usePathname();

  useEffect(() => {
    // Add fade-slide-up class to sections
    const containers = document.querySelectorAll('.section-container, .related-anime-section, .watch-content-wrapper, .episode-grid');
    containers.forEach(el => {
      if (!el.classList.contains('fade-slide-up')) {
        el.classList.add('fade-slide-up');
      }
    });

    // Intersection Observer for scroll animation
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Optional: stop observing once visible for better performance
          // observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px' // Trigger slightly before it comes fully into view
    });

    const elements = document.querySelectorAll('.fade-slide-up');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, [pathname]);

  return null;
}
