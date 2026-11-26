import { NextResponse } from 'next/server';
import { provincesForZip } from '@/lib/postal';

/** Provincia(s) que corresponden a un código postal. */
export async function GET(req: Request) {
  const cp = (new URL(req.url).searchParams.get('cp') ?? '').slice(0, 10);
  return NextResponse.json({ provinces: provincesForZip(cp) });
}
