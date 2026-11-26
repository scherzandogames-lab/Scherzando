'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPassword, createSession, destroySession, isAdmin } from '@/lib/auth';
import { getContent, saveContent } from '@/lib/settings';
import { db } from '@/lib/supabase';
import { setStock } from '@/lib/stock';
import { appendNote, markPaid, notifyDispatched, orderRef, type Order } from '@/lib/orders';
import { importShipment, micorreoEnabled, PROVINCES } from '@/lib/micorreo';
import { logEvent } from '@/lib/log';
import { zipNumber, PROVINCE_NAMES, type SiteContent, type ProvinceRate, type ExtraProduct } from '@/lib/content';
import { sendMail, layout } from '@/lib/email';
import { env } from '@/lib/env';

async function guard() {
  if (!(await isAdmin())) throw new Error('No autorizado');
}

export async function login(_: unknown, form: FormData) {
  const pw = String(form.get('password') ?? '').trim();
  if (!checkPassword(pw)) {
    await new Promise((r) => setTimeout(r, 800));
    return { error: 'Contraseña incorrecta, o el panel no está configurado (ADMIN_PASSWORD / SESSION_SECRET).' };
  }
  await createSession();
  redirect('/admin');
}

export async function logout() {
  await destroySession();
  redirect('/admin');
}

