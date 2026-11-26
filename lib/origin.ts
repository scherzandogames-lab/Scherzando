import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';

/**
 * Dirección pública del sitio para armar retornos y avisos de pago.
 * Usa SITE_URL si está configurada. Si no (por ejemplo en la versión de prueba de una rama),
 * toma el dominio de la solicitud, pero sólo si es un dominio de Netlify o local:
 * así nunca se arma un retorno hacia un dominio ajeno.
 */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL?.trim()) return env.siteUrl();
  try {
    const h = await headers();
    const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim().toLowerCase();
    if (/^[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$/.test(host)) return `https://${host}`;
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  } catch {}
  return env.siteUrl();
}
