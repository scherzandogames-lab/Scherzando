import { NextResponse } from 'next/server';
import { agencies, micorreoEnabled, PROVINCES } from '@/lib/micorreo';
import { logEvent } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** Sucursales de Correo Argentino de una provincia (sólo con la integración MiCorreo activa). */
export async function GET(req: Request) {
  if (!micorreoEnabled()) return NextResponse.json({ enabled: false, agencies: [] });
  const name = new URL(req.url).searchParams.get('provincia') ?? '';
  const prov = PROVINCES.find((p) => p.name === name);
  if (!prov) return NextResponse.json({ error: 'Provincia inválida' }, { status: 400 });
  try {
    const list = await agencies(prov.code);
    return NextResponse.json({
      enabled: true,
      agencies: list
        .map((a) => ({
          code: a.code,
          name: a.name,
          address: `${a.location.address.streetName} ${a.location.address.streetNumber}, ${a.location.address.locality || a.location.address.city}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    });
  } catch (e) {
    await logEvent('aviso', 'micorreo', `No se pudo obtener la lista de sucursales: ${(e as Error).message}`);
    return NextResponse.json({ enabled: false, agencies: [] });
  }
}
