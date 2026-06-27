'use client';

export default function VideoPlayer({ src }) {
  if (!src) {
    return (
      <div className="premium-player-container">
        <div className="video-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          Memuat pemutar video...
        </div>
      </div>
    );
  }

  return (
    <div className="premium-player-container">
        <div className="video-wrapper">
            <iframe id="video-player" src={src} allowFullScreen></iframe>
        </div>
    </div>
  );
}
