'use client';
import { useEffect, useState } from 'react';

type Branch = { code: string; name: string; street: string; locality: string; postalCode: string; hours: string[]; distanceKm: number | null; approx?: boolean };

const dist = (b: Branch) =>
  b.distanceKm === null ? '' : b.approx && b.distanceKm < 3 ? ' · en tu localidad' : ` · a ${b.distanceKm.toLocaleString('es-AR')} km aprox.`;

/**
 * Sucursales oficiales de Correo Argentino cercanas al comprador, dentro del checkout.
 * Si la integración todavía no está activa (sin credenciales), deja escribir la sucursal a mano:
 * nunca se muestran sucursales inventadas.
 */
export default function BranchPicker(props: { province: string; zip: string; locality: string }) {
  const [qZip, setQZip] = useState(props.zip);
  const [qLoc, setQLoc] = useState(props.locality);
  const [state, setState] = useState<{ loading: boolean; enabled: boolean | null; branches: Branch[]; error: string }>({ loading: false, enabled: null, branches: [], error: '' });
  const [chosen, setChosen] = useState<Branch | null>(null);

  async function search(zip: string, loc: string) {
    if (!props.province) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const r = await fetch(`/api/envio/sucursales?provincia=${encodeURIComponent(props.province)}&cp=${encodeURIComponent(zip)}&localidad=${encodeURIComponent(loc)}`);
      const j = await r.json();
      setState({ loading: false, enabled: j.enabled, branches: j.branches ?? [], error: '' });
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'No pudimos consultar las sucursales. Probá de nuevo.' }));
    }
  }

  // Busca sola al llegar con código postal y provincia, y cuando cambian.
  useEffect(() => {
    setQZip(props.zip);
    setQLoc(props.locality);
    setChosen(null);
    search(props.zip, props.locality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.province, props.zip]);

  if (state.enabled === false)
    return (
      <label className="f wide">Sucursal de Correo Argentino
        <input id="agency_note" name="agency_note" required maxLength={200} placeholder="Nombre o dirección de la sucursal donde querés retirar" />
        <small>Escribí la sucursal de tu localidad donde querés retirar el pedido.</small>
      </label>
    );

  return (
    <div className="branches wide">
      <input type="hidden" name="agency_code" value={chosen?.code ?? ''} />
      <p className="branches-title">Elegí la sucursal de Correo Argentino donde querés retirar</p>
      <div className="branches-search" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setChosen(null); search(qZip, qLoc); } }}>
        <label className="f">Código postal<input value={qZip} onChange={(e) => setQZip(e.target.value)} inputMode="numeric" maxLength={10} aria-label="Código postal para buscar sucursales" /></label>
        <label className="f">Localidad, barrio o una dirección<input value={qLoc} onChange={(e) => setQLoc(e.target.value)} maxLength={80} aria-label="Localidad, barrio o dirección para buscar sucursales" placeholder="Ej. Palermo o Av. Santa Fe 3000" /></label>
        <button type="button" className="btn-sm" onClick={() => { setChosen(null); search(qZip, qLoc); }}>Buscar sucursales</button>
      </div>
      {state.loading && <p className="muted">Buscando sucursales…</p>}
      {state.error && <p className="alert">{state.error}</p>}
      {chosen ? (
        <div className="branch chosen">
          <div>
            <p className="branch-name">✓ {chosen.name}</p>
            {chosen.street !== chosen.name && <p>{chosen.street}</p>}
            <p className="muted">{chosen.locality}{chosen.postalCode ? ` · CP ${chosen.postalCode}` : ''} · código {chosen.code}</p>
            {chosen.hours.map((h) => <p key={h} className="small muted">{h}</p>)}
          </div>
          <button type="button" className="btn-sm" onClick={() => setChosen(null)}>Cambiar sucursal</button>
        </div>
      ) : (
        !state.loading && state.enabled && (
          state.branches.length ? (
            <div className="branch-list">
              {state.branches.map((b) => (
                <div className="branch" key={b.code}>
                  <div>
                    <p className="branch-name">{b.name}</p>
                    {b.street !== b.name && <p>{b.street}</p>}
                    <p className="muted">{b.locality}{b.postalCode ? ` · CP ${b.postalCode}` : ''}{dist(b)}</p>
                    <p className="small muted">Código de sucursal {b.code}</p>
                    {b.hours.map((h) => <p key={h} className="small muted">{h}</p>)}
                  </div>
                  <button type="button" className="btn btn-gold" onClick={() => setChosen(b)}>Seleccionar esta sucursal</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No encontramos sucursales de retiro para esa búsqueda. Probá con otra localidad o código postal.</p>
          )
        )
      )}
    </div>
  );
}
