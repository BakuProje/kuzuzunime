import './globals.css';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import ScrollAnimations from './components/ScrollAnimations';
import LayoutWrapper from './components/LayoutWrapper';
import { PlayerProvider } from './components/PlayerContext';
import GlobalPlayer from './components/GlobalPlayer';
import PresenceTracker from './components/PresenceTracker';
import SmoothScroll from './components/SmoothScroll';

export const metadata = {
  metadataBase: new URL('https://zunime.vercel.app'),
  title: 'Zunime',
  description: 'Streaming anime subtitle indonesia gratis kualitas premium tanpa iklan mengganggu. Download anime terbaru setiap hari.',
  manifest: '/manifest.json',
  icons: {
    icon: '/Zunime.png',
    shortcut: '/Zunime.png',
    apple: '/Zunime.png',
  },
  openGraph: {
    title: 'Zunime',
    description: 'Streaming anime subtitle indonesia gratis kualitas premium tanpa iklan mengganggu. Download anime terbaru setiap hari.',
    url: 'https://zunime.vercel.app',
    siteName: 'Zunime',
    images: [
      {
        url: '/Zunimebanner.png',
        width: 1200,
        height: 630,
        alt: 'Zunime - Streaming Anime Gratis',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zunime - Nonton Anime Gratis Subtitle Indonesia',
    description: 'Streaming anime subtitle indonesia gratis kualitas premium tanpa iklan mengganggu. Download anime terbaru setiap hari.',
    images: ['/Zunimebanner.png'],
  },
  appleWebApp: {
    title: 'Zunime',
    statusBarStyle: 'default',
  }
};

export const viewport = {
  themeColor: '#050505',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning={true}>
      <head suppressHydrationWarning={true}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const removeBisSkinChecked = (node) => {
                  if (node.nodeType === 1) {
                    if (node.hasAttribute('bis_skin_checked')) {
                      node.removeAttribute('bis_skin_checked');
                    }
                    const kids = node.getElementsByTagName('*');
                    for (let i = 0; i < kids.length; i++) {
                      if (kids[i].hasAttribute('bis_skin_checked')) {
                        kids[i].removeAttribute('bis_skin_checked');
                      }
                    }
                  }
                };
                const observer = new MutationObserver((mutations) => {
                  for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    if (mutation.type === 'attributes' && mutation.attributeName === 'bis_skin_checked') {
                      mutation.target.removeAttribute('bis_skin_checked');
                    } else if (mutation.type === 'childList') {
                      for (let j = 0; j < mutation.addedNodes.length; j++) {
                        removeBisSkinChecked(mutation.addedNodes[j]);
                      }
                    }
                  }
                });
                observer.observe(document.documentElement, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  attributeFilter: ['bis_skin_checked']
                });
              })();
            `
          }}
        />
      </head>
      <body suppressHydrationWarning={true}>
        <PlayerProvider>
          <SmoothScroll>
            <div className="simulator-pre-loader simulator" aria-label="Loading" role="status" style={{ display: 'none' }} suppressHydrationWarning={true}></div>
            <div id="__next_zunime">
              <Navbar />
              <LayoutWrapper>
                <ScrollAnimations />
                {children}
              </LayoutWrapper>
              <BottomNav />
              <GlobalPlayer />
              <PresenceTracker />
              <div id="toast-container"></div>
              <div id="loading" className="hidden">
                <div className="spinner"></div>
                <p>ZUNIME</p>
              </div>
            </div>
          </SmoothScroll>
        </PlayerProvider>
      </body>
    </html>
  );
}

