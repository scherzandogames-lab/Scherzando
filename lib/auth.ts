import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

const COOKIE = 'admin_session';
const MAX_AGE = 60 * 60 * 12; // 12 horas

function sign(payload: string) {
  return crypto.createHmac('sha256', env.sessionSecret()).update(payload).digest('base64url');
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function checkPassword(input: string) {
  const real = env.adminPassword();
  if (!real || env.sessionSecret().length < 32) return false;
  const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  return safeEqual(h(input), h(real));
}

export async function createSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (env.sessionSecret().length < 32) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf('.');
  if (i < 0) return false;
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp > Date.now() / 1000;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('No autorizado');
}
