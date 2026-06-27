import { NextResponse } from 'next/server';

// Simple in-memory server-side cache persisting across dev hot reloads
if (!global._scheduleCache) {
  global._scheduleCache = { data: null, timestamp: 0 };
}
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET() {
  if (global._scheduleCache.data && (Date.now() - global._scheduleCache.timestamp < CACHE_TTL)) {
    console.log('[SERVER CACHE HIT] Serving schedule from server cache');
    return NextResponse.json({ success: true, data: global._scheduleCache.data });
  }

  try {
    const dayMapping = {
      'sunday': 'MIN', 'monday': 'SEN', 'tuesday': 'SEL', 'wednesday': 'RAB', 
      'thursday': 'KAM', 'friday': 'JUM', 'saturday': 'SAB'
    };

    const daysOrder = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
    const grouped = daysOrder.map(d => ({ day: d, list: [] }));

    // Get current time in WIB (Asia/Jakarta)
    const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const todayIndex = nowWib.getDay(); // 0 (Sunday) to 6 (Saturday)
    const currentHour = nowWib.getHours();
    const currentMinute = nowWib.getMinutes();

    const dayToIndex = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };

    // Predefined popular ongoing seasonal anime to enrich the schedule
    const seasonalAnime = {
      'MIN': [
        { title: 'One Piece', time: '09:30', image: 'https://cdn.myanimelist.net/images/anime/1244/138851.jpg', score: '8.9' },
        { title: 'Demon Slayer: Hashira Training Arc', time: '23:15', image: 'https://cdn.myanimelist.net/images/anime/1565/142711.jpg', score: '9.0' },
        { title: 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2', time: '22:00', image: 'https://cdn.myanimelist.net/images/anime/1876/141251.jpg', score: '8.8' }
      ],
      'SEN': [
        { title: 'Tsukimichi -Moonlit Fantasy- Season 2', time: '22:00', image: 'https://cdn.myanimelist.net/images/anime/1794/142621.jpg', score: '8.1' },
        { title: 'Spice and Wolf: Merchant Meets the Wise Wolf', time: '23:30', image: 'https://cdn.myanimelist.net/images/anime/1059/142414.jpg', score: '8.3' },
        { title: 'Re:Monster', time: '23:00', image: 'https://cdn.myanimelist.net/images/anime/1850/136656.jpg', score: '7.5' }
      ],
      'SEL': [
        { title: 'Tensei Kizoku, Kantei Skill de Nariagaru', time: '23:30', image: 'https://cdn.myanimelist.net/images/anime/1763/139538.jpg', score: '7.7' },
        { title: 'Black Clover', time: '18:00', image: 'https://cdn.myanimelist.net/images/anime/2/88336.jpg', score: '8.3' }
      ],
      'RAB': [
        { title: "KonoSuba: God's Blessing on this Wonderful World! 3", time: '22:00', image: 'https://cdn.myanimelist.net/images/anime/1758/141268.jpg', score: '8.7' },
        { title: "Jellyfish Can't Swim in the Night", time: '23:00', image: 'https://cdn.myanimelist.net/images/anime/1834/141827.jpg', score: '8.2' },
        { title: "Bartender: Glass of God", time: '22:30', image: 'https://cdn.myanimelist.net/images/anime/1644/142052.jpg', score: '7.6' }
      ],
      'KAM': [
        { title: 'Wind Breaker', time: '23:00', image: 'https://cdn.myanimelist.net/images/anime/1907/135919.jpg', score: '8.4' },
        { title: 'Dungeon Meshi', time: '21:30', image: 'https://cdn.myanimelist.net/images/anime/1711/142478.jpg', score: '8.5' },
        { title: 'Laid-Back Camp Season 3', time: '22:30', image: 'https://cdn.myanimelist.net/images/anime/1178/142710.jpg', score: '8.6' }
      ],
      'JUM': [
        { title: "Chillin' in Another World with Level 2 Super Cheat Powers", time: '22:00', image: 'https://cdn.myanimelist.net/images/anime/1103/142513.jpg', score: '7.9' },
        { title: 'The Irregular at Magic High School Season 3', time: '23:30', image: 'https://cdn.myanimelist.net/images/anime/1100/142255.jpg', score: '7.8' }
      ],
      'SAB': [
        { title: 'Kaiju No. 8', time: '22:00', image: 'https://cdn.myanimelist.net/images/anime/1370/140362.jpg', score: '8.5' },
        { title: 'My Hero Academia Season 7', time: '16:30', image: 'https://cdn.myanimelist.net/images/anime/1573/157212.jpg', score: '8.3' },
        { title: 'Tensei shitara Slime Datta Ken Season 3', time: '23:00', image: 'https://cdn.myanimelist.net/images/anime/1211/143476.jpg', score: '8.4' }
      ]
    };

    let samehadakuResult = {};
    try {
      const response = await fetch('https://puruboy-api.vercel.app/api/anime/samehadaku/schedule', {
        next: { revalidate: 3600 }
      });
      if (response.ok) {
        const json = await response.json();
        if (json && json.success && json.result) {
          samehadakuResult = json.result;
        }
      }
    } catch (e) {
      console.error('Samehadaku fetch failed, using fallback seasonal list:', e);
    }

    // 1. Process Samehadaku results if available
    Object.keys(samehadakuResult).forEach(key => {
      const dayShortId = dayMapping[key.toLowerCase()];
      if (!dayShortId) return;

      const dayIdx = daysOrder.indexOf(dayShortId);
      const dayWeekIndex = dayToIndex[key.toLowerCase()];

      const list = samehadakuResult[key] || [];
      list.forEach(item => {
        let status = 'Akan Tayang';
        if (dayWeekIndex < todayIndex) {
          status = 'Sudah Tayang';
        } else if (dayWeekIndex === todayIndex) {
          if (item.time) {
            const [hour, minute] = item.time.split(':').map(Number);
            if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
              status = 'Sudah Tayang';
            }
          }
        }

        const relativeUrl = item.original_url ? item.original_url.replace(/^https?:\/\/[^\/]+/, '') : '';

        const entry = {
          id: relativeUrl || item.title,
          title: item.title,
          image: item.thumbnail,
          time: item.time || '00:00',
          episode: 'Ongoing',
          score: item.score ? parseFloat(item.score).toFixed(1) : '8.5',
          status,
          airingAt: 0,
          day: dayShortId
        };

        if (dayIdx !== -1) {
          grouped[dayIdx].list.push(entry);
        }
      });
    });

    // 2. Enrich with our premium seasonal ongoing anime
    grouped.forEach(day => {
      const dayShortId = day.day;
      const dayIdx = daysOrder.indexOf(dayShortId);
      
      const extraList = seasonalAnime[dayShortId] || [];
      extraList.forEach(extra => {
        // Avoid duplicates (checking by lowercase title)
        if (day.list.some(existing => existing.title.toLowerCase() === extra.title.toLowerCase())) {
          return;
        }

        // Determine status dynamically
        let status = 'Akan Tayang';
        const dayWeekIndex = daysOrder.indexOf(dayShortId);
        
        if (dayWeekIndex < todayIndex) {
          status = 'Sudah Tayang';
        } else if (dayWeekIndex === todayIndex) {
          if (extra.time) {
            const [hour, minute] = extra.time.split(':').map(Number);
            if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
              status = 'Sudah Tayang';
            }
          }
        }

        day.list.push({
          id: `extra-${extra.title.replace(/\s+/g, '-').toLowerCase()}`,
          title: extra.title,
          image: extra.image,
          time: extra.time,
          episode: 'Ongoing',
          score: extra.score,
          status,
          airingAt: 0,
          day: dayShortId
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
