'use client';
import { useEffect, useState } from 'react';
import Skeleton from '../components/Skeleton';

const DAY_NAMES_ID = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

export default function SchedulePage() {
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState('');
  const [mounted, setMounted] = useState(false);
  const [dates, setDates] = useState({});

  useEffect(() => {
    setMounted(true);
    
    // Auto detect today in WIB
    const now = new Date();
    const todayShort = now.toLocaleString('id-ID', { 
      timeZone: 'Asia/Jakarta', 
      weekday: 'short' 
    }).toUpperCase();
    
    setActiveDay(todayShort);

    // Generate dates for the row
    const tempDates = {};
    const currentDayIdx = now.getDay(); // 0-6
    
    DAY_NAMES_ID.forEach((name, idx) => {
      const d = new Date();
      const diff = idx - currentDayIdx;
      d.setDate(now.getDate() + diff);
      tempDates[name] = d.getDate();
    });
    setDates(tempDates);

    // Fetch logic with cache (SWR pattern)
    async function fetchSchedule() {
      const cached = localStorage.getItem('zunime_schedule_cache_v3');
      const cacheTime = localStorage.getItem('zunime_schedule_time');
      
      const hasCache = !!cached;
      const isCacheFresh = cached && cacheTime && (Date.now() - parseInt(cacheTime) < 3600000); // 1 hour

      if (hasCache) {
        // Load old cache instantly for 0ms render time
        const parsed = JSON.parse(cached);
        setScheduleData(parsed);
        setLoading(false);
        checkAndSetAutoDay(parsed, todayShort);

        // Silently refresh in the background if cache is stale
        if (!isCacheFresh) {
          try {
            const res = await fetch('/api/schedule');
            const data = await res.json();
            if (data.success && data.data) {
              setScheduleData(data.data);
              localStorage.setItem('zunime_schedule_cache_v3', JSON.stringify(data.data));
              localStorage.setItem('zunime_schedule_time', Date.now().toString());
              checkAndSetAutoDay(data.data, todayShort);
            }
          } catch (e) {
            console.error("Background schedule refresh error:", e);
          }
        }
      } else {
        // No cache: fetch in foreground
        try {
          const res = await fetch('/api/schedule');
          const data = await res.json();
          if (data.success && data.data) {
            setScheduleData(data.data);
            localStorage.setItem('zunime_schedule_cache_v3', JSON.stringify(data.data));
            localStorage.setItem('zunime_schedule_time', Date.now().toString());
            checkAndSetAutoDay(data.data, todayShort);
          }
        } catch (e) {
          console.error("Fetch schedule error:", e);
        } finally {
          setLoading(false);
        }
      }
    }

    function checkAndSetAutoDay(data, today) {
      const todayData = data.find(d => d.day === today);
      if (!todayData || todayData.list.length === 0) {
        // Fallback: Find first day that has data
        const firstWithData = data.find(d => d.list.length > 0);
        if (firstWithData) setActiveDay(firstWithData.day);
      } else {
        setActiveDay(today);
      }
    }

    fetchSchedule();
  }, []);

  if (!mounted) return null;

  const activeDayData = scheduleData.find(d => d.day === activeDay);

  return (
    <div id="schedule-view" className="section-container page-transition">
      <div className="section-header" style={{ padding: '20px 20px 10px', display: 'flex', justifyContent: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Jadwal Tayang</h1>
      </div>

      {loading ? (
        <div className="schedule-list" style={{ marginTop: '10px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={`schedule-skeleton-${i}`} className="schedule-card-wrapper" style={{ pointerEvents: 'none' }}>
              <div className="schedule-card">
                <div className="schedule-time-bar" style={{ background: '#222' }}></div>
                <div className="schedule-time" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <Skeleton style={{ width: '40px', height: '14px', borderRadius: '3px' }} />
                  <Skeleton style={{ width: '20px', height: '9px', borderRadius: '2px' }} />
                </div>
                <div className="schedule-img-wrapper">
                  <Skeleton style={{ width: '100%', height: '100%', borderRadius: '0' }} />
                </div>
                <div className="schedule-info" style={{ gap: '6px' }}>
                  <Skeleton style={{ width: '80%', height: '14px', borderRadius: '3px' }} />
                  <Skeleton style={{ width: '45%', height: '11px', borderRadius: '3px' }} />
                  <Skeleton style={{ width: '30%', height: '11px', borderRadius: '3px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Days Header Scroll */}
          <div className="schedule-header-row">
            {scheduleData.map((item, idx) => {
              const isActive = activeDay === item.day;
              return (
                <div 
                  key={idx} 
                  className={`schedule-day-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveDay(item.day)}
                >
                  <span className="schedule-day-name">{item.day}</span>
                  <div className="schedule-day-num">{dates[item.day] || '--'}</div>
                </div>
              );
            })}
          </div>

          {/* Schedule List */}
          <div className="schedule-list">
            {activeDayData && activeDayData.list.map((anime, idx) => (
              <div key={`${anime.id}-${idx}`} className="schedule-card-wrapper">
                <div className="schedule-card">
                  <div className="schedule-time-bar" style={{ background: anime.status === 'Akan Tayang' ? '#3b82f6' : '#fbbf24' }}></div>
                  <div className="schedule-time">{anime.time} <span style={{fontSize: '0.6rem', opacity: 0.6, display: 'block'}}>WIB</span></div>
                  <div className="schedule-img-wrapper">
                    <img src={anime.image} alt={anime.title} loading="lazy" />
                  </div>
                  <div className="schedule-info">
                    <div className="schedule-title">{anime.title}</div>
                    <div className="schedule-ep">Episode {anime.episode}</div>
                    <div className="schedule-meta-row">
                      <div style={{ color: '#ffcc00', fontSize: '0.75rem' }}>⭐ {anime.score}</div>
                    </div>
                    <div className={`schedule-status ${anime.status === 'Akan Tayang' ? 'upcoming' : 'aired'}`} 
                         style={{ color: anime.status === 'Akan Tayang' ? '#3b82f6' : '#fbbf24' }}>
                      {anime.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {(!activeDayData || activeDayData.list.length === 0) && (
              <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>📅 Belum ada jadwal tersedia.</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Silakan periksa hari lainnya.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
