import 'server-only';
import coords from './cp-coords.json';
import listado from './sucursales.json';
import { accent } from './postal';
import { db, hasDb } from './supabase';
import { agencies as fetchAgencies, micorreoEnabled, PROVINCES } from './micorreo';
import { logEvent } from './log';

/**
 * Sucursales de Correo Argentino para el checkout.
 * Única fuente: la API oficial MiCorreo (/agencies). Se guarda una copia por provincia en la tabla
 * `agencies` y se renueva cada 24 horas. Nunca se muestran sucursales que no vengan de esa API.
 */

export type Branch = {
  code: string; // código oficial de la sucursal
  name: string;
  street: string;
  locality: string;
  postalCode: string;
  hours: string[]; // líneas legibles, p. ej. «Lunes a viernes de 9:30 a 18:00»
  distanceKm: number | null;
  approx?: boolean; // true si la ubicación es la de la localidad, no la dirección exacta
};

type Row = {
  code: string; province_code: string; name: string; street: string | null; locality: string | null; city: string | null;
  postal_code: string | null; lat: number | null; lng: number | null; hours: Record<string, { start: string; end: string } | null> | null;
  pickup: boolean; synced_at: string;
};

const DAY = 24 * 3600_000;
const COORDS = coords as unknown as Record<string, [number, number]>;
const CABA: [number, number] = [-34.6037, -58.3816];

/** Punto aproximado de un código postal (centro de sus localidades en GeoNames). */
export function zipPoint(zip: string): [number, number] | null {
  const m = zip.toUpperCase().replace(/\s/g, '').match(/^[A-Z]?(\d{4})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 1000 && n <= 1499) return CABA;
  return COORDS[m[1]] ?? null;
}

