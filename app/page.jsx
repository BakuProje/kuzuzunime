'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PremiumAnimeCard, { PremiumAnimeCardSkeleton } from './components/PremiumAnimeCard';
import Skeleton from './components/Skeleton';
import Link from 'next/link';

const HOME_SECTIONS = [
  { title: "Action Hits", queries: ["action", "fighting", "shounen"] },
  { title: "Adventure & Fantasy", queries: ["adventure", "fantasy", "magic"] },
  { title: "Isekai & Reincarnation", queries: ["isekai", "reincarnation", "another world"] },
  { title: "Romance & Drama", queries: ["romance", "drama", "shoujo"] },
  { title: "Slice of Life & Comedy", queries: ["slice of life", "comedy", "school"] },
  { title: "Sports Spirit", queries: ["sports", "haikyuu", "baseball"] },
  { title: "Seinen (Mature)", queries: ["seinen", "psychological", "thriller", "dark"] },
  { title: "Supernatural & Mystery", queries: ["supernatural", "mystery", "horror"] },
  { title: "Movie Anime", queries: ["movie", "film", "special"] },
  { title: "Sci-Fi & Mecha", queries: ["sci-fi", "mecha", "robot", "space"] },
  { title: "Historical & Samurai", queries: ["historical", "samurai", "edo"] },
  { title: "School & Campus", queries: ["school", "college", "student"] },
  { title: "Music & Idol", queries: ["music", "idol", "band"] },
  { title: "Game & Virtual Reality", queries: ["game", "virtual", "rpg"] },
  { title: "Super Power & Martial Arts", queries: ["super power", "martial arts", "kung fu"] },
  { title: "Military & Police", queries: ["military", "police", "war"] },
  { title: "Demon & Vampire", queries: ["demon", "vampire", "devil"] }
];