// ── Lectura segura de formularios ──
const s = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);
const money = (f: FormData, k: string): number | null => {
  const raw = s(f, k, 30).replace(/[^\d]/g, '');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const int = (f: FormData, k: string): number | null => {
  const raw = s(f, k, 12).replace(/[^\d]/g, '');
  return raw ? Number(raw) : null;
};
const okUrl = (v: string) => (/^https:\/\/[\w.-]+\.supabase\.co\//.test(v) || /^\/fotos\/[\w.-]+$/.test(v) ? v : '');

async function patch(fn: (c: SiteContent) => SiteContent) {
  await guard();
  const next = fn(await getContent());
  await saveContent(next);
  revalidatePath('/', 'layout');
}

/** Precio, stock y envíos. */
export async function saveStore(form: FormData) {
  await patch((c) => {
    const rates: ProvinceRate[] = [];
    for (let i = 0; i < PROVINCE_NAMES.length; i++) {
      const province = s(form, `rate_${i}_province`, 60);
      if (!PROVINCE_NAMES.includes(province)) continue;
      rates.push({ province, domicilio: money(form, `rate_${i}_domicilio`), sucursal: money(form, `rate_${i}_sucursal`) });
    }
    return {
      ...c,
      payment: {
        holder: s(form, 'pay_holder', 120),
        bank: s(form, 'pay_bank', 80),
        cbu: s(form, 'pay_cbu', 30).replace(/\s/g, ''),
        alias: s(form, 'pay_alias', 40).replace(/\s/g, ''),
        cuit: s(form, 'pay_cuit', 20),
        proofContact: s(form, 'pay_proof', 120),
        holdHours: Math.min(240, Math.max(1, int(form, 'pay_hold') ?? 48)),
      },
      shipping: {
        ...c.shipping,
        quotedAt: s(form, 'quotedAt', 40),
        rates,
        pkg: {
          originZip: zipNumber(s(form, 'originZip', 10)) ? s(form, 'originZip', 10) : '',
          weightG: int(form, 'weightG'),
          heightCm: int(form, 'heightCm'),
          widthCm: int(form, 'widthCm'),
          lengthCm: int(form, 'lengthCm'),
        },
      },
    };
  });
  await logEvent('info', 'panel', 'Tienda actualizada: datos de pago y envíos');
  redirect('/admin/tienda?ok=1');
}

/** Productos: el mazo y los adicionales, con precio y stock. */
export async function saveProducts(form: FormData) {
  await guard();
  const stocks: [string, number][] = [];
  const mainStock = int(form, 'main_stock');
  if (mainStock !== null) stocks.push(['mazo', mainStock]);
  await patch((c) => {
    const extra: ExtraProduct[] = [];
    for (let i = 0; i < 12; i++) {
      const name = s(form, `p_${i}_name`, 120);
      if (!name || form.get(`p_${i}_remove`) === 'on') continue;
      let id = s(form, `p_${i}_id`, 60).replace(/[^a-z0-9-]/g, '');
      if (!id || id === 'mazo') {
        const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'producto';
        id = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const price = money(form, `p_${i}_price`);
      extra.push({
        id,
        name,
        description: s(form, `p_${i}_description`, 600),
        price: price && price > 0 ? price : null,
        image: okUrl(s(form, `p_${i}_image`, 600)),
        active: form.get(`p_${i}_active`) === 'on',
        maxPerOrder: Math.min(20, Math.max(1, int(form, `p_${i}_max`) ?? 5)),
      });
      const st = int(form, `p_${i}_stock`);
      if (st !== null) stocks.push([id, st]);
    }
    const price = money(form, 'main_price');
    return { ...c, sale: { price: price && price > 0 ? price : null, maxPerOrder: Math.min(20, Math.max(1, int(form, 'main_max') ?? 5)) }, extraProducts: extra };
  });
  for (const [sku, n] of stocks) await setStock(n, sku);
  await logEvent('info', 'panel', 'Productos actualizados');
  redirect('/admin/productos?ok=1');
}

/** Textos de la página, características, preguntas y SEO. */
export async function saveTexts(form: FormData) {
  await patch((c) => {
    const specs = [];
    for (let i = 0; i < 10; i++) {
      const label = s(form, `spec_${i}_label`, 80);
      if (label) specs.push({ label, value: s(form, `spec_${i}_value`, 300) });
    }
    const faq = [];
    for (let i = 0; i < 14; i++) {
      const q = s(form, `faq_${i}_q`, 300);
      const a = s(form, `faq_${i}_a`, 3000);
      if (q && a) faq.push({ q, a });
    }
    const paras = (k: string) => s(form, k, 6000).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    return {
      ...c,
      brand: { ...c.brand, instagram: s(form, 'instagram', 60).replace(/^@/, '').replace(/[^\w.]/g, '') || c.brand.instagram },
      hero: { eyebrow: s(form, 'hero_eyebrow', 120), title: s(form, 'hero_title', 160) || c.hero.title, tagline: s(form, 'hero_tagline', 300), cta: s(form, 'hero_cta', 40) || c.hero.cta },
      taglineOptions: s(form, 'taglineOptions', 2000).split('\n').map((x) => x.trim()).filter(Boolean),
      universe: { title: s(form, 'universe_title', 120), paragraphs: paras('universe_paragraphs') },
      cards: { title: s(form, 'cards_title', 120), intro: s(form, 'cards_intro', 600), jokerTitle: s(form, 'cards_jokerTitle', 120), jokerText: s(form, 'cards_jokerText', 600), backsNote: s(form, 'cards_backsNote', 300) },
      box: { title: s(form, 'box_title', 120), text: s(form, 'box_text', 1200) },
      product: { title: s(form, 'product_title', 120) || c.product.title, description: s(form, 'product_description', 6000), rules: s(form, 'product_rules', 6000), maker: s(form, 'product_maker', 2000) },
      specs,
      shipping: { ...c.shipping, intro: s(form, 'shipping_intro', 600), dispatchInfo: s(form, 'shipping_dispatchInfo', 600) },
      faq,
      closing: { title: s(form, 'closing_title', 160), text: s(form, 'closing_text', 400) },
      seo: { title: s(form, 'seo_title', 120) || c.seo.title, description: s(form, 'seo_description', 300) || c.seo.description },
    };
  });
  redirect('/admin/textos?ok=1');
}

/** Fotografías: portada, caja y galería de cartas. */
export async function savePhotos(form: FormData) {
  await patch((c) => {
    const gallery = [];
    for (let i = 0; i < 16; i++) {
      const src = okUrl(s(form, `g_${i}_src`, 600));
      if (src && form.get(`g_${i}_on`) === 'on') gallery.push({ src, caption: s(form, `g_${i}_caption`, 80), alt: s(form, `g_${i}_alt`, 300) });
    }
    return {
      ...c,
      photos: {
        hero: okUrl(s(form, 'hero', 600)) || c.photos.hero,
        box: okUrl(s(form, 'box', 600)) || c.photos.box,
        gallery: gallery.length ? gallery : c.photos.gallery,
      },
    };
  });
  redirect('/admin/fotos?ok=1');
}

/** Agrega a la galería una foto recién subida (desde el formulario de subida). */
export async function addUploadedPhoto(url: string, caption: string) {
  const src = okUrl(url);
  if (!src) return { error: 'Dirección de imagen inválida.' };
  await patch((c) => ({ ...c, photos: { ...c.photos, gallery: [...c.photos.gallery, { src, caption: caption.slice(0, 80), alt: caption.slice(0, 300) }] } }));
  return { ok: true };
}

/** Despacho, seguimiento y estado de un pedido. */
export async function updateOrder(form: FormData) {
  await guard();
  const id = s(form, 'id', 40);
  const { data: before } = await db().from('orders').select('*').eq('id', id).single<Order>();
  if (!before) throw new Error('Pedido inexistente');
  const fulfillment_status = s(form, 'fulfillment_status');
  const tracking = s(form, 'tracking', 60) || null;
  const p: Record<string, unknown> = { tracking, admin_notes: s(form, 'admin_notes', 5000) || null, updated_at: new Date().toISOString() };
  if (['pendiente', 'preparando', 'despachado', 'entregado'].includes(fulfillment_status)) {
    p.fulfillment_status = fulfillment_status;
    if (fulfillment_status === 'despachado' && !before.dispatched_at) p.dispatched_at = new Date().toISOString();
  }
  const { data: order } = await db().from('orders').update(p).eq('id', id).select('*').single<Order>();
  if (order && form.get('notify') === 'on' && order.fulfillment_status === 'despachado') {
    const r = await notifyDispatched(order);
    if (!r.ok) await logEvent('error', 'correo', `No se pudo avisar el despacho de ${orderRef(order)}: ${r.error}`, order.id);
  }
  revalidatePath('/admin/pedidos');
}

/** Transferencia recibida: el pedido pasa a «pagado» y se avisa al comprador. */
export async function confirmTransfer(form: FormData) {
  await guard();
  const r = await markPaid(s(form, 'id', 40), 'Transferencia confirmada desde el panel.');
  if (!r.ok) {
    const { data: o } = await db().from('orders').select('admin_notes').eq('id', s(form, 'id', 40)).single();
    await db().from('orders').update({ admin_notes: appendNote(o?.admin_notes ?? null, r.error ?? 'Error') }).eq('id', s(form, 'id', 40));
  }
  revalidatePath('/admin/pedidos');
}

/** Cancela un pedido sin pagar y devuelve su stock. */
export async function cancelOrder(form: FormData) {
  await guard();
  const id = s(form, 'id', 40);
  const { data: o } = await db().from('orders').select('*').eq('id', id).single<Order>();
  if (!o || o.status === 'pagado') return;
  await db().rpc('liberar_stock', { p_order: id });
  await db().from('orders').update({ status: 'cancelado', admin_notes: appendNote(o.admin_notes, 'Cancelado desde el panel.') }).eq('id', id);
  revalidatePath('/admin/pedidos');
}

/** Carga el envío de un pedido pagado en la cuenta de MiCorreo (requiere la integración activa). */
export async function sendToMiCorreo(form: FormData) {
  await guard();
  const id = s(form, 'id', 40);
  const { data: o } = await db().from('orders').select('*').eq('id', id).single<Order>();
  if (!o || o.status !== 'pagado' || !micorreoEnabled()) return;
  const c = await getContent();
  const pkg = c.shipping.pkg;
  const prov = PROVINCES.find((x) => x.name === o.address.province);
  try {
    if (!pkg.weightG || !pkg.heightCm || !pkg.widthCm || !pkg.lengthCm) throw new Error('Faltan el peso y las medidas del paquete (panel → Tienda).');
    const sucursal = o.shipping_label.includes('sucursal');
    if (sucursal && !o.agency_code) throw new Error('El comprador escribió la sucursal a mano: cargá este envío directamente en MiCorreo.');
    await importShipment({
      orderId: o.id,
      orderNumber: orderRef(o),
      recipient: { name: `${o.first_name} ${o.last_name}`, email: o.email, phone: o.phone },
      deliveryType: sucursal ? 'S' : 'D',
      agency: o.agency_code,
      address: {
        streetName: o.address.street,
        streetNumber: o.address.number,
        floor: (o.address.floor ?? '').slice(0, 3),
        city: o.address.city,
        provinceCode: prov?.code ?? '',
        postalCode: String(zipNumber(o.address.zip) ?? o.address.zip),
      },
      weightG: pkg.weightG * o.quantity,
      heightCm: pkg.heightCm * o.quantity,
      widthCm: pkg.widthCm,
      lengthCm: pkg.lengthCm,
      declaredValue: o.items_total,
    });
    await db().from('orders').update({ micorreo_imported: true, fulfillment_status: 'preparando', admin_notes: appendNote(o.admin_notes, 'Envío cargado en MiCorreo.') }).eq('id', id);
    await logEvent('info', 'micorreo', `Pedido ${orderRef(o)} cargado en MiCorreo`, id);
  } catch (e) {
    const msg = (e as Error).message;
    await db().from('orders').update({ admin_notes: appendNote(o.admin_notes, `No se pudo cargar en MiCorreo: ${msg}`) }).eq('id', id);
    await logEvent('error', 'micorreo', `Pedido ${orderRef(o)}: ${msg}`, id);
  }
  revalidatePath('/admin/pedidos');
}

/** Prueba de correo: envía un mensaje a ADMIN_EMAIL. */
export async function sendTestMail() {
  await guard();
  const to = env.adminEmail();
  const r = to
    ? await sendMail({ to, subject: 'Prueba de correo — SCHERZANDO.AR', html: layout('Prueba de correo', '<p>Si leés esto, los correos de la tienda funcionan.</p>'), text: 'Si leés esto, los correos de la tienda funcionan.' }, 'prueba')
    : { ok: false, error: 'ADMIN_EMAIL no configurado' };
  redirect(`/admin?correo=${r.ok ? 'ok' : encodeURIComponent(r.error ?? 'error')}`);
}
