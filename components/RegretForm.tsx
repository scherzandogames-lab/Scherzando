'use client';
import { useState } from 'react';

export default function RegretForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/arrepentimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries())),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No pudimos registrar el pedido. Probá de nuevo.');
      setDone(j.code);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="okmsg">
        Registramos tu pedido de arrepentimiento. Tu código es <strong className="sel">{done}</strong>. También te lo enviamos por correo.
      </div>
    );

  return (
    <form className="checkout" onSubmit={onSubmit}>
      <div className="hp" aria-hidden="true"><label>No completar <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="fields two">
        <label className="f">Número de pedido<input id="order" name="order" required placeholder="Ej. S-0012" maxLength={12} /></label>
        <label className="f">Correo usado en la compra<input id="email" name="email" type="email" required autoComplete="email" maxLength={160} /></label>
        <label className="f">Nombre y apellido<input id="name" name="name" required autoComplete="name" maxLength={120} /></label>
        <label className="f">Teléfono (opcional)<input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        <label className="f wide">Comentario (opcional)<textarea id="comment" name="comment" rows={3} maxLength={1000} /></label>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      <button className="btn btn-gold btn-wide" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar pedido de arrepentimiento'}</button>
    </form>
  );
}
