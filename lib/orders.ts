import 'server-only';
import crypto from 'node:crypto';
import { db } from './supabase';
import { env } from './env';
import { siteOrigin } from './origin';
import { getContent } from './settings';
import { formatARS, zipNumber, productById, units, MAIN_SKU, type Product, type SiteContent } from './content';
import { sendMail, layout, button, esc } from './email';
import { getStock, releaseExpired } from './stock';
import { shippingOptionsFor, ShippingError } from './shipping';
import { logEvent } from './log';
import { PROVINCES } from './micorreo';

export type Address = {
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  zip: string;
  notes?: string;
  agency_note?: string; // sucursal preferida cuando no hay lista automática
};

export type Order = {
  id: string;
  numero: number;
  created_at: string;
  status: 'pendiente' | 'en_proceso' | 'pagado' | 'rechazado' | 'cancelado' | 'vencido' | 'devuelto';
  access_key: string;
  email: string;
  first_name: string;
  last_name: string;
  dni: string | null;
  phone: string;
  address: Address;
  product_id: string;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  items_total: number;
  shipping_option: string;
  shipping_label: string;
  shipping_cost: number;
  shipping_source: 'tabla' | 'micorreo';
  agency_code: string | null;
  total: number;
  currency: string;
  stock_reserved: boolean;
  reserved_until: string | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  mp_status_detail: string | null;
  mp_live: boolean | null;
  paid_at: string | null;
  fulfillment_status: 'pendiente' | 'preparando' | 'despachado' | 'entregado';
  carrier: string;
  tracking: string | null;
  dispatched_at: string | null;
  micorreo_imported: boolean;
  admin_notes: string | null;
  emails_log: { at: string; to: string; kind: string; ok: boolean; error?: string }[];
};

export class CheckoutError extends Error {}

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const orderRef = (o: Pick<Order, 'numero'>) => `S-${String(o.numero).padStart(4, '0')}`;

/** ¿Se puede comprar ahora? Devuelve el motivo si falta algo. */
export async function saleStatus(c: SiteContent, productId: string = MAIN_SKU): Promise<{ ok: boolean; stock: number | null; label: string; reason: string | null }> {
  const product = productById(c, productId);
  if (!product) return { ok: false, stock: null, label: 'No disponible', reason: 'Este producto no está a la venta.' };
  const stock = await getStock(product.id);
  if (product.price === null) return { ok: false, stock, label: 'Precio a confirmar', reason: 'Muy pronto a la venta.' };
  if (stock === null) return { ok: false, stock, label: 'Disponibilidad a confirmar', reason: 'Muy pronto a la venta.' };
  if (stock <= 0) return { ok: false, stock, label: 'Sin stock por el momento', reason: 'Volvé pronto: estamos reponiendo.' };
  if (!c.payment.cbu && !c.payment.alias) return { ok: false, stock, label: 'Disponible', reason: 'La compra en línea se habilita en breve.' };
  if (!c.shipping.options.some((o) => o.price !== null)) return { ok: false, stock, label: 'Disponible', reason: 'Estamos cargando las tarifas de envío.' };
  return { ok: true, stock, label: stock <= 5 ? `Últimas ${stock} unidades` : 'Disponible', reason: null };
}

