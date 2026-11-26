import 'server-only';
import { db, hasDb } from './supabase';

/** Registro de errores y eventos: queda en Supabase (event_log) y en los registros de Netlify. */
export async function logEvent(level: 'info' | 'aviso' | 'error', source: string, message: string, orderId?: string | null) {
  const line = `[${source}] ${message}`;
  if (level === 'error') console.error(line);
  else console.log(line);
  if (!hasDb()) return;
  try {
    await db().from('event_log').insert({ level, source, message: message.slice(0, 2000), order_id: orderId ?? null });
  } catch {}
}
