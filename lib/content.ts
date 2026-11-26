// Modelo del contenido editable de la tienda y sus valores iniciales.
// Todo se podrá reemplazar desde el panel (/admin).
// Regla: los datos del producto que todavía no fueron confirmados quedan VACÍOS (null o '').
// La página los muestra como «a confirmar»; nunca se inventan valores.

export type Photo = { src: string; alt: string; w: number; h: number };
export type Spec = { label: string; value: string };
export type Faq = { q: string; a: string };
export type ShippingOption = {
  id: string;
  zone: string; // nombre visible de la zona, p. ej. «CABA y Gran Buenos Aires»
  region: 'amba' | 'interior' | 'todo'; // qué códigos postales admite (se valida con el del comprador)
  modality: 'domicilio' | 'sucursal';
  price: number | null; // importe de Correo Argentino cargado por el administrador
};

/** Tarifa de envío de una provincia (null = todavía sin cargar). */
export type ProvinceRate = { province: string; domicilio: number | null; sucursal: number | null };

export type GalleryItem = { src: string; alt: string; caption: string };

/** Producto adicional cargado desde el panel (el mazo es el producto principal). */
export type ExtraProduct = {
  id: string; // se usa como código de inventario
  name: string;
  description: string;
  price: number | null;
  image: string;
  active: boolean;
  maxPerOrder: number;
};

/** Producto tal como lo usa la tienda (el mazo o uno adicional). */
export type Product = { id: string; name: string; unit: [string, string]; description: string; price: number | null; image: string; maxPerOrder: number };

export type SiteContent = {
  photos: { hero: string; box: string; gallery: GalleryItem[] };
  brand: { name: string; instagram: string };
  hero: { eyebrow: string; title: string; tagline: string; cta: string };
  taglineOptions: string[];
  universe: { title: string; paragraphs: string[] };
  cards: { title: string; intro: string; jokerTitle: string; jokerText: string; backsNote: string };
  box: { title: string; text: string };
  product: { title: string; description: string; rules: string; maker: string };
  specs: Spec[];
  sale: { price: number | null; maxPerOrder: number };
  extraProducts: ExtraProduct[];
  /** Datos para la transferencia bancaria. Los carga el administrador desde el panel. */
  payment: {
    holder: string; // titular de la cuenta
    bank: string;
    cbu: string; // CBU o CVU
    alias: string;
    cuit: string; // CUIT o CUIL del titular
    proofContact: string; // dónde mandar el comprobante (correo o WhatsApp)
    holdHours: number; // horas de reserva del stock mientras se espera la transferencia
  };
  shipping: {
    intro: string;
    quotedAt: string;
    options: ShippingOption[];
    /** Precio del envío para cada provincia, cargado por el administrador. */
    rates: ProvinceRate[];
    dispatchInfo: string;
    /** Datos del paquete y del origen, necesarios para cotizar con la API de MiCorreo. */
    pkg: { originZip: string; weightG: number | null; heightCm: number | null; widthCm: number | null; lengthCm: number | null };
  };
  faq: Faq[];
  closing: { title: string; text: string };
  seo: { title: string; description: string };
};

const P = (src: string, alt: string, w = 1200, h = 1600): Photo => ({ src, alt, w, h });

