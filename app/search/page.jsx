'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Skeleton from '@/app/components/Skeleton';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q');
  const genre = searchParams.get('genre');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!query && !genre) return;
      setLoading(true);
      try {
        const url = genre 
          ? `/api/search?genre=${encodeURIComponent(genre)}`
          : `/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
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
  }, [query, genre]);

  return (
    <div className="search-list-view page-transition">
      <h2 className="search-page-title" style={{ color: 'white', fontSize: '1.4rem', fontWeight: '800', marginBottom: '25px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '4px', height: '22px', background: 'var(--primary)', borderRadius: '2px' }}></div>
        {genre ? `Genre: ${genre}` : `Hasil Pencarian: "${query || ''}"`}
      </h2>
      
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
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const dataToSave = {
                      title: anime.title,
                      image: anime.image || '/placeholder.jpg',
                      rating: anime.rating || anime.score || '8.5',
                      banner: anime.banner || anime.image || '/placeholder.jpg',
                      genres: anime.genres || [],
                      status: anime.status || 'Ongoing'
                    };
                    sessionStorage.setItem('pending_anime_detail', JSON.stringify(dataToSave));
                  }
                  router.push(`/anime/${encodeURIComponent(anime.url)}`);
                }}
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
      <div className="search-list-view page-transition">
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

