'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addUploadedPhoto } from '@/app/admin/actions';

/** Achica la foto a 2000 px de lado mayor (sin recortar ni retocar) para que la página cargue rápido. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.type === 'image/jpeg' && file.size < 1_500_000) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.9));
}

export default function PhotoUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const blob = await shrink(file);
      const r = await fetch('/api/admin/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: 'image/jpeg' }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo preparar la subida');
      const put = await fetch(j.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: blob });
      if (!put.ok) throw new Error(`Falló la subida (${put.status})`);
      const res = await addUploadedPhoto(j.publicUrl, caption || 'Foto');
      if ('error' in res && res.error) throw new Error(res.error);
      setMsg('Foto subida y agregada al final de la galería.');
      setFile(null);
      setCaption('');
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-upload">
      <label className="f">Elegí la foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="f">Texto corto debajo de la foto<input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ej. El reverso" maxLength={80} /></label>
      <button type="button" className="btn-sm primary" onClick={upload} disabled={!file || busy}>{busy ? 'Subiendo…' : 'Subir foto'}</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