/** Crea el pedido, reserva el stock y genera el pago. Todos los importes se calculan aquí, nunca en el navegador. */
export async function startCheckout(input: Record<string, unknown>) {
  const c = await getContent();
  await releaseExpired();
  const product: Product | null = productById(c, clean(input.product, 60) || MAIN_SKU);
  if (!product) throw new CheckoutError('Este producto no está a la venta.');
  const st = await saleStatus(c, product.id);
  if (!st.ok) throw new CheckoutError(st.reason ?? 'La compra no está disponible.');

  const max = Math.min(product.maxPerOrder, st.stock ?? 0);
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) throw new CheckoutError('Elegí la cantidad.');
  if (quantity > max) throw new CheckoutError(`Podés comprar hasta ${units(product, max)} por pedido.`);

  const first_name = clean(input.first_name, 80);
  const last_name = clean(input.last_name, 80);
  const email = clean(input.email, 160).toLowerCase();
  const phone = clean(input.phone, 40);
  const dni = clean(input.dni, 12).replace(/\D/g, '');
  if (!first_name || !last_name) throw new CheckoutError('Completá nombre y apellido.');
  if (!EMAIL_RE.test(email)) throw new CheckoutError('Revisá el correo electrónico.');
  if (phone.replace(/\D/g, '').length < 8) throw new CheckoutError('Revisá el teléfono.');
  if (dni.length < 7 || dni.length > 8) throw new CheckoutError('Revisá el DNI (7 u 8 números). Correo Argentino lo pide para entregar.');

  const zip = clean(input.zip, 10).toUpperCase();
  if (!zipNumber(zip)) throw new CheckoutError('Revisá el código postal (por ejemplo 1425).');
  const province = clean(input.province, 60);
  if (!PROVINCES.some((p) => p.name === province)) throw new CheckoutError('Elegí la provincia.');

  let quotes;
  try {
    quotes = await shippingOptionsFor(c, zip, quantity);
  } catch (e) {
    if (e instanceof ShippingError) throw new CheckoutError(e.message);
    throw e;
  }
  const ship = quotes.find((q) => q.id === clean(input.shipping, 60));
  if (!ship) throw new CheckoutError('Elegí una opción de envío válida para tu código postal.');

  const address: Address = {
    street: clean(input.street, 120),
    number: clean(input.number, 20),
    floor: clean(input.floor, 40),
    city: clean(input.city, 80),
    province,
    zip,
    notes: clean(input.notes, 300),
    agency_note: clean(input.agency_note, 200),
  };
  const agency_code = clean(input.agency_code, 20) || null;
  if (ship.modality === 'domicilio' && (!address.street || !address.number || !address.city))
    throw new CheckoutError('Completá la dirección de entrega.');
  if (ship.modality === 'sucursal' && !address.city) throw new CheckoutError('Completá tu localidad.');
  if (ship.modality === 'sucursal' && !agency_code && !address.agency_note)
    throw new CheckoutError('Indicá en qué sucursal de Correo Argentino querés retirar.');

  const unit_price = product.price!;
  const items_total = unit_price * quantity;
  const total = items_total + ship.cost;
  const access_key = crypto.randomBytes(24).toString('base64url');
  const reserved_until = new Date(Date.now() + Math.max(1, c.payment.holdHours || 48) * 3600_000);

  // Reserva atómica: si dos personas compran la última unidad al mismo tiempo, sólo una la obtiene.
  const { data: reserved, error: rErr } = await db().rpc('reservar_stock', { p_sku: product.id, p_qty: quantity });
  if (rErr) throw new Error('Reserva de stock: ' + rErr.message);
  if (!reserved) throw new CheckoutError('No hay stock suficiente para esa cantidad. Probá con menos.');

  const { data: order, error } = await db()
    .from('orders')
    .insert({
      access_key, email, first_name, last_name, dni, phone, address, product_id: product.id, product_name: product.name, quantity, unit_price, items_total,
      shipping_option: ship.id, shipping_label: ship.label, shipping_cost: ship.cost, shipping_source: ship.source,
      agency_code, total, stock_reserved: true, reserved_until: reserved_until.toISOString(),
    })
    .select('id, numero')
    .single();
  if (error || !order) {
    await db().rpc('reservar_stock', { p_sku: product.id, p_qty: -quantity }).then(() => {}, () => {});
    throw new Error('No se pudo registrar el pedido: ' + error?.message);
  }

  const created = (await reload(order.id))!;
  await logEvent('info', 'pedido', `Pedido ${orderRef(order)} creado: ${product.name}, ${quantity} × ${formatARS(unit_price)} + envío ${formatARS(ship.cost)} · esperando transferencia`, order.id);
  await notifyCreated(created, c);
  return { url: `/gracias?o=${order.id}&k=${access_key}` };
}

export async function getOrderByAccess(id: string, key: string): Promise<Order | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !key) return null;
  const { data } = await db().from('orders').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const a = Buffer.from(String(data.access_key));
  const b = Buffer.from(key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return data as Order;
}

async function reload(id: string) {
  const { data } = await db().from('orders').select('*').eq('id', id).maybeSingle<Order>();
  return data;
}

