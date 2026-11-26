import { NextResponse } from 'next/server';
import { branchesNear } from '@/lib/branches';

export const dynamic = 'force-dynamic';

/** Sucursales oficiales de Correo Argentino cercanas a un código postal (API MiCorreo). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const province = (u.searchParams.get('provincia') ?? '').slice(0, 60);
  const zip = (u.searchParams.get('cp') ?? '').slice(0, 10);
  const locality = (u.searchParams.get('localidad') ?? '').slice(0, 80);
  const r = await branchesNear({ province, zip, locality });
  return NextResponse.json(r);
}
