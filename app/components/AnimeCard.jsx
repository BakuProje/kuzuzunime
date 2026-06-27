import Link from 'next/link';

export default function AnimeCard({ anime }) {
  const { title, image, episode, rating, url, score } = anime;
  const cleanScore = (val) => (val && val !== 'N/A') ? val : null;
  const displayRating = cleanScore(rating) || cleanScore(score) || '8.5';
  
  let badgeContent = '';
  let hasEpisode = false;
  
  const rawEp = episode || anime.status || anime.type;
  if (rawEp) {
    const cleanEp = rawEp.toString().replace(/Episode|Eps|Ep/gi, '').trim();
    if (/^\d+(\.\d+)?$/.test(cleanEp)) {
      badgeContent = `Eps ${cleanEp}`;
      hasEpisode = true;
    } else {
      const lower = cleanEp.toLowerCase();
      if (lower === 'completed' || lower === 'finished' || lower === 'tamat') {
        badgeContent = 'Tamat';
        hasEpisode = true;
      } else if (lower === 'ongoing' || lower === 'releasing') {
        badgeContent = 'Ongoing';
        hasEpisode = true;
      }
    }
  }

  if (!hasEpisode) {
    badgeContent = displayRating;
  }

  return (
    <Link href={`/anime/${encodeURIComponent(url)}`}>
      <div className="scroll-card">
          <div className="scroll-card-img">
              <img src={image} loading="lazy" alt={title} />
              <div className="ep-badge">
                {!hasEpisode && <span style={{ color: '#ffcc00' }}>⭐ </span>}
                {badgeContent}
              </div>
          </div>
          <div className="scroll-card-title">{title}</div>
      </div>
    </Link>
  );
}
