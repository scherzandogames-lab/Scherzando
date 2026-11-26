import type { Metadata, Viewport } from 'next';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './globals.css';
import { getContent } from '@/lib/settings';
import { siteOrigin } from '@/lib/origin';
import MetaPixel from '@/components/MetaPixel';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent();
  const site = await siteOrigin();
  return {
    metadataBase: new URL(site),
    title: c.seo.title,
    description: c.seo.description,
    alternates: { canonical: '/' },
    icons: { icon: '/marca/icono-48.png', apple: '/apple-touch-icon.png' },
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: c.brand.name,
      title: c.seo.title,
      description: c.seo.description,
      url: site,
      images: [{ url: '/marca/compartir.jpg', width: 1200, height: 630, alt: 'Caja de SCHERZANDO.AR con cartas de clarinetes' }],
    },
    twitter: { card: 'summary_large_image', title: c.seo.title, description: c.seo.description, images: ['/marca/compartir.jpg'] },
  };
}

export const viewport: Viewport = { themeColor: '#610b0c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        <MetaPixel id={process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''} />
      </body>
    </html>
  );
}
