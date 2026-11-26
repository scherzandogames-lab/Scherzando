import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { formatARS } from '@/lib/content';
import { addressLine, orderRef, type Order } from '@/lib/orders';
import { micorreoEnabled } from '@/lib/micorreo';
import AdminNav from '@/components/admin/AdminNav';
import { updateOrder, cancelOrder, sendToMiCorreo, confirmTransfer } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ventas · SCHERZANDO', robots: { index: false } };

const FILTERS = [
  ['enviar', 'Por despachar'],
  ['despachados', 'Despachados'],
  ['pagados', 'Todas las pagadas'],
  ['otros', 'Esperando transferencia'],
  ['todos', 'Todas'],
] as const;

const STATUS: Record<Order['status'], string> = {
  pendiente: 'Esperando transferencia',
  en_proceso: 'Pago en revisión',
  pagado: 'Pagado',
  rechazado: 'Pago rechazado',
  cancelado: 'Cancelado',
  vencido: 'Venció sin pagar',
  devuelto: 'Pago devuelto',
};
const SHIP: Record<Order['fulfillment_status'], string> = {
  pendiente: 'Por preparar',
  preparando: 'Preparando',
  despachado: 'Despachado',
  entregado: 'Entregado',
};

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }) : '—';

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  if (!(await isAdmin())) redirect('/admin');
  const { f = 'enviar', q = '' } = await searchParams;
  let query = db().from('orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (f === 'pagados') query = query.eq('status', 'pagado');
  if (f === 'enviar') query = query.eq('status', 'pagado').in('fulfillment_status', ['pendiente', 'preparando']);
  if (f === 'despachados') query = query.eq('status', 'pagado').in('fulfillment_status', ['despachado', 'entregado']);
  if (f === 'otros') query = query.neq('status', 'pagado');
  const term = q.trim().replace(/[%,()]/g, '');
  if (term) query = query.or(`email.ilike.%${term}%,last_name.ilike.%${term}%,first_name.ilike.%${term}%,dni.ilike.%${term}%`);
  const { data, error } = await query;
  const orders = (data ?? []) as Order[];
  const mc = micorreoEnabled();

  return (
    <main className="adm">
      <AdminNav on="pedidos" />
      <div className="adm-wrap">
        <div className="adm-head">
          <h1>Ventas</h1>
          <a className="btn-sm" href="/api/admin/export">Descargar planilla (CSV)</a>
        </div>
        <div className="adm-filters">
          {FILTERS.map(([k, l]) => <a key={k} href={`?f=${k}`} className={f === k ? 'on' : ''}>{l}</a>)}
        </div>
        <form className="adm-search" method="get">
          <input type="hidden" name="f" value={f} />
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, correo o DNI" aria-label="Buscar" />
          <button className="btn-sm" type="submit">Buscar</button>
        </form>
        {error && <p className="alert">{error.message}</p>}
        {!orders.length && <p className="muted">No hay ventas en esta vista.</p>}

        {orders.map((o) => (
          <details className="adm-order" key={o.id}>
            <summary>
              <span className="ref">{orderRef(o)}</span>
              <span className="who"><b>{o.first_name} {o.last_name}</b> <small>{o.product_name ?? 'Mazo'} × {o.quantity} · {formatARS(o.total)} · {o.address.city}</small></span>
              <span className={`pill s-${o.status}`}>{STATUS[o.status]}</span>
              {o.status === 'pagado' && <span className={`pill f-${o.fulfillment_status}`}>{SHIP[o.fulfillment_status]}</span>}
            </summary>
            <div className="adm-order-body">
              <dl>
                <dt>Fecha</dt><dd>{fmt(o.created_at)}</dd>
                <dt>Comprador</dt><dd>{o.first_name} {o.last_name} · DNI {o.dni ?? '—'}</dd>
                <dt>Correo</dt><dd><span className="sel">{o.email}</span></dd>
                <dt>Teléfono</dt><dd><span className="sel">{o.phone}</span></dd>
                <dt>Producto</dt><dd>{o.product_name ?? 'Mazo'}: {o.quantity} × {formatARS(o.unit_price)} = {formatARS(o.items_total)}</dd>
                <dt>Envío</dt><dd>{o.shipping_label} · {formatARS(o.shipping_cost)} <small>({o.shipping_source === 'micorreo' ? 'cotizado en línea' : 'tabla del panel'})</small></dd>
                <dt>Entrega</dt><dd><strong>{addressLine(o)}</strong>{o.address.notes ? <><br /><em>{o.address.notes}</em></> : null}</dd>
                <dt>Total</dt><dd><b>{formatARS(o.total)}</b></dd>
                <dt>Pago</dt><dd>{STATUS[o.status]}{o.paid_at ? ` · ${fmt(o.paid_at)}` : ''}{o.status === 'pendiente' && o.reserved_until ? ` · reservado hasta ${fmt(o.reserved_until)}` : ''}</dd>
                <dt>Correos</dt><dd>{o.emails_log?.length ? o.emails_log.map((e, i) => <div key={i}>{fmt(e.at)} · {e.kind} → {e.to} {e.ok ? '✓' : `✗ ${e.error ?? ''}`}</div>) : '—'}</dd>
              </dl>

              {o.status === 'pagado' ? (
                <form action={updateOrder} className="adm-form">
                  <input type="hidden" name="id" value={o.id} />
                  <label className="f">Estado del envío
                    <select name="fulfillment_status" defaultValue={o.fulfillment_status}>
                      <option value="pendiente">Por preparar</option>
                      <option value="preparando">Preparando</option>
                      <option value="despachado">Despachado</option>
                      <option value="entregado">Entregado</option>
                    </select>
                  </label>
                  <label className="f">Número de seguimiento de Correo Argentino<input name="tracking" defaultValue={o.tracking ?? ''} /></label>
                  <label className="chk"><input type="checkbox" name="notify" defaultChecked={o.fulfillment_status !== 'despachado'} /> Avisar al comprador por correo al marcar «Despachado»</label>
                  <label className="f">Notas internas<textarea name="admin_notes" rows={3} defaultValue={o.admin_notes ?? ''} /></label>
                  <button className="btn-sm primary" type="submit">Guardar</button>
                </form>
              ) : (
                <div className="adm-form">
                  {o.admin_notes && <p className="muted pre">{o.admin_notes}</p>}
                  {['pendiente', 'en_proceso', 'vencido'].includes(o.status) && (
                    <form action={confirmTransfer}>
                      <input type="hidden" name="id" value={o.id} />
                      <p className="muted small">Cuando veas {formatARS(o.total)} acreditados en tu cuenta:</p>
                      <button className="btn-sm primary" type="submit">Transferencia recibida: confirmar pedido</button>
                    </form>
                  )}
                  {['pendiente', 'en_proceso'].includes(o.status) && (
                    <form action={cancelOrder}><input type="hidden" name="id" value={o.id} /><button className="btn-sm" type="submit">Cancelar y devolver el stock</button></form>
                  )}
                </div>
              )}
              {o.status === 'pagado' && mc && !o.micorreo_imported && (
                <form action={sendToMiCorreo}><input type="hidden" name="id" value={o.id} /><button className="btn-sm" type="submit">Cargar este envío en MiCorreo</button></form>
              )}
              {o.micorreo_imported && <p className="okmsg">Envío cargado en MiCorreo: pagalo e imprimí el rótulo desde tu cuenta.</p>}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
