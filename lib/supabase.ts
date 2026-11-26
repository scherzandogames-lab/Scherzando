import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

/** Cliente con privilegios de servidor. Nunca se expone al navegador. */
export function db(): SupabaseClient {
  if (!env.supabaseUrl() || !env.supabaseKey()) {
    throw new Error('Supabase no está configurado (SUPABASE_URL / SUPABASE_SECRET_KEY).');
  }
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      // Cada consulta va siempre a la base. Sin esto, dentro de una misma página
      // Next.js reutiliza la primera respuesta y se muestran estados viejos
      // (por ejemplo, un pago recién confirmado aparecería como pendiente).
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store', signal: init?.signal ?? new AbortController().signal }),
      },
    });
  }
  return client;
}

export function hasDb() {
  return !!(env.supabaseUrl() && env.supabaseKey());
}

export const BUCKET_PUBLIC = 'publico';
