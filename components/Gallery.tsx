'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Photo } from '@/lib/content';

/** Galería deslizable con el dedo; al tocar una foto se abre ampliada. */
export default function Gallery({ items }: { items: { photo: Photo; caption: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % items.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, items.length]);

  return (
    <>
      <ul className="gallery" aria-label="Fotografías de las cartas">
        {items.map((it, i) => (
          <li key={it.photo.src}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Ampliar: ${it.caption}`}>
              <Image src={it.photo.src} alt={it.photo.alt} width={it.photo.w} height={it.photo.h}
                sizes="(max-width: 700px) 78vw, 360px" />
            </button>
            <span className="gallery-caption">{it.caption}</span>
          </li>
        ))}
      </ul>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={items[open].caption} onClick={() => setOpen(null)}>
          <Image src={items[open].photo.src} alt={items[open].photo.alt} width={items[open].photo.w}
            height={items[open].photo.h} sizes="100vw" quality={90} />
          <button type="button" className="lightbox-close" aria-label="Cerrar">×</button>
        </div>
      )}
    </>
  );
}
