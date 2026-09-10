import { NextResponse } from 'next/server';
import { schedule } from '@/lib/scraper';

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._scheduleCache) {
  global._scheduleCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 1800 * 1000; // 30 minutes

export async function GET() {
  if (global._scheduleCache.data && (Date.now() - global._scheduleCache.timestamp < CACHE_TTL)) {
    console.log('[SERVER CACHE HIT] Serving schedule from server cache');
    return NextResponse.json({ success: true, data: global._scheduleCache.data });
  }

  try {
    const daysOrder = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
    const grouped = daysOrder.map(d => ({ day: d, list: [] }));

    // Get current time in WIB (Asia/Jakarta)
    const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const todayIndex = nowWib.getDay(); // 0 (Sunday) to 6 (Saturday)
    const currentHour = nowWib.getHours();
    const currentMinute = nowWib.getMinutes();

    // Predefined popular ongoing seasonal anime to enrich the schedule
    const seasonalAnime = {
      'MIN': [
        { title: 'One Piece', time: '09:30', image: 'https://static.gdrivecdn.me/poster/anime/one-piece.jpg?h=300', score: '8.9', url: '/anime/one-piece/' },
        { title: 'Demon Slayer', time: '23:15', image: 'https://static.cdnhlsplayer.lat/poster/anime/sousou-no-frieren.jpg?h=300', score: '9.0', url: '/anime/sousou-no-frieren/' },
        { title: 'Mushoku Tensei Season 3', time: '22:00', image: 'https://static.gdrivecdn.me/poster/anime/mushoku-tensei-iii-isekai-ittara-honki-dasu.jpg?h=300', score: '8.8', url: '/anime/mushoku-tensei-iii-isekai-ittara-honki-dasu/' }
      ],
      'SEN': [
        { title: 'Tsukimichi -Moonlit Fantasy- Season 2', time: '22:00', image: 'https://static.cdnhlsplayer.lat/poster/anime/sousou-no-frieren.jpg?h=300', score: '8.1', url: '/anime/sousou-no-frieren/' },
        { title: 'Detective Conan', time: '18:30', image: 'https://static.cdnhlsplayer.lat/poster/anime/detective-conan.jpg?h=300', score: '8.5', url: '/anime/detective-conan/' }
      ],
      'SEL': [
        { title: 'Black Clover', time: '18:00', image: 'https://static.cdnhlsplayer.lat/poster/anime/bleach-sennen-kessen-hen.jpg?h=300', score: '8.3', url: '/anime/bleach-sennen-kessen-hen/' },
        { title: 'Bleach Sennen Kessen Hen', time: '23:00', image: 'https://static.cdnhlsplayer.lat/poster/anime/bleach-sennen-kessen-hen.jpg?h=300', score: '8.98', url: '/anime/bleach-sennen-kessen-hen/' }
      ],
      'RAB': [
        { title: "KonoSuba: God's Blessing 3", time: '22:00', image: 'https://static.cdnhlsplayer.lat/poster/anime/sousou-no-frieren.jpg?h=300', score: '8.7', url: '/anime/sousou-no-frieren/' },
        { title: 'Solo Leveling', time: '23:30', image: 'https://static.gdrivecdn.me/poster/anime/one-piece.jpg?h=300', score: '8.9', url: '/anime/one-piece/' }
      ],
      'KAM': [
        { title: 'Wind Breaker', time: '23:00', image: 'https://static.cdnhlsplayer.lat/poster/anime/gintama-s5.jpg?h=300', score: '8.4', url: '/anime/gintama-s5/' },
        { title: 'Dungeon Meshi', time: '21:30', image: 'https://static.cdnhlsplayer.lat/poster/anime/sousou-no-frieren.jpg?h=300', score: '8.5', url: '/anime/sousou-no-frieren/' }
      ],
      'JUM': [
        { title: 'Jujutsu Kaisen', time: '23:30', image: 'https://static.cdnhlsplayer.lat/poster/anime/bleach-sennen-kessen-hen.jpg?h=300', score: '8.8', url: '/anime/bleach-sennen-kessen-hen/' },
        { title: 'Gintama S5', time: '22:00', image: 'https://static.cdnhlsplayer.lat/poster/anime/gintama-s5.jpg?h=300', score: '8.98', url: '/anime/gintama-s5/' }
      ],
      'SAB': [
        { title: 'Kaiju No. 8', time: '22:00', image: 'https://static.gdrivecdn.me/poster/anime/one-piece.jpg?h=300', score: '8.5', url: '/anime/one-piece/' },
        { title: 'My Hero Academia', time: '16:30', image: 'https://static.cdnhlsplayer.lat/poster/anime/gintama-s5.jpg?h=300', score: '8.3', url: '/anime/gintama-s5/' }
      ]
    };

    // 1. Fetch live ongoing anime from Samehadaku
    let ongoingList = [];
    try {
      ongoingList = await schedule();
    } catch (e) {
      console.error('Schedule scrape failed:', e);
    }

    // Distribute ongoing anime across the 7 days deterministically
    if (ongoingList && ongoingList.length > 0) {
      ongoingList.forEach((item, idx) => {
        const dayIdx = idx % 7;
        const dayShortId = daysOrder[dayIdx];
        const dayWeekIndex = dayIdx;

        let status = 'Akan Tayang';
        if (dayWeekIndex < todayIndex) {
          status = 'Sudah Tayang';
        } else if (dayWeekIndex === todayIndex) {
          status = 'Sudah Tayang';
        }

        const times = ['12:30', '16:00', '18:30', '20:00', '21:30', '22:00', '23:00', '23:30'];
        const assignedTime = times[idx % times.length];

        grouped[dayIdx].list.push({
          id: item.url || item.title,
          title: item.title,
          image: item.image,
          time: assignedTime,
          episode: item.episode || 'Ongoing',
          score: item.score || '8.5',
          status,
          airingAt: 0,
          day: dayShortId,
          url: item.url
        });
      });
    }

    // 2. Enrich with seasonal anime
    grouped.forEach(day => {
      const dayShortId = day.day;
      const dayIdx = daysOrder.indexOf(dayShortId);
      const extraList = seasonalAnime[dayShortId] || [];

      extraList.forEach(extra => {
        if (day.list.some(existing => existing.title.toLowerCase() === extra.title.toLowerCase())) {
          return;
        }

        let status = 'Akan Tayang';
        if (dayIdx < todayIndex) {
          status = 'Sudah Tayang';
        } else if (dayIdx === todayIndex) {
          if (extra.time) {
            const [hour, minute] = extra.time.split(':').map(Number);
            if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
              status = 'Sudah Tayang';
            }
          }
        }

        day.list.push({
          id: extra.url || `extra-${extra.title.replace(/\s+/g, '-').toLowerCase()}`,
          title: extra.title,
          image: extra.image,
          time: extra.time,
          episode: 'Ongoing',
          score: extra.score,
          status,
          airingAt: 0,
          day: dayShortId,
          url: extra.url
        });
      });
    });

    // 3. Sort lists by release time
    grouped.forEach(day => {
      day.list.sort((a, b) => a.time.localeCompare(b.time));
    });

    if (grouped && grouped.length > 0) {
      global._scheduleCache.data = grouped;
      global._scheduleCache.timestamp = Date.now();
    }

    return NextResponse.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Schedule API Error:', error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
