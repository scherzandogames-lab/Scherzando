import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getContent } from '@/lib/settings';
import { ratesOf } from '@/lib/content';
import { micorreoEnabled } from '@/lib/micorreo';
import AdminNav from '@/components/admin/AdminNav';
import { saveStore } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tienda · SCHERZANDO', robots: { index: false } };

export default async function Tienda({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (!(await isAdmin())) redirect('/admin');
  const { ok } = await searchParams;
  const c = await getContent();
  const p = c.shipping.pkg;

  return (
    <main className="adm">
      <AdminNav on="tienda" />
      <form action={saveStore} className="adm-wrap adm-form">
        <h1>Pagos y envíos</h1>
        {ok && <p className="okmsg">Cambios guardados y publicados.</p>}

        <p className="muted">El precio y el stock de cada producto se cambian en <a href="/admin/productos">Productos</a>.</p>

        <h2>Datos del vendedor</h2>
        <p className="muted">Los exige la ley de Defensa del Consumidor. Se muestran al pie de la página, junto al botón de arrepentimiento.</p>
        <div className="adm-grid">
          <label className="f">Nombre o razón social<input name="seller_name" defaultValue={c.seller.name} /></label>
          <label className="f">CUIT<input name="seller_cuit" defaultValue={c.seller.cuit} placeholder="Ej. 27-12345678-9" /></label>
          <label className="f">Domicilio (opcional)<input name="seller_address" defaultValue={c.seller.address} /></label>
          <label className="f">Correo de contacto<input name="seller_email" type="email" defaultValue={c.seller.email} /></label>
        </div>

        <h2>Datos para la transferencia</h2>
        <p className="muted">Se le muestran al comprador al comprar y se le envían por correo.</p>
        <div className="adm-grid">
          <label className="f">Titular de la cuenta<input name="pay_holder" defaultValue={c.payment.holder} /></label>
          <label className="f">Banco<input name="pay_bank" defaultValue={c.payment.bank} /></label>
          <label className="f">CBU o CVU<input name="pay_cbu" inputMode="numeric" defaultValue={c.payment.cbu} /></label>
          <label className="f">Alias<input name="pay_alias" defaultValue={c.payment.alias} /></label>
          <label className="f">CUIT o CUIL del titular<input name="pay_cuit" defaultValue={c.payment.cuit} /></label>
          <label className="f">Dónde mandan el comprobante<input name="pay_proof" defaultValue={c.payment.proofContact} placeholder="Correo o WhatsApp" /></label>
          <label className="f">Horas de reserva sin pago<input name="pay_hold" inputMode="numeric" defaultValue={c.payment.holdHours} /><small>Pasado ese plazo, el pedido se cancela y el stock vuelve.</small></label>
        </div>

        <h2>Costo de envío por provincia</h2>
        <p className="muted">
          {micorreoEnabled()
            ? 'La cotización automática de MiCorreo está activa: estos importes sólo se usan si Correo Argentino no responde.'
            : 'Cargá el precio de envío de cada provincia. Si dejás una casilla vacía, esa opción no se ofrece; si una provincia no tiene ningún precio, sus compradores no pueden comprar.'}
        </p>
        <div className="adm-table">
          <div className="adm-row prov head"><span>Provincia</span><span>A domicilio ($)</span><span>Retiro en sucursal ($)</span></div>
          {ratesOf(c).map((r, i) => (
            <div className="adm-row prov" key={r.province}>
              <input type="hidden" name={`rate_${i}_province`} value={r.province} />
              <span>{r.province}</span>
              <input name={`rate_${i}_domicilio`} inputMode="numeric" defaultValue={r.domicilio ?? ''} placeholder="sin cargar" aria-label={`${r.province}, a domicilio`} />
              <input name={`rate_${i}_sucursal`} inputMode="numeric" defaultValue={r.sucursal ?? ''} placeholder="sin cargar" aria-label={`${r.province}, en sucursal`} />
            </div>
          ))}
        </div>
        <label className="f narrow">Fecha de la cotización (se muestra en la página)<input name="quotedAt" defaultValue={c.shipping.quotedAt} placeholder="Ej. 1 de diciembre de 2026" /></label>

        <h2>Paquete y origen</h2>
        <p className="muted">Necesarios para la cotización automática y para cargar envíos en MiCorreo.</p>
        <div className="adm-grid">
          <label className="f">Código postal de despacho<input name="originZip" inputMode="numeric" defaultValue={p.originZip} /></label>
          <label className="f">Peso de un mazo embalado (gramos)<input name="weightG" inputMode="numeric" defaultValue={p.weightG ?? ''} /></label>
          <label className="f">Alto (cm)<input name="heightCm" inputMode="numeric" defaultValue={p.heightCm ?? ''} /></label>
          <label className="f">Ancho (cm)<input name="widthCm" inputMode="numeric" defaultValue={p.widthCm ?? ''} /></label>
          <label className="f">Largo (cm)<input name="lengthCm" inputMode="numeric" defaultValue={p.lengthCm ?? ''} /></label>
        </div>

        <div className="adm-save"><button className="btn btn-gold" type="submit">Guardar y publicar</button></div>
      </form>
    </main>
  );
}
