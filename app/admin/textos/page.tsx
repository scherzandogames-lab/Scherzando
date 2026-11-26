import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getContent } from '@/lib/settings';
import AdminNav from '@/components/admin/AdminNav';
import { saveTexts } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Textos · SCHERZANDO', robots: { index: false } };

const T = ({ name, label, value, rows = 1, hint }: { name: string; label: string; value: string; rows?: number; hint?: string }) => (
  <label className="f">
    {label}
    {rows > 1 ? <textarea name={name} rows={rows} defaultValue={value} /> : <input name={name} defaultValue={value} />}
    {hint && <small>{hint}</small>}
  </label>
);

export default async function Textos({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (!(await isAdmin())) redirect('/admin');
  const { ok } = await searchParams;
  const c = await getContent();
  const specs = [...c.specs, ...Array(10).fill({ label: '', value: '' })].slice(0, 10);
  const faq = [...c.faq, ...Array(14).fill({ q: '', a: '' })].slice(0, 14);

  return (
    <main className="adm">
      <AdminNav on="textos" />
      <form action={saveTexts} className="adm-wrap adm-form">
        <h1>Textos de la página</h1>
        {ok && <p className="okmsg">Cambios guardados y publicados.</p>}

        <h2>Portada</h2>
        <T name="hero_eyebrow" label="Línea chica de arriba" value={c.hero.eyebrow} />
        <T name="hero_title" label="Título" value={c.hero.title} />
        <T name="hero_tagline" label="Frase" value={c.hero.tagline} rows={2} />
        <T name="hero_cta" label="Texto del botón de compra" value={c.hero.cta} />
        <T name="taglineOptions" label="Frases alternativas (una por línea, para tener a mano)" value={c.taglineOptions.join('\n')} rows={4} />

        <h2>El universo Scherzando</h2>
        <T name="universe_title" label="Título" value={c.universe.title} />
        <T name="universe_paragraphs" label="Texto" value={c.universe.paragraphs.join('\n\n')} rows={7} hint="Dejá una línea en blanco entre párrafos. El primero se destaca." />

        <h2>Las cartas</h2>
        <T name="cards_title" label="Título" value={c.cards.title} />
        <T name="cards_intro" label="Introducción" value={c.cards.intro} rows={2} />
        <T name="cards_jokerTitle" label="Título de la carta especial" value={c.cards.jokerTitle} />
        <T name="cards_jokerText" label="Texto de la carta especial" value={c.cards.jokerText} rows={2} />
        <T name="cards_backsNote" label="Nota sobre los reversos" value={c.cards.backsNote} hint="Dejalo vacío cuando agregues las fotos del reverso." />

        <h2>La caja</h2>
        <T name="box_title" label="Título" value={c.box.title} />
        <T name="box_text" label="Texto" value={c.box.text} rows={3} />

        <h2>El producto</h2>
        <T name="product_title" label="Título" value={c.product.title} />
        <T name="product_description" label="Descripción definitiva" value={c.product.description} rows={5} />
        <T name="product_rules" label="Reglas o modos de uso" value={c.product.rules} rows={5} />
        <T name="product_maker" label="Información del fabricante" value={c.product.maker} rows={3} />

        <h2>Qué incluye</h2>
        <p className="muted">Sólo se muestran las filas con valor. Para quitar una fila, borrá su nombre.</p>
        <div className="adm-table">
          {specs.map((sp, i) => (
            <div className="adm-row two" key={i}>
              <input name={`spec_${i}_label`} defaultValue={sp.label} placeholder="Característica" aria-label="Característica" />
              <input name={`spec_${i}_value`} defaultValue={sp.value} placeholder="Valor (vacío = no se muestra)" aria-label="Valor" />
            </div>
          ))}
        </div>

        <h2>Envíos</h2>
        <T name="shipping_intro" label="Introducción" value={c.shipping.intro} rows={2} />
        <T name="shipping_dispatchInfo" label="Qué pasa al despachar" value={c.shipping.dispatchInfo} rows={2} />

        <h2>Preguntas frecuentes</h2>
        {faq.map((f, i) => (
          <div className="adm-faq" key={i}>
            <input name={`faq_${i}_q`} defaultValue={f.q} placeholder="Pregunta" aria-label={`Pregunta ${i + 1}`} />
            <textarea name={`faq_${i}_a`} defaultValue={f.a} rows={2} placeholder="Respuesta" aria-label={`Respuesta ${i + 1}`} />
          </div>
        ))}

        <h2>Cierre</h2>
        <T name="closing_title" label="Título" value={c.closing.title} />
        <T name="closing_text" label="Texto" value={c.closing.text} />

        <h2>Google, redes e Instagram</h2>
        <T name="seo_title" label="Título para Google y al compartir" value={c.seo.title} />
        <T name="seo_description" label="Descripción para Google y al compartir" value={c.seo.description} rows={3} />
        <T name="instagram" label="Usuario de Instagram (sin @)" value={c.brand.instagram} />

        <div className="adm-save"><button className="btn btn-gold" type="submit">Guardar y publicar</button></div>
      </form>
    </main>
  );
}
