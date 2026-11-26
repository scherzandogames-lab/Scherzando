import table from './cp-provincias.json';
import { PROVINCES } from './micorreo';

/**
 * Provincia(s) de un código postal argentino.
 * Fuentes: código CPA con letra (la letra identifica la provincia) y, para los códigos de 4 cifras,
 * la base pública de GeoNames (https://www.geonames.org, licencia CC BY 4.0).
 * Capital Federal usa los códigos 1000 a 1499.
 * Devuelve los nombres de provincia posibles (uno, varios si el código es compartido, o ninguno si no figura).
 */
const CP = table as Record<string, string>;
const byCode = new Map(PROVINCES.map((p) => [p.code, p.name]));

export function provincesForZip(zip: string): string[] {
  const z = zip.toUpperCase().replace(/\s/g, '');
  const m = z.match(/^([A-Z])?(\d{4})[A-Z]{0,3}$/);
  if (!m) return [];
  const [, letter, digits] = m;
  if (letter && byCode.has(letter)) return [byCode.get(letter)!];
  const n = Number(digits);
  if (n >= 1000 && n <= 1499) return [byCode.get('C')!];
  const codes = CP[digits];
  return codes ? [...codes].map((c) => byCode.get(c)).filter((x): x is string => !!x) : [];
}
