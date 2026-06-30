'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Skeleton from '@/app/components/Skeleton';

export default function HistoryPage() {
  const [groups, setGroups] = useState({});
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
        .from('watch_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (data) {
        const grouped = {};
        data.forEach(item => {
          const date = new Date(item.updated_at);
          const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
          const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
          const label = (dateStr === todayStr) ? 'Hari ini' : dateStr;
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push(item);
        });
        setGroups(grouped);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <div className="section-container"><Skeleton style={{ height: '400px' }} /></div>;

  return (
    <div id="history-view" className="section-container page-transition" style={{ paddingBottom: '100px' }}>

      <div id="recent-list-inner" style={{ display: 'block', padding: '0' }}>
        {Object.keys(groups).length > 0 ? (
          <div className="history-timeline">
            {Object.entries(groups).map(([label, items]) => (
              <div key={label} className="history-date-group">
                <div className={`history-date-badge ${label === 'Hari ini' ? 'today' : ''}`}>{label}</div>
                {items.map((item, idx) => {
                  const progressPercent = Math.round((item.progress / (item.duration || 1440)) * 100);
                  const time = new Date(item.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  const durStr = `${Math.floor(item.progress/60)}:${(item.progress%60).toString().padStart(2,'0')} / 24:00`;
                  
                  return (
                    <div 
                      key={idx} 
                      className="history-card" 
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          const dataToSave = {
                            title: item.anime_title || 'Anime',
                            image: item.anime_image || '/Zunime.png',
                            rating: '8.5',
                            banner: item.anime_image || '/Zunime.png',
                            genres: [],
                            status: 'Ongoing'
                          };
                          sessionStorage.setItem('pending_anime_detail', JSON.stringify(dataToSave));
                        }
                        router.push(`/anime/${encodeURIComponent(item.anime_id)}`);
                      }}
                    >
                        <div className="history-card-img-wrapper">
                            <img 
                              src={item.anime_image || '/Zunime.png'} 
                              className="history-card-img" 
                              alt={item.anime_title} 
                              onError={(e) => e.target.src = '/Zunime.png'}
                            />
                        </div>
                        <div className="history-card-info">
                            <div className="history-card-top">
                                <h3 className="history-card-title">{item.anime_title || 'Anime'}</h3>
                                <span className="history-card-time">{time}</span>
                            </div>
                            <span className="history-card-ep">Episode {item.episode_id ? item.episode_id.replace(/^\/|\/$/g, '').split('-').pop() : '?'}</span>
                            <div className="history-progress-wrapper">
                                <div className="history-progress-bar"><div className="history-progress-fill" style={{ width: `${progressPercent}%` }}></div></div>
                                <div className="history-progress-text">{durStr}</div>
                            </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginBottom: '15px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <h2>Belum ada riwayat</h2>
            <p>Anime yang baru saja kamu lihat akan muncul di sini.</p>
          </div>
        )}
      </div>
    </div>
  );
}
