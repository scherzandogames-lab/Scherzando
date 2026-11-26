import type { Metadata } from 'next';
import { isAdmin } from '@/lib/auth';
import { db, hasDb } from '@/lib/supabase';
import { env } from '@/lib/env';
import { mailProvider } from '@/lib/email';
import { micorreoEnabled } from '@/lib/micorreo';
import { getContent } from '@/lib/settings';
import { getStock, releaseExpired } from '@/lib/stock';
import { formatARS, hasAnyRate } from '@/lib/content';
import AdminNav from '@/components/admin/AdminNav';
import LoginForm from '@/components/admin/LoginForm';
import { sendTestMail } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Panel · SCHERZANDO', robots: { index: false } };

const fmt = (s: string) => new Date(s).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' });

export default async function Admin({ searchParams }: { searchParams: Promise<{ correo?: string }> }) {
  if (!(await isAdmin())) return <main className="adm"><LoginForm /></main>;
  const { correo } = await searchParams;
  const c = await getContent();

  let toShip = 0, paid = 0, revenue = 0, pending = 0;
  let events: { at: string; level: string; source: string; message: string }[] = [];
  if (hasDb()) {
    await releaseExpired();
    const { data } = await db().from('orders').select('status, fulfillment_status, total').limit(5000);
    for (const o of data ?? []) {
      if (o.status === 'pagado') {
        paid++;
        revenue += o.total;
        if (['pendiente', 'preparando'].includes(o.fulfillment_status)) toShip++;
      }
      if (['pendiente', 'en_proceso'].includes(o.status)) pending++;
    }
    const ev = await db().from('event_log').select('at, level, source, message').order('at', { ascending: false }).limit(12);
    events = ev.data ?? [];
  }
  const stock = await getStock();

  const checks: [string, boolean, string][] = [
    ['Base de datos (Supabase)', hasDb(), 'Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en Netlify.'],
    ['Datos para la transferencia', !!(c.payment.cbu || c.payment.alias), 'Cargá el CBU o el alias en «Pagos y envíos».'],
    ['Correo saliente', !!(mailProvider() && env.emailFrom()), 'Faltan SMTP_USER, SMTP_PASS y EMAIL_FROM.'],
    ['Correo Argentino automático', micorreoEnabled(), 'Sin credenciales de la API MiCorreo: los envíos se cargan a mano en MiCorreo y el costo sale de la tabla.'],
    ['Precio cargado', c.sale.price !== null, 'Cargalo en «Productos».'],
    ['Stock cargado', (stock ?? 0) > 0, 'Cargalo en «Productos».'],
    ['Tarifas de envío', hasAnyRate(c), 'Cargá el precio de envío de cada provincia en «Pagos y envíos».'],
  ];

  return (
    <main className="adm">
      <AdminNav on="inicio" />
      <div className="adm-wrap">
        <div className="adm-stats">
          <a href="/admin/pedidos?f=enviar"><strong>{toShip}</strong><span>por despachar</span></a>
          <a href="/admin/pedidos?f=pagados"><strong>{paid}</strong><span>ventas pagadas</span></a>
          <div><strong>{formatARS(revenue)}</strong><span>cobrado (transferencias confirmadas)</span></div>
          <div><strong>{stock ?? '—'}</strong><span>mazos en stock</span></div>
          <a href="/admin/pedidos?f=otros"><strong>{pending}</strong><span>esperando transferencia</span></a>
        </div>

        <h2>Estado de la tienda</h2>
        <ul className="adm-checks">
          {checks.map(([label, ok, why]) => (
            <li key={label} className={ok ? 'ok' : 'no'}><span>{ok ? '✓' : '•'}</span><b>{label}</b>{!ok ? <em>{why}</em> : null}</li>
          ))}
        </ul>
        <form action={sendTestMail}><button className="btn-sm" type="submit">Enviarme un correo de prueba</button></form>
        {correo && <p className={correo === 'ok' ? 'okmsg' : 'alert'}>{correo === 'ok' ? 'Correo de prueba enviado: revisá tu casilla.' : `No se pudo enviar: ${correo}`}</p>}

        <h2>Últimos eventos</h2>
        {events.length ? (
          <ul className="adm-events">
            {events.map((e, i) => (
              <li key={i} className={e.level}><time>{fmt(e.at)}</time> <b>{e.source}</b> {e.message}</li>
            ))}
          </ul>
        ) : <p className="muted">Sin eventos registrados.</p>}
      </div>
    </main>
  );
}
