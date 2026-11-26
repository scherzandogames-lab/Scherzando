import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db, hasDb } from '@/lib/supabase';
import { env } from '@/lib/env';
import { sendMail, layout, esc } from '@/lib/email';
import { logEvent } from '@/lib/log';
import { appendNote } from '@/lib/orders';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

/** Registra un pedido de arrepentimiento, entrega un código y avisa al vendedor. */
export async function POST(req: Request) {
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  if (b.website) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  const order = clean(b.order, 12).toUpperCase();
  const email = clean(b.email, 160).toLowerCase();
  const name = clean(b.name, 120);
  const phone = clean(b.phone, 40);
  const comment = clean(b.comment, 1000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name || !order) return NextResponse.json({ error: 'Completá el número de pedido, tu nombre y tu correo.' }, { status: 400 });

  const code = `ARR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  let orderId: string | null = null;
  const num = Number(order.replace(/\D/g, ''));
  if (hasDb() && num) {
    const { data } = await db().from('orders').select('id, email, admin_notes').eq('numero', num).maybeSingle();
    if (data && String(data.email).toLowerCase() === email) {
      orderId = data.id;
      await db().from('orders').update({ admin_notes: appendNote(data.admin_notes, `Pedido de arrepentimiento ${code}${comment ? `: ${comment}` : ''}`) }).eq('id', data.id);
    }
  }
  await logEvent('aviso', 'arrepentimiento', `${code} · pedido ${order} · ${name} · ${email}${orderId ? '' : ' (el pedido no coincide con ese correo: revisar)'}`, orderId);

  const r = await sendMail({
    to: email,
    subject: `Recibimos tu pedido de arrepentimiento (${code})`,
    html: layout('SCHERZANDO.AR', `<p>Hola, ${esc(name)}:</p><p>Registramos tu pedido de arrepentimiento sobre el pedido <strong>${esc(order)}</strong>.</p><p>Código de identificación: <strong>${esc(code)}</strong></p><p>Te vamos a escribir para coordinar la devolución del producto y el reintegro.</p>`),
    text: `Hola, ${name}: registramos tu pedido de arrepentimiento sobre el pedido ${order}. Código: ${code}. Te vamos a escribir para coordinar la devolución y el reintegro.`,
    replyTo: env.adminEmail() || undefined,
  });
  if (env.adminEmail())
    await sendMail({
      to: env.adminEmail(),
      subject: `Pedido de arrepentimiento ${code} — pedido ${order}`,
      html: layout('Arrepentimiento', `<p>Código: <strong>${esc(code)}</strong><br>Pedido: ${esc(order)}${orderId ? '' : ' <em>(no coincide con el correo: revisar)</em>'}<br>Nombre: ${esc(name)}<br>Correo: ${esc(email)}<br>Teléfono: ${esc(phone || '—')}<br>Comentario: ${esc(comment || '—')}</p><p>La ley pide responder y coordinar la devolución sin costo para el comprador.</p>`),
      text: `Arrepentimiento ${code}. Pedido ${order}. ${name} ${email} ${phone}. ${comment}`,
      replyTo: email,
    });
  if (!r.ok) await logEvent('error', 'correo', `No se pudo enviar el código de arrepentimiento ${code}: ${r.error}`, orderId);
  return NextResponse.json({ ok: true, code });
}
