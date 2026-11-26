import 'server-only';
import coords from './cp-coords.json';
import { db, hasDb } from './supabase';
import { agencies as fetchAgencies, micorreoEnabled, PROVINCES } from './micorreo';
import { logEvent } from './log';

/**
 * Sucursales de Correo Argentino para el checkout.
 * Única fuente: la API oficial MiCorreo (/agencies). Se guarda una copia por provincia en la tabla
 * `agencies` y se renueva cada 24 horas. Nunca se muestran sucursales que no vengan de esa API.
 */

export type Branch = {
  code: string;
  name: string;
  street: string;
  locality: string;
  postalCode: string;
  hours: string[]; // líneas legibles, p. ej. «Lunes a viernes de 9:30 a 18:00»
  distanceKm: number | null;
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

/** Sucursales de la provincia, ordenadas por cercanía al código postal (y filtradas por localidad si se pide). */
export async function branchesNear(opts: { province: string; zip: string; locality?: string; limit?: number }): Promise<{ enabled: boolean; branches: Branch[] }> {
  if (!micorreoEnabled()) return { enabled: false, branches: [] };
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
  const rows = await provinceBranches(prov.code);
  const r = rows.find((x) => x.code === code);
  return r ? { code: r.code, name: r.name, street: r.street ?? '', locality: r.locality || r.city || '', postalCode: r.postal_code ?? '', hours: hoursText(r.hours), distanceKm: null } : null;
}
