import { NextResponse } from 'next/server';
import { getContent } from '@/lib/settings';
import { shippingOptionsFor, ShippingError } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

/** Opciones de envío para un código postal: tabla del panel o cotización en línea de MiCorreo. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const zip = (u.searchParams.get('cp') ?? '').slice(0, 10);
  const qty = Math.min(20, Math.max(1, Number(u.searchParams.get('cantidad')) || 1));
  try {
    const c = await getContent();
    const options = await shippingOptionsFor(c, zip, qty);
    return NextResponse.json({ options });
  } catch (e) {
    if (e instanceof ShippingError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: 'No pudimos calcular el envío. Probá de nuevo.' }, { status: 500 });
  }
}
