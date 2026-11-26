'use client';
import Script from 'next/script';

/** Meta Pixel: sólo se carga si NEXT_PUBLIC_META_PIXEL_ID está configurado en Netlify. */
export default function MetaPixel({ id }: { id: string }) {
  if (!/^\d{5,20}$/.test(id)) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`}
    </Script>
  );
}

/** Registra un evento de conversión si el pixel está activo (p. ej. 'InitiateCheckout'). */
export function track(event: string, data?: Record<string, unknown>) {
  const w = window as unknown as { fbq?: (...a: unknown[]) => void };
  w.fbq?.('track', event, data);
}
