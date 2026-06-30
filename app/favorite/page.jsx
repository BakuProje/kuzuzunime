'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Skeleton from '@/app/components/Skeleton';

export default function FavoritePage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('favorites')
        .select('anime_data, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setFavorites(data.map(item => {
          const anime = item.anime_data || {};
          return {
            title: anime.title || 'Anime',
            image: anime.image || '/Zunime.png',
            url: anime.url || anime.anime_id || '',
            score: anime.score || '0.0',
            episode: anime.episode || 'Ongoing',
            status: anime.status || 'Ongoing'
          };
        }));
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div id="favorite-view" className="section-container page-transition" style={{ paddingBottom: '100px' }}>

      <div id="fav-list-inner" style={{ display: 'block', padding: '0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner"></div>
          </div>
        ) : favorites.length > 0 ? (
          <>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#aaa', marginBottom: '15px' }}>Completed ({favorites.length})</div>
            <div className="fav-grid">
              {favorites.map((anime, idx) => {
                const views = (idx * 12 + 50).toFixed(1) + 'K';
                return (
                  <div 
                    key={idx} 
                    className="fav-card" 
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const dataToSave = {
                          title: anime.title,
                          image: anime.image,
                          rating: anime.score,
                          banner: anime.image,
                          genres: [],
                          status: anime.status || 'Ongoing'
                        };
                        sessionStorage.setItem('pending_anime_detail', JSON.stringify(dataToSave));
                      }
                      router.push(`/anime/${encodeURIComponent(anime.url)}`);
                    }}
                  >
                    <div className="fav-img-wrapper">
                      <img src={anime.image} className="fav-card-img" loading="lazy" alt={anime.title} />
                      <div className="fav-rating-tag">⭐ {anime.score}</div>
                      <div className="fav-ep-tag">{anime.episode}</div>
                    </div>
                    <div className="fav-card-views">👁 {views} views</div>
                    <h3 className="fav-card-title">{anime.title}</h3>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginBottom: '15px' }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <h2>Belum ada Favorit</h2>
            <p>Simpan anime kesukaanmu dengan menekan ikon hati.</p>
          </div>
        )}
      </div>
    </div>
  );
}
