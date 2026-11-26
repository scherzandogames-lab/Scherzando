import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { isAdmin } from '@/lib/auth';
import { db, BUCKET_PUBLIC } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** URL firmada para que el panel suba una foto directo a Supabase (sólo administradores). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { contentType } = await req.json().catch(() => ({}));
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return NextResponse.json({ error: 'Formato no admitido' }, { status: 400 });
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const path = `fotos/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET_PUBLIC).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 });
  const publicUrl = db().storage.from(BUCKET_PUBLIC).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ signedUrl: data.signedUrl, path, publicUrl });
}
