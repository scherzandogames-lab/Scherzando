'use client';
import { useState } from 'react';
import { track } from './MetaPixel';

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

/** Selector de cantidad y botón de compra. Los importes definitivos los calcula siempre el servidor. */
export default function BuyBox(props: {
  price: number | null;
  max: number;
  enabled: boolean;
  reason: string | null;
  cta: string;
}) {
  const [qty, setQty] = useState(1);
  const max = Math.max(1, props.max);
  return (
    <div className="buybox">
      <div className="qty" role="group" aria-label="Cantidad de mazos">
        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Uno menos">−</button>
        <output aria-live="polite">{qty} {qty === 1 ? 'mazo' : 'mazos'}</output>
        <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Uno más">+</button>
      </div>
      {props.price !== null && (
        <p className="buybox-subtotal">
          Subtotal <strong>{ars(props.price * qty)}</strong>
          <span>+ envío por Correo Argentino, que elegís en el paso siguiente</span>
        </p>
      )}
      {props.enabled ? (
        <a className="btn btn-gold btn-wide" href={`/comprar?cantidad=${qty}`}
          onClick={() => track('InitiateCheckout', { num_items: qty, currency: 'ARS', value: (props.price ?? 0) * qty })}>
          {props.cta}
        </a>
      ) : (
        <>
          <button className="btn btn-gold btn-wide" type="button" disabled>{props.cta}</button>
          {props.reason && <p className="buybox-note">{props.reason}</p>}
        </>
      )}
    </div>
  );
}
