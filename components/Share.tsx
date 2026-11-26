'use client';
import { useState } from 'react';

/** Compartir: usa el menú nativo del celular (incluye Instagram y WhatsApp) o copia el enlace. */
export default function Share({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: 'SCHERZANDO.AR', text, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  return (
    <div className="share">
      <button type="button" className="link-btn" onClick={share}>{copied ? 'Enlace copiado' : 'Compartir'}</button>
      <a className="link-btn" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </div>
  );
}