// Lazy Loaded Category Section with Intersection Observer and Client-side caching
function LazyCategorySection({ title, queries }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' } // Pre-load 300px before scrolling in for seamless transitions
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    async function fetchSection() {
      const cacheKey = `zunime_genre_${title.toLowerCase().replace(/\s+/g, '_')}`;
      const cached = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(`${cacheKey}_time`);
      
      // Cache valid for 6 hours to keep it reasonably fresh but incredibly fast
      if (cached && cachedTime && (Date.now() - parseInt(cachedTime) < 6 * 3600000)) {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      }

      try {
        const queryPromises = queries.map(q =>
          fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
        );
        const results = await Promise.all(queryPromises);
        
        let combinedData = [];
        results.forEach(res => {
          if (res.success && res.data) {
            combinedData = [...combinedData, ...res.data];
          }
        });

        const uniqueData = combinedData
          .filter((v, i, a) => a.findIndex(t => t.url === v.url) === i)
          .slice(0, 30);

        if (isMounted) {
          setData(uniqueData);
          setLoading(false);
          if (uniqueData.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify(uniqueData));
            localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
          }
        }
      } catch (e) {
        console.error(`Error fetching category ${title}:`, e);
        if (isMounted) setLoading(false);
      }
    }

    fetchSection();
    return () => { isMounted = false; };
  }, [visible, title, queries]);

  if (!loading && data.length === 0) return null;

  return (
    <section ref={sectionRef} className="category-section" style={{ minHeight: '280px' }}>
      <div className="header-flex">
        <div className="section-header">
          <div className="bar-accent"></div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{title}</h2>
        </div>
      </div>
      
      <div className="horizontal-scroll">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => (
            <PremiumAnimeCardSkeleton key={`skeleton-${i}`} />
          ))
        ) : (
          data.map((anime, i) => (
            <PremiumAnimeCard key={`${title}-${i}-${anime.url}`} anime={anime} isNew={false} />
          ))
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [latest, setLatest] = useState([]);
  const [hotAnime, setHotAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const sliderRef = useRef(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  const removeDuplicates = (arr) => {
    if (!arr) return [];
    return arr.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchCoreData() {
      const cacheTimeKey = 'zunime_core_cache_time';
      const cachedTime = localStorage.getItem(cacheTimeKey);
      const cachedLatest = localStorage.getItem('zunime_latest_cache');
      const cachedPopular = localStorage.getItem('zunime_popular_cache');

      // Cache valid for 10 minutes
      const isCacheValid = cachedTime && 
                           cachedLatest && 
                           cachedPopular && 
                           (Date.now() - parseInt(cachedTime) < 600000);

      if (isCacheValid) {
        if (isMounted) {
          setLatest(JSON.parse(cachedLatest));
          setHotAnime(JSON.parse(cachedPopular));
          setLoading(false);
        }
        
        // Silent background refresh
        try {
          const [latestRes, popularRes] = await Promise.all([
            fetch('/api/latest?limit=50').then(r => r.json()),
            fetch('/api/popular').then(r => r.json())
          ]);
          
          if (isMounted) {
            if (latestRes.success) {
              const freshLatest = removeDuplicates(latestRes.data);
              setLatest(freshLatest);
              localStorage.setItem('zunime_latest_cache', JSON.stringify(freshLatest));
            }
            if (popularRes.success) {
              const freshPopular = removeDuplicates(popularRes.data);
              setHotAnime(freshPopular);
              localStorage.setItem('zunime_popular_cache', JSON.stringify(freshPopular));
            }
            localStorage.setItem(cacheTimeKey, Date.now().toString());
          }
        } catch (e) {
          console.error('Core background refresh failed:', e);
        }
      } else {
        // Foreground load
        try {
          const [latestRes, popularRes] = await Promise.all([
            fetch('/api/latest?limit=50').then(r => r.json()),
            fetch('/api/popular').then(r => r.json())
          ]);

          if (isMounted) {
            if (latestRes.success) {
              const freshLatest = removeDuplicates(latestRes.data);
              setLatest(freshLatest);
              localStorage.setItem('zunime_latest_cache', JSON.stringify(freshLatest));
            }
            if (popularRes.success) {
              const freshPopular = removeDuplicates(popularRes.data);
              setHotAnime(freshPopular);
              localStorage.setItem('zunime_popular_cache', JSON.stringify(freshPopular));
            }
            localStorage.setItem(cacheTimeKey, Date.now().toString());
          }
        } catch (e) {
          console.error('Error fetching core home data:', e);
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    }

    fetchCoreData();
    return () => { isMounted = false; };
  }, []);

  // Auto Scroll Slider
  useEffect(() => {
    if (latest.length > 0 && sliderRef.current) {
      const interval = setInterval(() => {
        setSlideIndex((prev) => {
          const next = prev >= 4 ? 0 : prev + 1;
          const slides = sliderRef.current?.querySelectorAll('.hero-slide');
          if (slides && slides[next]) {
            sliderRef.current.scrollTo({
              left: slides[next].offsetLeft - 20,
              behavior: 'smooth'
            });
          }
          return next;
        });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [latest]);

  if (!mounted) return null;

  return (
    <div id="home-view" className="section-container page-transition" style={{ paddingBottom: '100px' }}>
      {/* Hero Slider */}
      <section className="hero-section-container">
        {loading ? (
          <div key="hero-skeleton" className="hero-slider" style={{ overflow: 'hidden' }}>
            <Skeleton className="hero-slide" style={{ height: '220px', minWidth: '90%' }} />
          </div>
        ) : (
          <div className="hero-slider" ref={sliderRef}>
            {latest.slice(0, 10).map((anime) => {
              const score = (anime.score && anime.score !== 'N/A') ? anime.score : ((anime.rating && anime.rating !== 'N/A') ? anime.rating : '8.5');
              const type = anime.type || 'Anime';
              const year = anime.year || '2026';
              const epNumMatch = anime.episode ? anime.episode.match(/\d+(\.\d+)?/) : null;
              const eps = epNumMatch ? `Ep ${epNumMatch[0]}` : (anime.episode ? `Ep ${anime.episode}` : '');

              return (
                <div key={anime.url} className="hero-slide" onClick={() => router.push(`/anime/${encodeURIComponent(anime.url)}`)}>
                  <img src={anime.banner || anime.image} className="hero-bg-blur" alt="" loading="lazy" aria-hidden="true" />
                  <img src={anime.image} className="hero-bg" alt={anime.title} loading="lazy" />
                  <div className="hero-overlay"></div>
                  <div className="hero-content">
                    {eps && <div className="hero-badge">{eps}</div>}
                    <h2 className="hero-title">{anime.title}</h2>
                    <div className="hero-meta">
                      <span>⭐ {score}</span> • <span>{type}</span> • <span>{year}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="category-section" style={{ marginTop: '30px' }}>
        <div className="header-flex">
          <div className="section-header">
            <div className="bar-accent"></div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>New Anime</h2>
          </div>
        </div>
        
        {loading ? (
          <div key="new-anime-skeleton" className="horizontal-scroll">
            {[1, 2, 3, 4, 5].map(col => (
              <div key={`skeleton-col-${col}`} className="new-anime-scroll-column">
                {[1, 2].map(row => (
                  <PremiumAnimeCardSkeleton key={`skeleton-card-${col}-${row}`} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="horizontal-scroll">
            {(() => {
              const columns = [];
              for (let i = 0; i < latest.length; i += 2) {
                const pair = latest.slice(i, i + 2);
                columns.push(
                  <div key={`col-${i}`} className="new-anime-scroll-column">
                    {pair.map((anime) => (
                      <PremiumAnimeCard key={anime.url} anime={anime} isNew={true} />
                    ))}
                  </div>
                );
              }
              return columns;
            })()}
          </div>
        )}
      </section>

      {/* Hot Anime */}
      {!loading && hotAnime.length > 0 && (
        <section className="category-section">
          <div className="header-flex" style={{ marginBottom: '20px' }}>
            <div className="section-header">
              <div className="bar-accent"></div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Hot Anime</h2>
            </div>
          </div>

          <div className="hot-anime-scroll-container">
            {/* Column 1: Featured Rank #1 */}
            {hotAnime[0] && (() => {
              const anime = hotAnime[0];
              const score = (anime.score && anime.score !== 'N/A') ? anime.score : '8.5';
              
              const rawEp = anime.episode || anime.status || anime.type || 'Ongoing';
              let eps = '';
              if (rawEp) {
                const cleanEp = rawEp.toString().replace(/Episode|Eps|Ep/gi, '').trim();
                if (/^\d+(\.\d+)?$/.test(cleanEp)) {
                  eps = `Eps ${cleanEp}`;
                } else {
                  const lower = cleanEp.toLowerCase();
                  if (lower === 'completed' || lower === 'finished' || lower === 'tamat') {
                    eps = 'Tamat';
                  } else if (lower === 'ongoing' || lower === 'releasing') {
                    eps = 'Ongoing';
                  } else {
                    eps = cleanEp;
                  }
                }
              }
              const viewCount = `${(Math.floor(Math.abs(anime.title.length * 9.2) % 600) + 300)}K`;

              return (
                <div className="hot-scroll-column-featured" onClick={() => router.push(`/anime/${encodeURIComponent(anime.url)}`)}>
                  <div className="hot-card-featured">
                    <div className="hot-rank-badge">#1</div>
                    <div className="hot-card-img-wrapper-featured">
                      <img src={anime.image || '/placeholder.jpg'} className="hot-card-bg-blur" alt="" loading="lazy" aria-hidden="true" />
                      <img src={anime.image || '/placeholder.jpg'} className="hot-card-bg" alt={anime.title} loading="lazy" />
                      <div className="hot-card-rating-badge">
                        <span>⭐</span> {score}
                      </div>
                      <div className="hot-card-image-overlay-info">
                        <div className="hot-card-eps-overlay">{eps}</div>
                        <div className="hot-card-views-overlay">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                          <span>{viewCount} views</span>
                        </div>
                        <div className="hot-card-title-featured">{anime.title}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Subsequent Columns: Ranks #2 to #50 in pairs of 2 */}
            {(() => {
              const columns = [];
              const items = hotAnime.slice(1, 50);
              for (let i = 0; i < items.length; i += 2) {
                const pair = items.slice(i, i + 2);
                columns.push(
                  <div key={`col-${i}`} className="hot-scroll-column-stacked">
                    {pair.map((anime, index) => {
                      const rankNum = i + index + 2;
                      const score = (anime.score && anime.score !== 'N/A') ? anime.score : '8.5';
                      
                      const rawEp = anime.episode || anime.status || anime.type || 'Ongoing';
                      let eps = '';
                      if (rawEp) {
                        const cleanEp = rawEp.toString().replace(/Episode|Eps|Ep/gi, '').trim();
                        if (/^\d+(\.\d+)?$/.test(cleanEp)) {
                          eps = `Eps ${cleanEp}`;
                        } else {
                          const lower = cleanEp.toLowerCase();
                          if (lower === 'completed' || lower === 'finished' || lower === 'tamat') {
                            eps = 'Tamat';
                          } else if (lower === 'ongoing' || lower === 'releasing') {
                            eps = 'Ongoing';
                          } else {
                            eps = cleanEp;
                          }
                        }
                      }
                      const viewCount = `${(Math.floor(Math.abs(anime.title.length * 9.2) % 600) + 300)}K`;

                      return (
                        <div key={anime.url} className="hot-card-stacked" onClick={() => router.push(`/anime/${encodeURIComponent(anime.url)}`)}>
                          <div className="hot-rank-badge">#{rankNum}</div>
                          <div className="hot-card-img-wrapper-stacked">
                            <img src={anime.image || '/placeholder.jpg'} className="hot-card-bg-blur" alt="" loading="lazy" aria-hidden="true" />
                            <img src={anime.image || '/placeholder.jpg'} className="hot-card-bg" alt={anime.title} loading="lazy" />
                            <div className="hot-card-rating-badge">
                              <span>⭐</span> {score}
                            </div>
                            <div className="hot-card-image-overlay-info">
                              <div className="hot-card-eps-overlay">{eps}</div>
                              <div className="hot-card-views-overlay">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                <span>{viewCount} views</span>
                              </div>
                              <div className="hot-card-title-stacked">{anime.title}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return columns;
            })()}
          </div>
        </section>
      )}

      {/* Categories / Genres Sections */}
      {!loading && HOME_SECTIONS.map((sec) => (
        <LazyCategorySection key={sec.title} title={sec.title} queries={sec.queries} />
      ))}
    </div>
  );
}
