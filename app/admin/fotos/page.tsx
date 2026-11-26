import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getContent } from '@/lib/settings';
import { PHOTOS } from '@/lib/content';
import AdminNav from '@/components/admin/AdminNav';
import PhotoUpload from '@/components/admin/PhotoUpload';
import { savePhotos } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fotos · SCHERZANDO', robots: { index: false } };

export default async function Fotos({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (!(await isAdmin())) redirect('/admin');
  const { ok } = await searchParams;
  const c = await getContent();
  // Todas las fotos disponibles: originales del sitio + las que están en la galería (incluidas las subidas).
  const all = [...new Set([...Object.values(PHOTOS).map((p) => p.src), ...c.photos.gallery.map((g) => g.src), c.photos.hero, c.photos.box])];
  const inGallery = new Map(c.photos.gallery.map((g) => [g.src, g]));
  const rows = [...c.photos.gallery.map((g) => g.src), ...all.filter((s) => !inGallery.has(s))].slice(0, 16);

  return (
    <main className="adm">
      <AdminNav on="fotos" />
      <div className="adm-wrap">
        <h1>Fotos</h1>
        {ok && <p className="okmsg">Cambios guardados y publicados.</p>}
        <h2>Subir una foto nueva</h2>
        <PhotoUpload />

        <form action={savePhotos} className="adm-form">
          <h2>Portada y caja</h2>
          <div className="adm-grid">
            <label className="f">Foto de la portada
              <select name="hero" defaultValue={c.photos.hero}>{all.map((s) => <option key={s} value={s}>{s.split('/').pop()}</option>)}</select>
            </label>
            <label className="f">Foto principal de la caja
              <select name="box" defaultValue={c.photos.box}>{all.map((s) => <option key={s} value={s}>{s.split('/').pop()}</option>)}</select>
            </label>
          </div>

          <h2>Galería de las cartas</h2>
          <p className="muted">Marcá las fotos que se muestran, en este orden. El texto corto aparece debajo de cada foto.</p>
          <div className="adm-photos">
            {rows.map((src, i) => {
              const g = inGallery.get(src);
              return (
                <div className="adm-photo" key={src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" />
                  <input type="hidden" name={`g_${i}_src`} value={src} />
                  <label className="chk"><input type="checkbox" name={`g_${i}_on`} defaultChecked={!!g} /> Mostrar</label>
                  <input name={`g_${i}_caption`} defaultValue={g?.caption ?? ''} placeholder="Texto corto" aria-label="Texto corto" />
                  <input name={`g_${i}_alt`} defaultValue={g?.alt ?? Object.values(PHOTOS).find((p) => p.src === src)?.alt ?? ''} placeholder="Descripción para accesibilidad" aria-label="Descripción" />
                </div>
              );
            })}
          </div>
          <div className="adm-save"><button className="btn btn-gold" type="submit">Guardar y publicar</button></div>
        </form>
      </div>
    </main>
  );
}
