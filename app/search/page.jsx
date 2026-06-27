'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Skeleton from '@/app/components/Skeleton';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!query) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) {
          // Deduplicate
          const unique = data.data.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
          setResults(unique);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [query]);

  return (
    <div className="search-list-view">
      
      <div className="search-results-list">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} className="search-item-skeleton">
               <Skeleton className="skeleton-thumb" />
               <div className="skeleton-info">
                  <Skeleton className="skeleton-title" />
                  <Skeleton className="skeleton-meta" />
                  <Skeleton className="skeleton-desc" />
               </div>
            </div>
          ))
        ) : (
          results.length > 0 ? (
            results.map((anime) => (
              <div 
                key={anime.url} 
                className="search-item-modern fade-slide-up visible"
                onClick={() => router.push(`/anime/${encodeURIComponent(anime.url)}`)}
              >
                <div className="item-thumb-wrapper">
                   <img src={anime.image} loading="lazy" alt={anime.title} />
                   <div className="badge-rating-modern">⭐ {anime.rating || anime.score || '8.5'}</div>
                   {anime.episode && <div className="badge-ep-modern">Ep {anime.episode.replace('Episode', '').trim()}</div>}
                </div>

                <div className="item-info-modern">
                   <div className="info-top">
                      <h3 className="title-modern">{anime.title}</h3>
                      <p className="subtitle-modern">{anime.altTitle || 'Judul Alternatif'}</p>
                      <div className="meta-row-modern">
                         <span>👁 {(Math.floor(Math.abs(anime.title.length * 7.5) % 800) + 150)}K views</span>
                         <span className="dot">•</span>
                         <span>{anime.type || 'TV'}</span>
                      </div>
                   </div>
                   
                   <p className="desc-modern">
                      {anime.synopsis || `Tonton anime ${anime.title} sub indo gratis hanya di ZUNIME. Nikmati streaming lancar dengan kualitas HD.`}
                   </p>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-search-state">
              <div className="empty-icon">🔍</div>
              <h2>Oopps! Tidak ditemukan</h2>
              <p>Coba gunakan kata kunci lain atau periksa ejaanmu.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="search-list-view">
        <div className="search-results-list">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="search-item-skeleton">
               <Skeleton className="skeleton-thumb" />
               <div className="skeleton-info">
                  <Skeleton className="skeleton-title" />
                  <Skeleton className="skeleton-meta" />
                  <Skeleton className="skeleton-desc" />
               </div>
            </div>
          ))}
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

