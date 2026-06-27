const fs = require('fs');
const path = require('path');

const styleMain = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');
const styleAuth = fs.readFileSync(path.join(__dirname, '../public/style-auth-new.css'), 'utf8');

const animations = `
/* --- PERFORMANCE ANIMATIONS --- */
main { animation: pageTransition 0.25s ease-out forwards; will-change: transform, opacity; }
@keyframes pageTransition { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

button { transition: transform 0.15s ease-out !important; }
button:active { transform: scale(0.95) !important; }

/* Cards: scale 1.05 on hover, ease-out, will-change */
.scroll-card, .premium-ep-card, .hero-slide {
  transition: transform 0.2s ease-out;
  will-change: transform;
}
@media (hover: hover) {
  .scroll-card:hover, .hero-slide:hover { transform: scale(1.05); }
}
.scroll-card:active, .premium-ep-card:active, .hero-slide:active { transform: scale(0.98); }

/* Image Skeleton and Fade In */
.scroll-card-img, .hero-slide, .detail-poster {
  background: linear-gradient(90deg, #111 25%, #222 50%, #111 75%);
  background-size: 400% 100%;
  animation: skeletonLoading 1.5s infinite ease-in-out;
}
@keyframes skeletonLoading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
img {
  animation: imageFadeIn 0.3s ease-out forwards;
  opacity: 0;
}
@keyframes imageFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Scroll Animation Classes */
.fade-slide-up {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
  will-change: opacity, transform;
}
.fade-slide-up.visible {
  opacity: 1;
  transform: translateY(0);
}
`;

const combined = styleMain + '\n' + animations + '\n' + styleAuth;
fs.writeFileSync(path.join(__dirname, '../app/globals.css'), combined, 'utf8');
console.log('Successfully combined CSS files into globals.css');
