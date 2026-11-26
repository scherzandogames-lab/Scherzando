import 'server-only';
import { micorreoEnabled, quote } from './micorreo';
import { logEvent } from './log';
import { MODALITY_LABEL, zipNumber, ratesOf, provinceSlug, PROVINCE_NAMES, type ShippingOption, type SiteContent } from './content';

export type ShippingQuote = {
  id: string;
  label: string; // «CABA y Gran Buenos Aires · Envío a domicilio»
  modality: ShippingOption['modality'];
  cost: number;
  source: 'tabla' | 'micorreo';
};

export class ShippingError extends Error {}

const pkgReady = (c: SiteContent) => {
  const p = c.shipping.pkg;
  return !!(zipNumber(p.originZip) && p.weightG && p.heightCm && p.widthCm && p.lengthCm);
};

/** Opciones de envío para una provincia y un código postal, con su costo. */
export async function shippingOptionsFor(c: SiteContent, zip: string, qty: number, province: string): Promise<ShippingQuote[]> {
  if (!zipNumber(zip)) throw new ShippingError('Revisá el código postal (4 números, por ejemplo 1425).');
  if (!PROVINCE_NAMES.includes(province)) throw new ShippingError('Elegí tu provincia.');
  const slug = provinceSlug(province);

  // Cotización en línea con Correo Argentino, si la integración está activa.
  if (micorreoEnabled() && pkgReady(c)) {
    try {
      const p = c.shipping.pkg;
      const r = await quote({
        originZip: String(zipNumber(p.originZip)),
        destZip: String(zipNumber(zip)),
        weightG: p.weightG! * qty,
        heightCm: p.heightCm! * qty,
        widthCm: p.widthCm!,
        lengthCm: p.lengthCm!,
      });
      const out: ShippingQuote[] = [];
      for (const m of ['domicilio', 'sucursal'] as const) {
        const rate = r.rates.find((x) => x.deliveredType === (m === 'domicilio' ? 'D' : 'S'));
        if (rate) out.push({ id: `${slug}-${m}`, label: `${province} · ${MODALITY_LABEL[m]}`, modality: m, cost: Math.ceil(rate.price), source: 'micorreo' });
      }
      if (out.length) return out;
    } catch (e) {
      await logEvent('aviso', 'micorreo', `No se pudo cotizar en línea (se usa la tabla del panel): ${(e as Error).message}`);
    }
  }

  const rate = ratesOf(c).find((r) => r.province === province)!;
  const out: ShippingQuote[] = [];
  for (const m of ['domicilio', 'sucursal'] as const) {
    const cost = rate[m];
    if (cost !== null) out.push({ id: `${slug}-${m}`, label: `${province} · ${MODALITY_LABEL[m]}`, modality: m, cost, source: 'tabla' });
  }
  return out;
}

// Compatibilidad: el tipo de opción anterior sigue existiendo para la integración MiCorreo.
export type { ShippingOption };
