import { NextResponse } from 'next/server';
import { provincesForZip, localitiesForZip } from '@/lib/postal';

/** Provincia(s) que corresponden a un código postal. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const cp = (u.searchParams.get('cp') ?? '').slice(0, 10);
  const provinces = provincesForZip(cp, { infer: true });
  const province = (u.searchParams.get('provincia') ?? '').slice(0, 60) || (provinces.length === 1 ? provinces[0] : '');
  return NextResponse.json({ provinces, localities: province ? localitiesForZip(cp, province) : { main: null, options: [] } });
}
