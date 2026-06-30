'use client';
import { useState, useEffect } from 'react';
import AnimeCard from '@/app/components/AnimeCard';
import Skeleton from '@/app/components/Skeleton';

const CATEGORIES = [
  'Action', 'Adventure', 'BDSM', 'Blowjob', 'Comedy', 'Cosplay Hentai', 'Creampie', 'Cheating', 
  'Demon', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gore', 'Harem', 'Hentai', 'Historical', 'Incest', 
  'Isekai', 'JAV', 'JAV Cosplay', 'Josei', 'Loli', 'Magic', 'Martial Arts', 'Masturbation', 'Mecha', 'Milf', 'Military', 
  'Music', 'Mystery', 'Netorare', 'Oppai', 'Psychological', 'Romance', 'School', 'School Girls', 
  'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Sports', 'Super Power', 'Supernatural', 
  'Suspense', 'Tentacles', 'Thriller', '3D Hentai', 'Uncensored', 'Yuri'
];

export default function CategoriesPage() {
  const [selected, setSelected] = useState(CATEGORIES[0]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const url = `/api/search?genre=${encodeURIComponent(selected)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const unique = json.data.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
          setResults(unique);
        } else {
          setResults([]);
        }
      } catch (e) {
        console.error(e);
        setResults([]);
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
