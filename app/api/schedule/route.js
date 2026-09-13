export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { schedule, getAnimePoster } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._scheduleCache) {
  global._scheduleCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 1800 * 1000; // 30 minutes

export async function GET() {
  if (global._scheduleCache.data && (Date.now() - global._scheduleCache.timestamp < CACHE_TTL)) {
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
        { title: 'One Piece', time: '09:30', score: '8.9', url: '/anime/one-piece/' },
        { title: 'Demon Slayer', time: '23:15', score: '9.0', url: '/anime/kimetsu-no-yaiba/' },
        { title: 'Mushoku Tensei Season 3', time: '22:00', score: '8.8', url: '/anime/mushoku-tensei-iii-isekai-ittara-honki-dasu/' }
      ],
      'SEN': [
        { title: 'Tsukimichi -Moonlit Fantasy- Season 2', time: '22:00', score: '8.1', url: '/anime/tsuki-ga-michibiku-isekai-douchuu-2nd-season/' },
        { title: 'Detective Conan', time: '18:30', score: '8.5', url: '/anime/detective-conan/' }
      ],
      'SEL': [
        { title: 'Black Clover', time: '18:00', score: '8.3', url: '/anime/black-clover/' },
        { title: 'Bleach Sennen Kessen Hen', time: '23:00', score: '8.98', url: '/anime/bleach-sennen-kessen-hen/' }
      ],
      'RAB': [
        { title: "KonoSuba: God's Blessing 3", time: '22:00', score: '8.7', url: '/anime/konosuba-season-3/' },
        { title: 'Solo Leveling', time: '23:30', score: '8.9', url: '/anime/solo-leveling/' }
      ],
      'KAM': [
        { title: 'Wind Breaker', time: '23:00', score: '8.4', url: '/anime/wind-breaker/' },
        { title: 'Dungeon Meshi', time: '21:30', score: '8.5', url: '/anime/dungeon-meshi/' }
      ],
      'JUM': [
        { title: 'Jujutsu Kaisen', time: '23:30', score: '8.8', url: '/anime/jujutsu-kaisen-2nd-season/' },
        { title: 'Gintama', time: '22:00', score: '8.98', url: '/anime/gintama/' }
      ],
      'SAB': [
        { title: 'Kaiju No. 8', time: '22:00', score: '8.5', url: '/anime/kaiju-no-8/' },
        { title: 'My Hero Academia', time: '16:30', score: '8.3', url: '/anime/boku-no-hero-academia-7th-season/' }
      ]
    };

    // 1. Fetch live ongoing anime from scraper
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
    await Promise.all(
      grouped.map(async (day) => {
        const dayShortId = day.day;
        const dayIdx = daysOrder.indexOf(dayShortId);
        const extraList = seasonalAnime[dayShortId] || [];

        for (const extra of extraList) {
          if (day.list.some(existing => existing.title.toLowerCase() === extra.title.toLowerCase())) {
            continue;
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

          const poster = await getAnimePoster(extra.title);

          day.list.push({
            id: extra.url || `extra-${extra.title.replace(/\s+/g, '-').toLowerCase()}`,
            title: extra.title,
            image: poster || '/placeholder.jpg',
            time: extra.time,
            episode: 'Ongoing',
            score: extra.score,
            status,
            airingAt: 0,
            day: dayShortId,
            url: extra.url
          });
        }
      })
    );

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