/** Fotografías reales del producto (public/fotos). */
export const PHOTOS = {
  heroBox: P('/fotos/caja-y-clarinetes.jpg', 'Caja de SCHERZANDO.AR con cartas de clarinetes abiertas en abanico sobre una partitura'),
  boxOpen: P('/fotos/caja-abierta-bufones.jpg', 'Caja abierta de SCHERZANDO.AR junto a dos cartas del bufón sobre una partitura'),
  fan: P('/fotos/clarinetes-abanico.jpg', 'Cartas del 1 al 7 con ilustraciones de clarinetes, abiertas en abanico'),
  fanDeck: P('/fotos/clarinetes-y-mazo.jpg', 'Cartas de clarinetes en abanico y el mazo con el medallón dorado'),
  jokers: P('/fotos/bufones-partitura.jpg', 'Dos cartas del bufón sobre una partitura de Mozart'),
  joker: P('/fotos/bufon.jpg', 'Carta del bufón con vestuario cortesano, cetro y cartas en la mano'),
  jokerDeck: P('/fotos/bufon-y-medallon.jpg', 'Carta del bufón y el mazo con la carta del medallón dorado'),
  boxFront: P('/fotos/caja-frente.jpg', 'Frente de la caja: retrato de Johann Sebastian Bach en un medallón dorado sobre fondo bordó'),
  boxFront2: P('/fotos/caja-frente-sonatas.jpg', 'Caja de SCHERZANDO.AR sobre una edición de las Sonatas para violín solo de Bach'),
};

export const GALLERY: { photo: Photo; caption: string }[] = [
  { photo: PHOTOS.fan, caption: 'Los clarinetes' },
  { photo: PHOTOS.joker, caption: 'El bufón' },
  { photo: PHOTOS.fanDeck, caption: 'Los números' },
  { photo: PHOTOS.jokers, caption: 'Las cartas especiales' },
  { photo: PHOTOS.jokerDeck, caption: 'El medallón' },
];

