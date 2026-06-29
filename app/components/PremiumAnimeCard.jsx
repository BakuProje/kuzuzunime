import Link from 'next/link';
import Skeleton from './Skeleton';

export function PremiumAnimeCardSkeleton() {
  return (
    <div className="premium-anime-card" style={{ pointerEvents: 'none' }}>
      <div className="premium-card-img-wrapper">
        <Skeleton style={{ width: '100%', height: '100%', borderRadius: '0' }} />
      </div>
      <div className="premium-card-info" style={{ gap: '8px' }}>
        <div className="card-views">
          <Skeleton style={{ width: '50px', height: '10px', borderRadius: '3px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <Skeleton style={{ width: '100%', height: '13px', borderRadius: '3px' }} />
          <Skeleton style={{ width: '70%', height: '13px', borderRadius: '3px' }} />
        </div>
      </div>
    </div>
  );
}

export default function PremiumAnimeCard({ anime, isNew = false, views = null }) {
  const { title, image, episode, rating, url, score } = anime;
  const displayRating = (rating && rating !== 'N/A') ? rating : (score && score !== 'N/A' ? score : '8.5');
  
  let eps = '';
  const rawEp = episode || anime.status || anime.type;
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
  
  // Deterministic views based on title
  const viewCount = views || `${(Math.floor(Math.abs(title.length * 7.5) % 800) + 150)}K`;

  const handlePreload = () => {
    if (typeof window !== 'undefined') {
      const dataToSave = {
        title,
        image: image || '/placeholder.jpg',
        rating: displayRating,
        banner: image || '/placeholder.jpg',
        genres: anime.genres || [],
        status: anime.status || 'Ongoing'
      };
      sessionStorage.setItem('pending_anime_detail', JSON.stringify(dataToSave));
    }
  };

  return (
    <Link href={`/anime/${encodeURIComponent(url)}`} onClick={handlePreload}>
      <div className="premium-anime-card">
          <div className="premium-card-img-wrapper">
              <img src={image || '/placeholder.jpg'} loading="lazy" alt={title} />
              
              {isNew && <div className="badge-top-left">New</div>}
              
              <div className="badge-top-right">
                <span style={{ color: '#ffcc00' }}>⭐</span> {displayRating}
              </div>
              
              {eps && <div className="badge-bottom-left">{eps}</div>}
          </div>
          
          <div className="premium-card-info">
             <div className="card-views" style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg> 
                <span>{viewCount} views</span>
                {anime.released && (
                  <>
                    <span style={{ opacity: 0.4, flexShrink: 0 }}>•</span>
                    <span style={{ textTransform: 'lowercase', flexShrink: 0 }}>
                      {anime.released
                        .replace(/hours?/i, 'jam')
                        .replace(/minutes?/i, 'menit')
                        .replace(/days?/i, 'hari')
                        .replace(/weeks?/i, 'minggu')
                        .replace(/months?/i, 'bulan')
                        .replace(/years?/i, 'tahun')
                        .replace(/ago/i, 'lalu')
                        .replace(/yang/i, '')
                        .replace(/\s+/g, ' ')
                        .trim()
                      }
                    </span>
                  </>
                )}
             </div>
             <div className="premium-card-title">{title}</div>
          </div>
      </div>
    </Link>
  );
}
