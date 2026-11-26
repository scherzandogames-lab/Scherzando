import type { SiteContent } from '@/lib/content';

/** Datos del vendedor y botón de arrepentimiento (Ley 24.240 y Res. 424/2020). */
export default function LegalFooter({ c }: { c: SiteContent }) {
  const s = c.seller;
  return (
    <div className="legal">
      <a className="regret-btn" href="/arrepentimiento">Botón de arrepentimiento</a>
      <p>
        {s.name ? <>Vende: {s.name}{s.cuit ? ` · CUIT ${s.cuit}` : ''}{s.address ? ` · ${s.address}` : ''}<br /></> : null}
        Contacto: <span className="sel">{s.email || 'scherzandogames@gmail.com'}</span>
      </p>
      <p className="small">
        Podés arrepentirte de tu compra dentro de los 10 días corridos desde que la recibiste, sin costo ni explicación (art. 34, Ley 24.240).
        <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer"> Defensa de las y los consumidores</a>.
      </p>
    </div>
  );
}
