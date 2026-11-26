import 'server-only';
import { env } from './env';

/**
 * Cliente de la API MiCorreo de Correo Argentino (documentación oficial «API MiCorreo»).
 *   POST /token            → JWT (autenticación HTTP Basic con las credenciales que entrega Correo)
 *   POST /rates            → cotización a domicilio (D) y a sucursal (S)
 *   GET  /agencies         → sucursales de una provincia
 *   POST /shipping/import  → carga un envío en la cuenta de MiCorreo
 * Mientras falten MICORREO_USER, MICORREO_PASSWORD y MICORREO_CUSTOMER_ID, el módulo queda
 * inactivo y la tienda usa la tabla de tarifas cargada en el panel. Nunca se simulan respuestas.
 */

const BASE = () =>
  env.micorreo().prod ? 'https://api.correoargentino.com.ar/micorreo/v1' : 'https://apitest.correoargentino.com.ar/micorreo/v1';

export function micorreoEnabled() {
  const c = env.micorreo();
  return !!(c.user && c.password && c.customerId);
}

let tokenCache: { token: string; exp: number; base: string } | null = null;

async function token(): Promise<string> {
  const c = env.micorreo();
  const base = BASE();
  if (tokenCache && tokenCache.base === base && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const r = await fetch(`${base}/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${c.user}:${c.password}`).toString('base64') },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`MiCorreo /token ${r.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text) as { token: string; expires?: string };
  // «expires» llega como hora local de Argentina ("2022-04-26 21:16:20"); ante la duda, 50 minutos.
  const exp = j.expires ? Date.parse(j.expires.replace(' ', 'T') + '-03:00') : NaN;
  tokenCache = { token: j.token, exp: Number.isFinite(exp) ? exp : Date.now() + 50 * 60_000, base };
  return j.token;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(BASE() + path, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`MiCorreo ${path} ${r.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export type Rate = { deliveredType: 'D' | 'S'; productType: string; productName: string; price: number };

export async function quote(opts: {
  originZip: string;
  destZip: string;
  weightG: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}): Promise<{ validTo: string; rates: Rate[] }> {
  return call('/rates', {
    method: 'POST',
    body: JSON.stringify({
      customerId: env.micorreo().customerId,
      postalCodeOrigin: opts.originZip,
      postalCodeDestination: opts.destZip,
      dimensions: { weight: opts.weightG, height: opts.heightCm, width: opts.widthCm, length: opts.lengthCm },
    }),
  });
}

export type Agency = {
  code: string;
  name: string;
  location: { address: { streetName: string; streetNumber: string; city: string; locality?: string; province: string; postalCode: string } };
  services?: { packageReception?: boolean; pickupAvailability?: boolean };
  status?: string;
};

/** Sucursales de una provincia habilitadas para que el destinatario retire. */
export async function agencies(provinceCode: string): Promise<Agency[]> {
  const q = new URLSearchParams({ customerId: env.micorreo().customerId, provinceCode, services: 'pickup_availability' });
  const list = await call<Agency[]>(`/agencies?${q}`);
  return list.filter((a) => (a.status ?? 'ACTIVE') === 'ACTIVE');
}

/** Carga el envío de un pedido pagado en la cuenta de MiCorreo (después se paga y se imprime el rótulo allí). */
export async function importShipment(o: {
  orderId: string;
  orderNumber: string;
  recipient: { name: string; email: string; phone: string };
  deliveryType: 'D' | 'S';
  agency?: string | null;
  address: { streetName: string; streetNumber: string; floor?: string; apartment?: string; city: string; provinceCode: string; postalCode: string };
  weightG: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  declaredValue: number;
}) {
  return call<{ createdAt: string }>('/shipping/import', {
    method: 'POST',
    body: JSON.stringify({
      customerId: env.micorreo().customerId,
      extOrderId: o.orderId,
      orderNumber: o.orderNumber,
      recipient: { name: o.recipient.name, email: o.recipient.email, phone: o.recipient.phone, cellPhone: o.recipient.phone },
      shipping: {
        deliveryType: o.deliveryType,
        agency: o.deliveryType === 'S' ? o.agency : null,
        address: o.address,
        weight: o.weightG,
        declaredValue: o.declaredValue,
        height: o.heightCm,
        length: o.lengthCm,
        width: o.widthCm,
      },
    }),
  });
}

/** Códigos de provincia de la API MiCorreo. */
export const PROVINCES: { code: string; name: string }[] = [
  { code: 'C', name: 'Ciudad Autónoma de Buenos Aires' },
  { code: 'B', name: 'Buenos Aires' },
  { code: 'K', name: 'Catamarca' },
  { code: 'H', name: 'Chaco' },
  { code: 'U', name: 'Chubut' },
  { code: 'X', name: 'Córdoba' },
  { code: 'W', name: 'Corrientes' },
  { code: 'E', name: 'Entre Ríos' },
  { code: 'P', name: 'Formosa' },
  { code: 'Y', name: 'Jujuy' },
  { code: 'L', name: 'La Pampa' },
  { code: 'F', name: 'La Rioja' },
  { code: 'M', name: 'Mendoza' },
  { code: 'N', name: 'Misiones' },
  { code: 'Q', name: 'Neuquén' },
  { code: 'R', name: 'Río Negro' },
  { code: 'A', name: 'Salta' },
  { code: 'J', name: 'San Juan' },
  { code: 'D', name: 'San Luis' },
  { code: 'Z', name: 'Santa Cruz' },
  { code: 'S', name: 'Santa Fe' },
  { code: 'G', name: 'Santiago del Estero' },
  { code: 'V', name: 'Tierra del Fuego' },
  { code: 'T', name: 'Tucumán' },
];