export function appendNote(prev: string | null, note: string) {
  const line = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${note}`;
  return prev ? `${prev}\n${line}` : line;
}

/**
 * El administrador confirma que la transferencia llegó: el pedido pasa a «pagado» y el comprador
 * recibe la confirmación. Si la reserva había vencido, se vuelve a tomar el stock.
 */
export async function markPaid(id: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const order = await reload(id);
  if (!order) return { ok: false, error: 'Pedido inexistente' };
  if (order.status === 'pagado') return { ok: true };
  if (!order.stock_reserved) {
    const { data: ok } = await db().rpc('reservar_stock', { p_sku: order.product_id || MAIN_SKU, p_qty: order.quantity });
    if (!ok) return { ok: false, error: 'No queda stock suficiente para este pedido. Actualizá el stock antes de confirmarlo.' };
  }
  const { data: updated } = await db()
    .from('orders')
    .update({ status: 'pagado', paid_at: new Date().toISOString(), stock_reserved: true, reserved_until: null, updated_at: new Date().toISOString(),
      admin_notes: note ? appendNote(order.admin_notes, note) : order.admin_notes })
    .eq('id', id)
    .neq('status', 'pagado')
    .select('*')
    .maybeSingle<Order>();
  if (!updated) return { ok: true };
  await logEvent('info', 'pago', `Transferencia del pedido ${orderRef(updated)} confirmada (${formatARS(updated.total)})`, updated.id);
  await notifyPaid(updated);
  return { ok: true };
}

async function logEmail(orderId: string, entry: Order['emails_log'][number]) {
  const { data } = await db().from('orders').select('emails_log').eq('id', orderId).single();
  const log = Array.isArray(data?.emails_log) ? data!.emails_log : [];
  await db().from('orders').update({ emails_log: [...log, entry] }).eq('id', orderId);
}

export function addressLine(o: Order) {
  const a = o.address;
  if (o.shipping_label.includes('sucursal'))
    return `Retiro en sucursal${o.agency_code ? ` ${o.agency_code}` : ''}${a.agency_note ? `: ${a.agency_note}` : ''} — ${a.city}, ${a.province} (CP ${a.zip})`;
  return `${a.street} ${a.number}${a.floor ? ', ' + a.floor : ''} — ${a.city}, ${a.province} (CP ${a.zip})`;
}

/** Correos de un pedido recién pagado: confirmación al comprador y aviso al administrador. */
/** Datos de la transferencia, listos para mostrar o enviar. */
export function transferRows(c: SiteContent): [string, string][] {
  const p = c.payment;
  const rows: [string, string][] = [];
  if (p.holder) rows.push(['Titular', p.holder]);
  if (p.bank) rows.push(['Banco', p.bank]);
  if (p.cbu) rows.push(['CBU / CVU', p.cbu]);
  if (p.alias) rows.push(['Alias', p.alias]);
  if (p.cuit) rows.push(['CUIT / CUIL', p.cuit]);
  return rows;
}

const detailOf = (o: Order) => `${o.product_name ?? 'Mazo SCHERZANDO.AR'}: ${o.quantity} × ${formatARS(o.unit_price)} = ${formatARS(o.items_total)}`;
const box = (inner: string) => `<div style="margin:20px 0;padding:16px;border:1px solid #e3c3bf;background:#fff;font-size:15px">${inner}</div>`;

/** Pedido recién creado: datos para transferir al comprador y aviso al administrador. */
async function notifyCreated(o: Order, c: SiteContent) {
  const ref = orderRef(o);
  const adminTo = env.adminEmail();
  const rows = transferRows(c);
  const until = o.reserved_until
    ? new Date(o.reserved_until).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'long', timeStyle: 'short' })
    : '';
  const table = rows.map(([k, v]) => `${esc(k)}: <strong>${esc(v)}</strong>`).join('<br>');
  const r = await sendMail(
    {
      to: o.email,
      subject: `Tu pedido ${ref} de ${c.brand.name}: datos para transferir`,
      html: layout(
        c.brand.name,
        `<p>Hola, ${esc(o.first_name)}:</p>
<p>Recibimos tu pedido. Para completar la compra, transferí el total a esta cuenta:</p>
${box(`${table}<br><br>Importe a transferir: <strong style="font-size:18px">${formatARS(o.total)}</strong><br>Referencia: <strong>${esc(ref)}</strong>`)}
<p style="font-size:15px">${esc(detailOf(o))}<br>Envío (${esc(o.shipping_label)}): ${formatARS(o.shipping_cost)}<br>Entrega: ${esc(addressLine(o))}</p>
<p style="font-size:15px">Reservamos tu pedido${until ? ` hasta el ${esc(until)}` : ''}. ${c.payment.proofContact ? `Cuando transfieras, mandá el comprobante a <strong>${esc(c.payment.proofContact)}</strong> indicando el pedido ${esc(ref)}.` : 'Cuando transfieras, respondé este correo con el comprobante.'}</p>
<p style="font-size:15px">Cuando la transferencia se acredite te enviamos la confirmación.</p>`,
      ),
      text: `Hola, ${o.first_name}: recibimos tu pedido ${ref}. Transferí ${formatARS(o.total)} a: ${rows.map(([k, v]) => `${k}: ${v}`).join(' · ')}. Referencia: ${ref}. ${c.payment.proofContact ? 'Comprobante a ' + c.payment.proofContact + '.' : ''}`,
      replyTo: adminTo || undefined,
    },
    `pedido ${ref} datos de transferencia`,
  );
  await logEmail(o.id, { at: new Date().toISOString(), to: o.email, kind: 'datos_transferencia', ok: r.ok, error: r.error });
  if (!r.ok) await logEvent('error', 'correo', `No se pudieron enviar los datos de transferencia del pedido ${ref}: ${r.error}`, o.id);

  if (!adminTo) return;
  const info: [string, string][] = [
    ['Pedido', ref],
    ['Comprador', `${o.first_name} ${o.last_name}`],
    ['DNI', o.dni ?? '—'],
    ['Email', o.email],
    ['Teléfono', o.phone],
    ['Cantidad', detailOf(o)],
    ['Envío', `${o.shipping_label} (${formatARS(o.shipping_cost)})`],
    ['Entrega', addressLine(o)],
    ['Total a recibir', formatARS(o.total)],
  ];
  if (o.address.notes) info.push(['Indicaciones', o.address.notes]);
  const t = info.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b463f">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  const r2 = await sendMail(
    {
      to: adminTo,
      subject: `Nuevo pedido ${ref} — esperando transferencia de ${formatARS(o.total)} — ${o.first_name} ${o.last_name}`,
      html: layout('Nuevo pedido', `<p>Cuando veas la transferencia en tu cuenta, confirmala en el panel.</p><table style="font-size:15px">${t}</table>${button((await siteOrigin()) + '/admin/pedidos?f=otros', 'Ver en el panel')}`),
      text: info.map(([k, v]) => `${k}: ${v}`).join('\n'),
      replyTo: o.email,
    },
    `pedido ${ref} administrador`,
  );
  await logEmail(o.id, { at: new Date().toISOString(), to: adminTo, kind: 'aviso_admin', ok: r2.ok, error: r2.error });
}

/** Transferencia confirmada: aviso al comprador. */
async function notifyPaid(o: Order) {
  const c = await getContent();
  const ref = orderRef(o);
  const r = await sendMail(
    {
      to: o.email,
      subject: `Recibimos tu transferencia: pedido ${ref} confirmado`,
      html: layout(
        c.brand.name,
        `<p>Hola, ${esc(o.first_name)}:</p>
<p>Recibimos tu transferencia y tu pedido quedó confirmado. ¡Gracias!</p>
${box(`<strong>Pedido ${esc(ref)}</strong><br>${esc(detailOf(o))}<br>Envío (${esc(o.shipping_label)}): ${formatARS(o.shipping_cost)}<br><strong>Total: ${formatARS(o.total)}</strong><br><br><strong>Entrega</strong><br>${esc(addressLine(o))}`)}
<p style="font-size:15px">${esc(c.shipping.dispatchInfo)}</p>`,
      ),
      text: `Hola, ${o.first_name}: recibimos tu transferencia. Pedido ${ref} confirmado. Total ${formatARS(o.total)}. Entrega: ${addressLine(o)}. ${c.shipping.dispatchInfo}`,
      replyTo: env.adminEmail() || undefined,
    },
    `pedido ${ref} confirmado`,
  );
  await logEmail(o.id, { at: new Date().toISOString(), to: o.email, kind: 'confirmacion', ok: r.ok, error: r.error });
  if (!r.ok) await logEvent('error', 'correo', `No se pudo enviar la confirmación del pedido ${ref}: ${r.error}`, o.id);
}

/** Aviso de despacho con el número de seguimiento. */
export async function notifyDispatched(o: Order) {
  const c = await getContent();
  const ref = orderRef(o);
  const r = await sendMail(
    {
      to: o.email,
      subject: `Tu pedido ${ref} de ${c.brand.name} está en camino`,
      html: layout(
        c.brand.name,
        `<p>Hola, ${esc(o.first_name)}:</p><p>Tu pedido ya fue despachado por Correo Argentino.</p>${
          o.tracking ? `<p>Número de seguimiento: <strong>${esc(o.tracking)}</strong></p><p style="font-size:15px">Podés consultar el estado en correoargentino.com.ar, en la sección de seguimiento de envíos.</p>` : ''
        }<p>${esc(addressLine(o))}</p>`,
      ),
      text: `Hola, ${o.first_name}: tu pedido ${ref} ya fue despachado por Correo Argentino.${o.tracking ? ' Seguimiento: ' + o.tracking : ''}`,
      replyTo: env.adminEmail() || undefined,
    },
    `pedido ${ref} despacho`,
  );
  await logEmail(o.id, { at: new Date().toISOString(), to: o.email, kind: 'despacho', ok: r.ok, error: r.error });
  return r;
}
