import 'server-only';
import { connection } from 'next/server';
import { db, hasDb } from './supabase';
import { mergeContent, SiteContent } from './content';

/** Contenido vigente: lo guardado en el panel, o los valores iniciales si la base todavía no está conectada. */
export async function getContent(): Promise<SiteContent> {
  if (!hasDb()) return mergeContent(null);
  // Se lee en cada visita: así los cambios del panel se ven al instante.
  await connection();
  const { data, error } = await db().from('settings').select('content').eq('id', 1).maybeSingle();
  if (error) {
    console.error('[settings] error al leer', error.message);
    return mergeContent(null);
  }
  return mergeContent(data?.content as Partial<SiteContent>);
}

export async function saveContent(content: SiteContent) {
  const { error } = await db().from('settings').upsert({ id: 1, content, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