export const DEFAULT_CONTENT: SiteContent = {
  photos: {
    hero: '/fotos/caja-y-clarinetes.jpg',
    box: '/fotos/caja-frente.jpg',
    gallery: GALLERY.map((g) => ({ src: g.photo.src, alt: g.photo.alt, caption: g.caption })),
  },
  brand: { name: 'SCHERZANDO.AR', instagram: 'scherzando.ar' },
  hero: {
    eyebrow: 'Una baraja española',
    title: 'Pero de música clásica',
    tagline: 'Algo se está componiendo… y ya podés tenerlo en tus manos.',
    cta: 'Comprar el mazo',
  },
  // Alternativas de frase para la portada (provisorias, para elegir desde el panel).
  taglineOptions: [
    'Una baraja española, pero de música clásica.',
    'Algo se está componiendo…',
    'Con espíritu de juego.',
    'Bach, en otra clave.',
  ],
  universe: {
    title: 'El universo Scherzando',
    paragraphs: [
      'En una partitura, «scherzando» pide tocar con gracia, con espíritu de juego.',
      'Este mazo lleva esa indicación al papel: el retrato de Bach en un medallón dorado, instrumentos ilustrados, ornamentos de otro siglo y un bufón que guarda sus propias cartas en la mano.',
      'Una baraja española que suena distinto.',
    ],
  },
  cards: {
    title: 'Las cartas',
    intro: 'Ilustraciones de instrumentos, números en bordó y detalles ornamentales sobre un fondo rosa empolvado.',
    jokerTitle: 'El bufón',
    jokerText: 'Vestuario cortesano, cascabeles y cetro: la carta más traviesa del mazo.',
    backsNote: 'Muy pronto, el diseño de los reversos.',
  },
  box: {
    title: 'La caja',
    text: 'Bordó profundo, el retrato de Johann Sebastian Bach en un medallón dorado y ornamentos florales en cada esquina. Un objeto para tener a la vista.',
  },
  product: {
    title: 'El mazo',
    description: '',
    rules: '',
    maker: '',
  },
  specs: [
    { label: 'Cantidad de cartas', value: '' },
    { label: 'Dimensiones de las cartas', value: '' },
    { label: 'Material', value: '' },
    { label: 'Presentación', value: '' },
    { label: 'Contenido de la caja', value: '' },
  ],
  sale: { price: 23000, maxPerOrder: 5 },
  extraProducts: [],
  payment: { holder: '', bank: '', cbu: '', alias: '', cuit: '', proofContact: 'scherzandogames@gmail.com', holdHours: 48 },
  shipping: {
    intro: 'Enviamos con Correo Argentino a todo el país: a domicilio o para retirar en una sucursal.',
    quotedAt: '',
    options: [
      { id: 'amba-domicilio', zone: 'CABA y Gran Buenos Aires', region: 'amba', modality: 'domicilio', price: null },
      { id: 'amba-sucursal', zone: 'CABA y Gran Buenos Aires', region: 'amba', modality: 'sucursal', price: null },
      { id: 'interior-domicilio', zone: 'Resto del país', region: 'interior', modality: 'domicilio', price: null },
      { id: 'interior-sucursal', zone: 'Resto del país', region: 'interior', modality: 'sucursal', price: null },
    ],
    dispatchInfo: 'Cuando despachamos tu pedido te enviamos por correo electrónico el número de seguimiento de Correo Argentino.',
    pkg: { originZip: '', weightG: null, heightCm: null, widthCm: null, lengthCm: null },
    rates: [],
  },
  faq: [
    {
      q: '¿Cómo pago?',
      a: 'Por transferencia bancaria. Al confirmar tu pedido te mostramos el CBU, el alias y el importe exacto, y te los enviamos por correo.',
    },
    {
      q: '¿Cuánto tiempo tengo para transferir?',
      a: 'Tu pedido queda reservado durante 48 horas. Si en ese plazo no recibimos la transferencia, se cancela solo y no tenés que hacer nada.',
    },
    {
      q: '¿El envío está incluido?',
      a: 'No. El precio del mazo y el del envío se muestran por separado y se suman en una sola transferencia.',
    },
    {
      q: '¿Cómo sé que mi compra quedó confirmada?',
      a: 'Cuando vemos la transferencia acreditada te enviamos un correo de confirmación, y después otro con el número de seguimiento del envío.',
    },
    {
      q: '¿Cómo sigo mi envío?',
      a: 'Al despachar te enviamos el número de seguimiento de Correo Argentino para que consultes el estado en su sitio.',
    },
    {
      q: '¿Envían fuera de la Argentina?',
      a: 'Por ahora sólo hacemos envíos dentro de la Argentina.',
    },
  ],
  closing: { title: 'La música, en tus manos', text: 'Una baraja española, pero de música clásica.' },
  seo: {
    title: 'SCHERZANDO.AR · Una baraja española de música clásica',
    description:
      'Mazo de cartas ilustrado con instrumentos, ornamentos barrocos y el retrato de Bach en la caja. Comprá online, pagá por transferencia y recibilo con Correo Argentino.',
  },
};

/** Combina lo guardado en el panel con los valores iniciales (campos nuevos quedan con su valor por defecto). */
export function mergeContent(saved: Partial<SiteContent> | null | undefined): SiteContent {
  const d = DEFAULT_CONTENT;
  if (!saved) return d;
  const obj = <T extends object>(a: T, b: unknown): T => (b && typeof b === 'object' ? { ...a, ...(b as T) } : a);
  return {
    photos: {
      ...obj(d.photos, saved.photos),
      gallery: Array.isArray(saved.photos?.gallery) && saved.photos!.gallery.length ? saved.photos!.gallery : d.photos.gallery,
    },
    brand: obj(d.brand, saved.brand),
    hero: obj(d.hero, saved.hero),
    taglineOptions: Array.isArray(saved.taglineOptions) ? saved.taglineOptions : d.taglineOptions,
    universe: obj(d.universe, saved.universe),
    cards: obj(d.cards, saved.cards),
    box: obj(d.box, saved.box),
    product: obj(d.product, saved.product),
    specs: Array.isArray(saved.specs) ? saved.specs : d.specs,
    sale: obj(d.sale, saved.sale),
    extraProducts: Array.isArray(saved.extraProducts) ? saved.extraProducts : [],
    payment: obj(d.payment, saved.payment),
    shipping: {
      ...obj(d.shipping, saved.shipping),
      options: Array.isArray(saved.shipping?.options) ? saved.shipping!.options : d.shipping.options,
      pkg: obj(d.shipping.pkg, saved.shipping?.pkg),
      rates: Array.isArray(saved.shipping?.rates) ? saved.shipping!.rates : [],
    },
    faq: Array.isArray(saved.faq) ? saved.faq : d.faq,
    closing: obj(d.closing, saved.closing),
    seo: obj(d.seo, saved.seo),
  };
}

