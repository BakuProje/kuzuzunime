'use client';
import { useState, useEffect } from 'react';
import AnimeCard from '@/app/components/AnimeCard';
import Skeleton from '@/app/components/Skeleton';

const GENRE_KEYWORDS = {
    "Action": ["action", "shounen", "fight", "jujutsu", "kimetsu"],
    "Adventure": ["adventure", "journey", "world", "isekai"],
    "Comedy": ["comedy", "slice of life", "laugh", "bocchi"],
    "Drama": ["drama", "cry", "love", "romance", "kanojo"],
    "Fantasy": ["fantasy", "magic", "maou", "dragon", "hero"],
    "Isekai": ["isekai", "reincarnation", "world", "slime", "tensei"],
    "Magic": ["magic", "mahou", "witch", "wizard"],
    "Romance": ["romance", "love", "kanojo", "couple"],
    "School": ["school", "gakuen", "classroom", "student"],
    "Sci-Fi": ["sci-fi", "science", "gundam", "mecha"],
    "Slice of Life": ["slice of life", "daily", "chill", "camp"],
    "Sports": ["sports", "soccer", "football", "blue lock", "haikyuu"]
};

const CATEGORIES = Object.keys(GENRE_KEYWORDS);

export default function CategoriesPage() {
  const [selected, setSelected] = useState(CATEGORIES[0]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const queries = GENRE_KEYWORDS[selected] || [selected];
        const promises = queries.map(q => fetch(`/api/search?q=${encodeURIComponent(q)}`).then(res => res.json()).catch(() => ({ data: [] })));
        const searchResults = await Promise.all(promises);
        
        let combined = [];
        searchResults.forEach(res => {
          if (res.success && Array.isArray(res.data)) {
            combined = [...combined, ...res.data];
          }
        });

        // Remove duplicates by URL
        const unique = [ ...new Map(combined.map(item => [item.url, item])).values() ];
        setResults(unique);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selected]);

  return (
    <div className="section-container page-transition" style={{ paddingBottom: '100px' }}>
      <div id="genre-grid" className="genre-grid">
        {CATEGORIES.map((cat, idx) => (
          <button 
            key={idx} 
            className={`genre-btn ${selected === cat ? 'active' : ''}`}
            onClick={() => setSelected(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div id="category-results-container">
        <div className="section-header mt-large">
          <div className="bar-accent"></div>
          <h2>Anime {selected}</h2>
        </div>
        
        {loading ? (
          <div className="anime-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="scroll-card">
                 <Skeleton className="scroll-card-img" style={{ height: '220px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="anime-grid">
            {results.map((anime, idx) => (
              <AnimeCard key={idx} anime={anime} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
