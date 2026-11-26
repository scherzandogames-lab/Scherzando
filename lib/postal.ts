import table from './cp-provincias.json';
import localities from './cp-localidades.json';
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


const LOC = localities as unknown as Record<string, [string, string][]>;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Ciudades principales (capitales y ciudades grandes), con su nombre bien escrito. */
const MAJOR = [
  'Ciudad Autónoma de Buenos Aires', 'La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil', 'Olavarría', 'Azul', 'Necochea',
  'Pergamino', 'Junín', 'San Nicolás de los Arroyos', 'Zárate', 'Campana', 'Luján', 'Pilar', 'Quilmes', 'Lanús', 'Lomas de Zamora',
  'Banfield', 'Avellaneda', 'Morón', 'Ramos Mejía', 'San Isidro', 'Tigre', 'Monte Grande', 'San Justo', 'Merlo', 'Moreno',
  'Córdoba', 'Río Cuarto', 'Villa María', 'San Francisco', 'Villa Carlos Paz', 'Rosario', 'Santa Fe', 'Rafaela', 'Venado Tuerto',
  'Reconquista', 'Mendoza', 'San Rafael', 'San Miguel de Tucumán', 'Salta', 'San Salvador de Jujuy', 'Neuquén', 'Cipolletti',
  'Paraná', 'Concordia', 'Gualeguaychú', 'Resistencia', 'Corrientes', 'Posadas', 'Oberá', 'Formosa', 'Santiago del Estero',
  'La Banda', 'San Fernando del Valle de Catamarca', 'La Rioja', 'San Juan', 'San Luis', 'Villa Mercedes', 'Santa Rosa',
  'General Pico', 'Viedma', 'San Carlos de Bariloche', 'General Roca', 'Rawson', 'Trelew', 'Puerto Madryn', 'Comodoro Rivadavia',
  'Esquel', 'Río Gallegos', 'Caleta Olivia', 'Ushuaia', 'Río Grande',
];
const MAJOR_BY_NORM = new Map(MAJOR.map((n) => [norm(n), n]));

/**
 * Localidades de un código postal en una provincia.
 * main: la que se completa sola (si hay una sola, o si una es ciudad principal); options: todas, para elegir.
 */
export function localitiesForZip(zip: string, province: string): { main: string | null; options: string[] } {
  const m = zip.toUpperCase().replace(/\s/g, '').match(/^[A-Z]?(\d{4})[A-Z]{0,3}$/);
  if (!m) return { main: null, options: [] };
  const n = Number(m[1]);
  if (n >= 1000 && n <= 1499) return { main: 'Ciudad Autónoma de Buenos Aires', options: ['Ciudad Autónoma de Buenos Aires'] };
  const code = PROVINCES.find((p) => p.name === province)?.code;
  const list = (LOC[m[1]] ?? []).filter(([, c]) => !code || c === code).map(([name]) => MAJOR_BY_NORM.get(norm(name)) ?? name);
  const options = [...new Set(list)];
  const major = options.find((o) => MAJOR_BY_NORM.has(norm(o)));
  return { main: options.length === 1 ? options[0] : major ?? null, options };
}