export const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export const MODALITY_LABEL: Record<ShippingOption['modality'], string> = {
  domicilio: 'Envío a domicilio',
  sucursal: 'Retiro en sucursal',
};

/** Zona de Correo Argentino según el código postal. AMBA: CP 1000 a 1893 y los adicionales que
 *  indica la lista oficial de MiCorreo (1924, 2752, 2760, 2814, 2930, 2931, 2935, 2953). */
const AMBA_EXTRA = new Set([1924, 2752, 2760, 2814, 2930, 2931, 2935, 2953]);
export function zipNumber(zip: string): number | null {
  const m = zip.toUpperCase().replace(/\s/g, '').match(/^[A-Z]?(\d{4})[A-Z]{0,3}$/);
  return m ? Number(m[1]) : null;
}
export function regionOfZip(zip: string): 'amba' | 'interior' | null {
  const n = zipNumber(zip);
  if (n === null) return null;
  return (n >= 1000 && n <= 1893) || AMBA_EXTRA.has(n) ? 'amba' : 'interior';
}

/** Medidas conocidas de las fotos originales; las subidas desde el panel se muestran en formato 3:4. */
export function photoSize(src: string) {
  const known = Object.values(PHOTOS).find((p) => p.src === src);
  return known ? { w: known.w, h: known.h } : { w: 1200, h: 1600 };
}
export function photoAlt(src: string, fallback: string) {
  return Object.values(PHOTOS).find((p) => p.src === src)?.alt ?? fallback;
}

export const MAIN_SKU = 'mazo';

/** Todos los productos a la venta: primero el mazo, después los adicionales activos. */
export function productsOf(c: SiteContent, includeInactive = false): Product[] {
  const main: Product = {
    id: MAIN_SKU,
    name: `${c.brand.name} — mazo de cartas`,
    unit: ['mazo', 'mazos'],
    description: `${c.hero.eyebrow}, ${c.hero.title.toLowerCase()}`,
    price: c.sale.price,
    image: c.photos.box,
    maxPerOrder: c.sale.maxPerOrder,
  };
  const extra = c.extraProducts
    .filter((p) => includeInactive || p.active)
    .map((p) => ({ id: p.id, name: p.name, unit: ['unidad', 'unidades'] as [string, string], description: p.description, price: p.price, image: p.image || c.photos.box, maxPerOrder: p.maxPerOrder || 5 }));
  return [main, ...extra];
}

export function productById(c: SiteContent, id: string | null | undefined): Product | null {
  return productsOf(c).find((p) => p.id === (id || MAIN_SKU)) ?? null;
}

export const units = (p: Pick<Product, 'unit'>, n: number) => `${n} ${n === 1 ? p.unit[0] : p.unit[1]}`;

/** Las 24 jurisdicciones, en el orden en que se muestran. */
export const PROVINCE_NAMES = [
  'Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

/** Tarifa cargada para una provincia (siempre devuelve las 24, con null si falta). */
export function ratesOf(c: SiteContent): ProvinceRate[] {
  return PROVINCE_NAMES.map((province) => c.shipping.rates.find((r) => r.province === province) ?? { province, domicilio: null, sucursal: null });
}
export const hasAnyRate = (c: SiteContent) => c.shipping.rates.some((r) => r.domicilio !== null || r.sucursal !== null);
export const provinceSlug = (p: string) => p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
