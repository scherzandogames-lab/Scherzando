import 'server-only';
import { micorreoEnabled, quote } from './micorreo';
import { logEvent } from './log';
import { MODALITY_LABEL, regionOfZip, zipNumber, type ShippingOption, type SiteContent } from './content';

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

/** Opciones de envío disponibles para un código postal y una cantidad, con su costo. */
export async function shippingOptionsFor(c: SiteContent, zip: string, qty: number): Promise<ShippingQuote[]> {
  const region = regionOfZip(zip);
  if (!region) throw new ShippingError('Revisá el código postal (4 números, por ejemplo 1425).');
  const valid = c.shipping.options.filter((o) => o.region === 'todo' || o.region === region);

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
        const opt = valid.find((o) => o.modality === m);
        if (rate && opt) out.push({ id: opt.id, label: `${opt.zone} · ${MODALITY_LABEL[m]}`, modality: m, cost: Math.ceil(rate.price), source: 'micorreo' });
      }
      if (out.length) return out;
    } catch (e) {
      await logEvent('aviso', 'micorreo', `No se pudo cotizar en línea (se usa la tabla del panel): ${(e as Error).message}`);
    }
  }

  return valid
    .filter((o) => o.price !== null)
    .map((o) => ({ id: o.id, label: `${o.zone} · ${MODALITY_LABEL[o.modality]}`, modality: o.modality, cost: o.price!, source: 'tabla' as const }));
}