function km(a: [number, number], b: [number, number]) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const hm = (s: string) => (/^\d{4}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2)}` : s);
const DAYS: [string, string][] = [['monday', 'Lunes'], ['tuesday', 'Martes'], ['wednesday', 'Miércoles'], ['thursday', 'Jueves'], ['friday', 'Viernes'], ['saturday', 'Sábado'], ['sunday', 'Domingo']];

/** Agrupa días consecutivos con el mismo horario: «Lunes a viernes de 9:30 a 18:00». */
export function hoursText(h: Row['hours']): string[] {
  if (!h) return [];
  const out: string[] = [];
  let i = 0;
  while (i < DAYS.length) {
    const cur = h[DAYS[i][0]];
    let j = i;
    while (j + 1 < DAYS.length && JSON.stringify(h[DAYS[j + 1][0]]) === JSON.stringify(cur)) j++;
    if (cur?.start && cur?.end) {
      const days = i === j ? DAYS[i][1] : `${DAYS[i][1]} a ${DAYS[j][1].toLowerCase()}`;
      out.push(`${days} de ${hm(cur.start)} a ${hm(cur.end)}`);
    }
    i = j + 1;
  }
  return out;
}

/** Trae las sucursales oficiales de una provincia (copia de hasta 24 h, o consulta a la API). */
async function provinceBranches(provinceCode: string): Promise<Row[]> {
  let rows: Row[] = [];
  if (hasDb()) {
    const { data } = await db().from('agencies').select('*').eq('province_code', provinceCode);
    rows = (data ?? []) as Row[];
    const fresh = rows.length > 0 && rows.every((r) => Date.now() - Date.parse(r.synced_at) < DAY);
    if (fresh) return rows;
  }
  try {
    const list = await fetchAgencies(provinceCode);
    const now = new Date().toISOString();
    const synced: Row[] = list
      .filter((a) => a.services?.pickupAvailability !== false)
      .map((a) => ({
        code: a.code,
        province_code: provinceCode,
        name: a.name,
        street: [a.location?.address?.streetName, a.location?.address?.streetNumber].filter(Boolean).join(' ') || null,
        locality: a.location?.address?.locality || null,
        city: a.location?.address?.city || null,
        postal_code: a.location?.address?.postalCode || null,
        lat: Number(a.location?.latitude) || null,
        lng: Number(a.location?.longitude) || null,
        hours: (a.hours as Row['hours']) ?? null,
        pickup: true,
        synced_at: now,
      }));
    if (hasDb()) {
      await db().from('agencies').delete().eq('province_code', provinceCode);
      if (synced.length) await db().from('agencies').insert(synced);
    }
    return synced;
  } catch (e) {
    await logEvent('aviso', 'micorreo', `No se pudo actualizar la lista de sucursales (${provinceCode}): ${(e as Error).message}`);
    return rows; // la última copia oficial guardada, si existe
  }
}

/**
 * Listado oficial de sucursales de Correo Argentino (archivo «Código de Sucursales y Provincias al 26-11-2026»,
 * entregado por el administrador). Ubicación de cada sucursal: servicio oficial Georef (datos.gob.ar);
 * q = 1 si se ubicó la dirección exacta, 0 si se usó el centro de la localidad.
 */
type ListEntry = { c: string; s: string; l: string; p: string; h: string[]; y?: number; x?: number; q?: 0 | 1 };
const LIST = listado as unknown as ListEntry[];
export const LIST_SOURCE = 'Listado oficial de sucursales de Correo Argentino al 26/11/2026';
const CABA_NAME = 'Ciudad Autónoma de Buenos Aires';
const GEOREF_PROV: Record<string, string> = {
  'Ciudad Autónoma de Buenos Aires': '02', 'Buenos Aires': '06', Catamarca: '10', Córdoba: '14', Corrientes: '18', Chaco: '22', Chubut: '26',
  'Entre Ríos': '30', Formosa: '34', Jujuy: '38', 'La Pampa': '42', 'La Rioja': '46', Mendoza: '50', Misiones: '54', Neuquén: '58',
  'Río Negro': '62', Salta: '66', 'San Juan': '70', 'San Luis': '74', 'Santa Cruz': '78', 'Santa Fe': '82', 'Santiago del Estero': '86',
  'Tierra del Fuego': '94', Tucumán: '90',
};

const fromList = (e: ListEntry, here: [number, number] | null): Branch & { match?: boolean } => ({
  code: e.c,
  name: e.s,
  street: e.s,
  locality: e.p === CABA_NAME ? 'Capital Federal' : accent(e.l),
  approx: e.q !== 1,
  postalCode: '',
  hours: e.h,
  distanceKm: here && e.y !== undefined && e.x !== undefined ? Math.round(km(here, [e.y, e.x]) * 10) / 10 : null,
});

/** Ubica una dirección o barrio escrito por el comprador (Georef). Devuelve null si no la encuentra. */
async function georefPoint(text: string, province: string): Promise<[number, number] | null> {
  const prov = GEOREF_PROV[province];
  if (!prov || !text.trim()) return null;
  try {
    const q = new URLSearchParams({ provincia: prov, max: '1', campos: 'ubicacion' });
    const hasNumber = /\d/.test(text);
    const url = hasNumber
      ? `https://apis.datos.gob.ar/georef/api/direcciones?${q}&direccion=${encodeURIComponent(text)}`
      : `https://apis.datos.gob.ar/georef/api/localidades?provincia=${prov}&max=1&campos=centroide&nombre=${encodeURIComponent(text)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const j = await r.json();
    const d = hasNumber ? j.direcciones?.[0]?.ubicacion : j.localidades?.[0]?.centroide;
    return d && d.lat !== null ? [d.lat, d.lon] : null;
  } catch {
    return null;
  }
}

/** Sucursales del listado oficial, cercanas al código postal o a la dirección/localidad buscada. */
async function branchesFromList(opts: { province: string; zip: string; locality?: string; limit?: number }) {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const want = (opts.locality ?? '').trim();
  const isCaba = opts.province === CABA_NAME;
  // Punto de referencia: la dirección/localidad escrita (si se ubica) o el código postal.
  const typed = want && !(isCaba && norm(want).includes('autonoma')) ? await georefPoint(want, opts.province) : null;
  const here = typed ?? zipPoint(opts.zip);
  const w = norm(want);
  const list = LIST.filter((e) => e.p === opts.province)
    .map((e) => ({ ...fromList(e, here), match: !!w && !isCaba && norm(e.l).includes(w) }))
    .sort((a, b) => Number(b.match) - Number(a.match) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || a.name.localeCompare(b.name, 'es'));
  const radius = isCaba ? 3 : 60;
  const near = list.filter((b) => b.match || (b.distanceKm !== null && b.distanceKm <= radius));
  const pick = near.length ? near : list.slice(0, 5);
  return pick.slice(0, opts.limit ?? 12).map(({ match, ...b }) => b);
}

/** Sucursales de la provincia, ordenadas por cercanía al código postal (y filtradas por localidad si se pide). */
export async function branchesNear(opts: { province: string; zip: string; locality?: string; limit?: number }): Promise<{ enabled: boolean; branches: Branch[] }> {
  if (!micorreoEnabled()) {
    if (!PROVINCES.some((p) => p.name === opts.province)) return { enabled: true, branches: [] };
    return { enabled: true, branches: await branchesFromList(opts) };
  }
  const prov = PROVINCES.find((p) => p.name === opts.province);
  if (!prov) return { enabled: true, branches: [] };
  const rows = await provinceBranches(prov.code);
  const here = zipPoint(opts.zip);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const want = opts.locality ? norm(opts.locality) : '';
  const list = rows
    .map((r) => ({
      code: r.code,
      name: r.name,
      street: r.street ?? '',
      locality: r.locality || r.city || '',
      postalCode: r.postal_code ?? '',
      hours: hoursText(r.hours),
      distanceKm: here && r.lat && r.lng ? Math.round(km(here, [r.lat, r.lng]) * 10) / 10 : null,
      match: want ? norm(`${r.locality ?? ''} ${r.city ?? ''} ${r.name}`).includes(want) : false,
    }))
    .sort((a, b) => Number(b.match) - Number(a.match) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || a.name.localeCompare(b.name, 'es'));
  // Cercanas: a menos de 60 km (o de la localidad buscada); si no hay ninguna, las 5 más próximas.
  const near = list.filter((b) => b.match || (b.distanceKm !== null && b.distanceKm <= 60));
  const pick = near.length ? near : list.slice(0, 5);
  return { enabled: true, branches: pick.slice(0, opts.limit ?? 12).map(({ match, ...b }) => b) };
}

/** Verifica que una sucursal exista en la lista oficial de la provincia (para validar el pedido). */
export async function verifiedBranch(province: string, code: string): Promise<Branch | null> {
  const prov = PROVINCES.find((p) => p.name === province);
  if (!prov || !code) return null;
  if (!micorreoEnabled()) {
    const e = LIST.find((x) => x.c === code && x.p === province);
    return e ? fromList(e, null) : null;
  }
  const rows = await provinceBranches(prov.code);
  const r = rows.find((x) => x.code === code);
  return r ? { code: r.code, name: r.name, street: r.street ?? '', locality: r.locality || r.city || '', postalCode: r.postal_code ?? '', hours: hoursText(r.hours), distanceKm: null } : null;
}
