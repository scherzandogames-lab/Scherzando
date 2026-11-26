import { NextResponse } from 'next/server';
import { startCheckout, CheckoutError } from '@/lib/orders';
import { logEvent } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  // Campo trampa para bots: las personas no lo ven ni lo completan.
  if (body.website) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  try {
    const { url } = await startCheckout(body);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: 400 });
    await logEvent('error', 'checkout', String((e as Error)?.message ?? e));
    return NextResponse.json({ error: 'No pudimos registrar el pedido. Probá de nuevo en unos minutos.' }, { status: 500 });
  }
}
