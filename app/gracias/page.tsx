import type { Metadata } from 'next';
import { getContent } from '@/lib/settings';
import { formatARS } from '@/lib/content';
import { getOrderByAccess, addressLine, orderRef, transferRows, type Order } from '@/lib/orders';
import type { SiteContent } from '@/lib/content';
import CopyButton from '@/components/CopyButton';
import SimpleHeader from '@/components/SimpleHeader';
import LegalFooter from '@/components/LegalFooter';
import PurchaseTracker from '@/components/PurchaseTracker';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Estado de tu compra', robots: { index: false } };

type SP = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Gracias({ searchParams }: SP) {
  const sp = await searchParams;
  const c = await getContent();
  const order: Order | null = await getOrderByAccess(sp.o ?? '', sp.k ?? '').catch(() => null);

  return (
    <>
      <SimpleHeader name={c.brand.name} />
      <main className="page status">{order ? <State o={order} c={c} /> : <NotFound />}</main>
      <footer className="footer"><LegalFooter c={c} /></footer>
    </>
  );
}

function NotFound() {
  return (
    <>
      <h1>No encontramos el pedido</h1>
      <p>El enlace puede estar incompleto. Si ya pagaste, revisá tu correo.</p>
      <a className="btn btn-gold" href="/">Volver al inicio</a>
    </>
  );
}

function State({ o, c }: { o: Order; c: SiteContent }) {
  const ref = orderRef(o);
  const info = c.shipping.dispatchInfo;
  if (o.status === 'pagado')
    return (
      <>
        <p className="tempo"><span>✓</span> Pedido {ref} · transferencia recibida</p>
        <h1>¡Gracias por tu compra!</h1>
        <p>Recibimos tu transferencia, {o.first_name}. Te enviamos la confirmación a <strong>{o.email}</strong>.</p>
        <div className="totals">
          <div><span>{o.product_name ?? 'Mazo'} × {o.quantity}</span><span>{formatARS(o.items_total)}</span></div>
          <div><span>Envío · {o.shipping_label}</span><span>{formatARS(o.shipping_cost)}</span></div>
          <div className="grand"><span>Total pagado</span><span>{formatARS(o.total)}</span></div>
        </div>
        <p><strong>Entrega:</strong> {addressLine(o)}</p>
        <p>{info}</p>
        <a className="btn btn-gold" href="/">Volver al inicio</a>
      </>
    );
  if (['rechazado', 'cancelado', 'vencido'].includes(o.status))
    return (
      <>
        <p className="tempo">Pedido {ref}</p>
        <h1>El pedido se canceló</h1>
        <p>No recibimos la transferencia dentro del plazo de reserva. Si ya transferiste, respondé el correo del pedido con el comprobante y lo resolvemos.</p>
        <a className="btn btn-gold" href={`/comprar?producto=${o.product_id}&cantidad=${o.quantity}`}>Intentar de nuevo</a>
      </>
    );
  if (o.status === 'devuelto')
    return (
      <>
        <p className="tempo">Pedido {ref}</p>
        <h1>Pago devuelto</h1>
        <p>Este pago fue reintegrado. Si creés que es un error, respondé el correo del pedido.</p>
      </>
    );
  const rows = transferRows(c);
  const until = o.reserved_until
    ? new Date(o.reserved_until).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'long', timeStyle: 'short' })
    : null;
  return (
    <>
      <PurchaseTracker value={o.total} orderId={o.id} />
      <p className="tempo">Pedido {ref} · reservado</p>
      <h1>Último paso: la transferencia</h1>
      <p>Gracias, {o.first_name}. Transferí el total a esta cuenta. También te mandamos estos datos a <strong>{o.email}</strong>.</p>
      <dl className="transfer">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd><span className="sel">{v}</span>{['CBU / CVU', 'Alias'].includes(k) && <CopyButton text={v} />}</dd></div>
        ))}
        <div className="amount"><dt>Importe a transferir</dt><dd><span className="sel">{formatARS(o.total)}</span><CopyButton text={String(o.total)} /></dd></div>
        <div><dt>Referencia</dt><dd>{ref}</dd></div>
      </dl>
      <div className="totals">
        <div><span>{o.product_name ?? 'Mazo'} × {o.quantity}</span><span>{formatARS(o.items_total)}</span></div>
        <div><span>Envío · {o.shipping_label}</span><span>{formatARS(o.shipping_cost)}</span></div>
        <div className="grand"><span>Total</span><span>{formatARS(o.total)}</span></div>
      </div>
      <p>Tu pedido queda reservado{until ? <> hasta el <strong>{until}</strong></> : null}. {c.payment.proofContact ? <>Cuando transfieras, mandá el comprobante a <strong className="sel">{c.payment.proofContact}</strong> indicando el pedido {ref}.</> : 'Cuando transfieras, respondé el correo del pedido con el comprobante.'}</p>
      <p className="muted">Cuando la transferencia se acredite, te llega la confirmación por correo.</p>
      <p><strong>Entrega:</strong> {addressLine(o)}</p>
    </>
  );
}
