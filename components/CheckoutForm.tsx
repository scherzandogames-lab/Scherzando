'use client';
import { useEffect, useState } from 'react';
import { track } from './MetaPixel';

type Quote = { id: string; label: string; modality: 'domicilio' | 'sucursal'; cost: number; source: string };
type Agency = { code: string; name: string; address: string };

const ars = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function CheckoutForm(props: { productId: string; unit: [string, string]; price: number; max: number; initialQty: number; provinces: string[] }) {
  const u = (n: number) => `${n} ${n === 1 ? props.unit[0] : props.unit[1]}`;
  const [qty, setQty] = useState(Math.min(props.max, Math.max(1, props.initialQty)));
  const [zip, setZip] = useState('');
  const [province, setProvince] = useState('');
  const [zipProvinces, setZipProvinces] = useState<string[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [quoteErr, setQuoteErr] = useState('');
  const [loadingQ, setLoadingQ] = useState(false);
  const [ship, setShip] = useState('');
  const [agencies, setAgencies] = useState<Agency[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = quotes?.find((q) => q.id === ship) ?? null;
  const items = props.price * qty;

  // Al completar el código postal, se detecta la provincia.
  useEffect(() => {
    if (!/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(zip.trim())) {
      setZipProvinces(null);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/envio/provincia?cp=${encodeURIComponent(zip.trim())}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { provinces: string[] }) => {
        setZipProvinces(j.provinces);
        if (j.provinces.length === 1) setProvince(j.provinces[0]);
        else if (j.provinces.length > 1) setProvince((p) => (j.provinces.includes(p) ? p : ''));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [zip]);

  // Cotiza el envío cuando el código postal está completo (y al cambiar la cantidad).
  useEffect(() => {
    if (!/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(zip.trim()) || !province) {
      setQuotes(null);
      return;
    }
    const ctrl = new AbortController();
    setLoadingQ(true);
    setQuoteErr('');
    fetch(`/api/envio/cotizar?cp=${encodeURIComponent(zip.trim())}&provincia=${encodeURIComponent(province)}&cantidad=${qty}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No pudimos calcular el envío.');
        setQuotes(j.options);
        setShip((s) => (j.options.some((o: Quote) => o.id === s) ? s : ''));
        if (!j.options.length) setQuoteErr('Todavía no tenemos la tarifa de envío para tu provincia. Escribinos y lo resolvemos.');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setQuotes(null);
          setQuoteErr(e.message);
        }
      })
      .finally(() => setLoadingQ(false));
    return () => ctrl.abort();
  }, [zip, qty, province]);

  // Lista oficial de sucursales (sólo si la integración con MiCorreo está activa).
  useEffect(() => {
    if (selected?.modality !== 'sucursal' || !province) return;
    setAgencies(null);
    fetch(`/api/envio/sucursales?provincia=${encodeURIComponent(province)}`)
      .then((r) => r.json())
      .then((j) => setAgencies(j.enabled ? j.agencies : []))
      .catch(() => setAgencies([]));
  }, [selected?.modality, province]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!selected) {
      setError('Elegí una opción de envío.');
      return;
    }
    setBusy(true);
    const data = { ...Object.fromEntries(new FormData(e.currentTarget).entries()), product: props.productId, quantity: qty, shipping: ship };
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || 'No pudimos registrar el pedido.');
      track('Lead', { currency: 'ARS', value: items + selected.cost, num_items: qty });
      window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="checkout" onSubmit={onSubmit}>
      <div className="hp" aria-hidden="true">
        <label>No completar <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <fieldset>
        <legend>1 · Cantidad</legend>
        <div className="qty" role="group" aria-label="Cantidad">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Uno menos">−</button>
          <output aria-live="polite">{u(qty)}</output>
          <button type="button" onClick={() => setQty((q) => Math.min(props.max, q + 1))} disabled={qty >= props.max} aria-label="Uno más">+</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>2 · Tus datos</legend>
        <div className="fields two">
          <label className="f">Nombre<input id="first_name" name="first_name" required autoComplete="given-name" maxLength={80} /></label>
          <label className="f">Apellido<input id="last_name" name="last_name" required autoComplete="family-name" maxLength={80} /></label>
          <label className="f">Correo electrónico<input id="email" name="email" type="email" required autoComplete="email" inputMode="email" maxLength={160} /><small>Ahí te llega la confirmación.</small></label>
          <label className="f">Teléfono<input id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" maxLength={40} placeholder="11 2345 6789" /></label>
          <label className="f">DNI<input id="dni" name="dni" required inputMode="numeric" pattern="[0-9.\s]{7,11}" maxLength={11} /><small>Correo Argentino lo pide para entregar.</small></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>3 · Envío por Correo Argentino</legend>
        <div className="fields two">
          <label className="f">Código postal<input id="zip" name="zip" required inputMode="numeric" autoComplete="postal-code" maxLength={10} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Ej. 1425" /></label>
          <label className="f">Provincia
            <select id="province" name="province" required value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="" disabled>{zipProvinces && zipProvinces.length > 1 ? 'Elegí cuál de estas' : 'Elegí una'}</option>
              {(zipProvinces && zipProvinces.length ? zipProvinces : props.provinces).map((p) => <option key={p}>{p}</option>)}
            </select>
            {zipProvinces && zipProvinces.length === 1 && <small>Detectada por tu código postal.</small>}
            {zipProvinces && zipProvinces.length > 1 && <small>Ese código postal es compartido: elegí tu provincia.</small>}
          </label>
        </div>
        {loadingQ && <p className="muted">Calculando el envío…</p>}
        {quoteErr && <p className="alert" role="alert">{quoteErr}</p>}
        {quotes && quotes.length > 0 && (
          <div className="ship-options" role="radiogroup" aria-label="Opciones de envío">
            {quotes.map((q) => (
              <label key={q.id} className="ship-opt">
                <input type="radio" name="shipping_choice" value={q.id} checked={ship === q.id} onChange={() => setShip(q.id)} />
                <span>{q.label}</span>
                <strong>{ars(q.cost)}</strong>
              </label>
            ))}
          </div>
        )}
        {selected?.modality === 'domicilio' && (
          <div className="fields two">
            <label className="f">Calle<input id="street" name="street" required autoComplete="address-line1" maxLength={120} /></label>
            <label className="f">Número<input id="number" name="number" required inputMode="numeric" maxLength={20} /></label>
            <label className="f">Piso y depto. (opcional)<input id="floor" name="floor" autoComplete="address-line2" maxLength={40} /></label>
            <label className="f">Localidad<input id="city" name="city" required autoComplete="address-level2" maxLength={80} /></label>
            <label className="f wide">Indicaciones para la entrega (opcional)<textarea id="notes" name="notes" rows={2} maxLength={300} /></label>
          </div>
        )}
        {selected?.modality === 'sucursal' && (
          <div className="fields two">
            <p className="f wide muted small">
              Indicá en qué ciudad y en qué sucursal de Correo Argentino querés retirar tu pedido. Podés buscarla en el{' '}
              <a href="https://www.correoargentino.com.ar/formularios/sucursales" target="_blank" rel="noopener noreferrer">buscador de sucursales de Correo Argentino</a>.
            </p>
            <label className="f">Ciudad o localidad<input id="city" name="city" required autoComplete="address-level2" maxLength={80} placeholder="Ej. Mar del Plata" /></label>
            {agencies && agencies.length > 0 ? (
              <label className="f">Sucursal de retiro
                <select id="agency_code" name="agency_code" required defaultValue="">
                  <option value="" disabled>Elegí una sucursal</option>
                  {agencies.map((a) => <option key={a.code} value={a.code}>{a.name} — {a.address}</option>)}
                </select>
              </label>
            ) : (
              <label className="f">Sucursal de Correo Argentino<input id="agency_note" name="agency_note" required maxLength={200} placeholder="Ej. Sucursal Centro, Av. Luro 2460" /><small>Nombre o dirección de la sucursal.</small></label>
            )}
            <label className="f wide">Detalles o aclaraciones del envío (opcional)<textarea id="notes" name="notes" rows={2} maxLength={300} placeholder="Ej. Si esa sucursal no está disponible, cualquier otra de Mar del Plata" /></label>
          </div>
        )}
      </fieldset>

      <div className="totals" aria-live="polite">
        <div><span>{u(qty)} × {ars(props.price)}</span><span>{ars(items)}</span></div>
        <div><span>Envío</span><span>{selected ? ars(selected.cost) : 'elegí una opción'}</span></div>
        <div className="grand"><span>Total</span><span>{selected ? ars(items + selected.cost) : '—'}</span></div>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      <button className="btn btn-gold btn-wide" type="submit" disabled={busy || !selected}>
        {busy ? 'Registrando tu pedido…' : 'Confirmar pedido'}
      </button>
      <p className="muted small">Al confirmar te mostramos los datos para pagar por transferencia bancaria. Tu pedido queda reservado mientras tanto y se confirma cuando recibimos la transferencia.</p>
    </form>
  );
}
