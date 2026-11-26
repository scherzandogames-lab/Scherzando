import Image from 'next/image';
import { getContent } from '@/lib/settings';
import { siteOrigin } from '@/lib/origin';
import { saleStatus } from '@/lib/orders';
import { PHOTOS, formatARS, MODALITY_LABEL, photoSize, photoAlt, productsOf } from '@/lib/content';
import { getStocks } from '@/lib/stock';
import Gallery from '@/components/Gallery';
import BuyBar from '@/components/BuyBar';
import BuyBox from '@/components/BuyBox';
import Share from '@/components/Share';

export const dynamic = 'force-dynamic';

const Tempo = ({ n, word }: { n: string; word: string }) => (
  <p className="tempo"><span>{n}</span> {word}</p>
);

export default async function Home() {
  const c = await getContent();
  const site = await siteOrigin();
  const av = await saleStatus(c);
  const stocks = await getStocks();
  const extras = productsOf(c).slice(1).filter((p) => p.price !== null);
  const price = c.sale.price !== null ? formatARS(c.sale.price) : null;
  const ig = `https://instagram.com/${c.brand.instagram}`;
  const specsFilled = c.specs.some((s) => s.value.trim());
  const productFilled = !!(c.product.description || c.product.rules || c.product.maker);
  const zones = [...new Set(c.shipping.options.map((o) => o.zone))];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: c.brand.name,
    description: c.seo.description,
    brand: { '@type': 'Brand', name: c.brand.name },
    image: [c.photos.hero, c.photos.box, PHOTOS.joker.src, PHOTOS.fan.src].map((p) => (p.startsWith('http') ? p : site + p)),
    ...(c.sale.price !== null && av.stock !== null
      ? {
          offers: {
            '@type': 'Offer',
            price: c.sale.price,
            priceCurrency: 'ARS',
            availability: av.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `${site}/#comprar`,
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <header className="topbar">
        <a href="#portada" className="topbar-brand" aria-label="SCHERZANDO.AR, inicio">
          <Image src="/marca/monograma.png" alt="" width={36} height={36} priority />
          <span>{c.brand.name}</span>
        </a>
        <nav aria-label="Secciones">
          <a href="#cartas">Cartas</a>
          <a href="#caja">Caja</a>
          <a href="#envios">Envíos</a>
          <a href="#comprar" className="topbar-buy">Comprar</a>
        </nav>
      </header>

      <main>
        {/* 1 · PORTADA */}
        <section id="portada" className="hero">
          <div className="hero-text">
            <Image className="hero-mono" src="/marca/monograma.png" alt="" width={320} height={320} priority />
            <p className="hero-eyebrow">{c.hero.eyebrow}</p>
            <h1>{c.hero.title}</h1>
            <p className="hero-tagline">{c.hero.tagline}</p>
            <div className="hero-actions">
              <a href="#comprar" className="btn btn-gold">{c.hero.cta}</a>
              {price && <span className="hero-price">{price}</span>}
            </div>
          </div>
          <figure className="hero-photo">
            <Image src={c.photos.hero} alt={photoAlt(c.photos.hero, 'Caja y cartas de SCHERZANDO.AR')} width={photoSize(c.photos.hero).w} height={photoSize(c.photos.hero).h}
              sizes="(max-width: 900px) 100vw, 46vw" priority />
          </figure>
          <div className="hero-medallion" aria-hidden="true">
            <Image src="/marca/medallon.jpg" alt="" width={1080} height={610} sizes="(max-width: 900px) 100vw, 900px" />
          </div>
        </section>

        {/* 2 · EL UNIVERSO SCHERZANDO */}
        <section className="universe">
          <Tempo n="I" word="Scherzando" />
          <h2>{c.universe.title}</h2>
          <div className="universe-grid">
            <div className="universe-text">
              {c.universe.paragraphs.map((p, i) => <p key={i} className={i === 0 ? 'lede' : undefined}>{p}</p>)}
            </div>
            <figure className="universe-photo">
              <Image src={PHOTOS.boxOpen.src} alt={PHOTOS.boxOpen.alt} width={PHOTOS.boxOpen.w} height={PHOTOS.boxOpen.h}
                sizes="(max-width: 900px) 100vw, 40vw" />
            </figure>
          </div>
        </section>

        {/* 3 · LAS CARTAS */}
        <section id="cartas" className="cards">
          <Tempo n="II" word="Allegro" />
          <h2>{c.cards.title}</h2>
          <p className="section-intro">{c.cards.intro}</p>
          <Gallery items={c.photos.gallery.map((g) => ({ photo: { src: g.src, alt: g.alt || g.caption, ...photoSize(g.src) }, caption: g.caption }))} />
          <p className="swipe-hint" aria-hidden="true">Deslizá para ver más →</p>
          <div className="joker">
            <figure>
              <Image src={PHOTOS.jokers.src} alt={PHOTOS.jokers.alt} width={PHOTOS.jokers.w} height={PHOTOS.jokers.h}
                sizes="(max-width: 900px) 100vw, 45vw" />
            </figure>
            <div>
              <h3>{c.cards.jokerTitle}</h3>
              <p>{c.cards.jokerText}</p>
              {c.cards.backsNote && <p className="note">{c.cards.backsNote}</p>}
            </div>
          </div>
        </section>

        {/* 4 · LA CAJA */}
        <section id="caja" className="box">
          <Tempo n="III" word="Maestoso" />
          <h2>{c.box.title}</h2>
          <div className="box-grid">
            <figure className="box-main">
              <Image src={c.photos.box} alt={photoAlt(c.photos.box, 'Caja de SCHERZANDO.AR')} width={photoSize(c.photos.box).w} height={photoSize(c.photos.box).h}
                sizes="(max-width: 900px) 100vw, 50vw" />
            </figure>
            <div className="box-side">
              <p>{c.box.text}</p>
              <figure>
                <Image src={PHOTOS.boxFront2.src} alt={PHOTOS.boxFront2.alt} width={PHOTOS.boxFront2.w} height={PHOTOS.boxFront2.h}
                  sizes="(max-width: 900px) 100vw, 30vw" />
              </figure>
            </div>
          </div>
        </section>

        {/* 5 · EL PRODUCTO  ·  6 · QUÉ INCLUYE */}
        <section className="product">
          <Tempo n="IV" word="Andante" />
          <h2>{c.product.title}</h2>
          {productFilled ? (
            <div className="product-text">
              {c.product.description && <p>{c.product.description}</p>}
              {c.product.rules && (<><h3>Cómo se usa</h3><p>{c.product.rules}</p></>)}
              {c.product.maker && (<><h3>Fabricación</h3><p>{c.product.maker}</p></>)}
            </div>
          ) : (
            <p className="pending">Una baraja española, pero de música clásica. Muy pronto, todos los detalles.</p>
          )}
          <h3 className="specs-title">Qué incluye</h3>
          {specsFilled ? (
            <dl className="specs">
              {c.specs.filter((s) => s.value.trim()).map((s) => (
                <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
              ))}
            </dl>
          ) : (
            <p className="pending">Las características técnicas se publican en breve.</p>
          )}
        </section>

        {/* 7 · COMPRA */}
        <section id="comprar" className="buy">
          <Tempo n="V" word="Vivace" />
          <div className="buy-grid">
            <figure>
              <Image src={PHOTOS.boxFront.src} alt={PHOTOS.boxFront.alt} width={PHOTOS.boxFront.w} height={PHOTOS.boxFront.h}
                sizes="(max-width: 900px) 80vw, 36vw" />
            </figure>
            <div className="buy-info">
              <h2>{c.brand.name}</h2>
              <p className="buy-sub">{c.hero.eyebrow}, {c.hero.title.toLowerCase()}</p>
              <p className="buy-price">{price ?? 'Precio a confirmar'}</p>
              {price && <p className={`buy-stock${av.ok ? ' ok' : ''}`}>{av.label}</p>}
              <BuyBox price={c.sale.price} max={Math.min(c.sale.maxPerOrder, av.stock ?? 1)}
                enabled={av.ok} reason={av.reason} cta={c.hero.cta} />
              <p className="buy-secure">Pago por transferencia bancaria · Envío con Correo Argentino</p>
            </div>
          </div>
        </section>

        {extras.length > 0 && (
          <section id="mas" className="more">
            <Tempo n="V bis" word="Da capo" />
            <h2>Más de Scherzando</h2>
            <div className="more-grid">
              {extras.map((p) => {
                const left = stocks[p.id] ?? 0;
                return (
                  <article className="more-card" key={p.id}>
                    <Image src={p.image} alt={p.name} width={photoSize(p.image).w} height={photoSize(p.image).h} sizes="(max-width: 700px) 90vw, 320px" />
                    <div>
                      <h3>{p.name}</h3>
                      {p.description && <p>{p.description}</p>}
                      <p className="price">{formatARS(p.price!)}</p>
                      {left > 0 ? (
                        <a className="btn btn-gold" href={`/comprar?producto=${p.id}`}>Comprar</a>
                      ) : (
                        <p className="muted">Sin stock por el momento</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* 8 · ENVÍOS */}
        <section id="envios" className="shipping">
          <Tempo n="VI" word="Con moto" />
          <h2>Envíos</h2>
          <p className="section-intro">{c.shipping.intro}</p>
          <div className="shipping-table" role="table" aria-label="Costos de envío por Correo Argentino">
            <div role="row" className="shipping-head">
              <span role="columnheader">Zona</span>
              <span role="columnheader">A domicilio</span>
              <span role="columnheader">En sucursal</span>
            </div>
            {zones.map((z) => {
              const cell = (m: 'domicilio' | 'sucursal') => {
                const o = c.shipping.options.find((x) => x.zone === z && x.modality === m);
                if (!o) return '—';
                return o.price !== null ? formatARS(o.price) : 'A confirmar';
              };
              return (
                <div role="row" key={z}>
                  <span role="cell">{z}</span>
                  <span role="cell" data-label={MODALITY_LABEL.domicilio}>{cell('domicilio')}</span>
                  <span role="cell" data-label={MODALITY_LABEL.sucursal}>{cell('sucursal')}</span>
                </div>
              );
            })}
          </div>
          <p className="note">
            Tarifas de Correo Argentino por envío{c.shipping.quotedAt ? `, vigentes al ${c.shipping.quotedAt}` : ''}. El costo del envío se suma al precio del mazo y se paga junto con él.
          </p>
          <p>{c.shipping.dispatchInfo}</p>
        </section>

        {/* 9 · PREGUNTAS FRECUENTES */}
        <section className="faq">
          <Tempo n="VII" word="Rubato" />
          <h2>Preguntas frecuentes</h2>
          <div className="faq-list">
            {c.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 10 · CIERRE */}
        <section className="closing">
          <Image className="closing-mono" src="/marca/monograma.png" alt="" width={200} height={200} />
          <h2>{c.closing.title}</h2>
          <p>{c.closing.text}</p>
          <a href="#comprar" className="btn btn-gold">{c.hero.cta}</a>
          <figure className="closing-photo">
            <Image src={PHOTOS.joker.src} alt={PHOTOS.joker.alt} width={PHOTOS.joker.w} height={PHOTOS.joker.h}
              sizes="(max-width: 900px) 80vw, 420px" />
          </figure>
        </section>
      </main>

      <footer className="footer">
        <Image src="/marca/monograma.png" alt="" width={56} height={56} />
        <p className="footer-brand">{c.brand.name}</p>
        <a href={ig} target="_blank" rel="noopener noreferrer" className="footer-ig">@{c.brand.instagram} en Instagram</a>
        <Share url={site} text="SCHERZANDO.AR · Una baraja española, pero de música clásica." />
      </footer>

      <BuyBar label="Comprar" price={price} />
    </>
  );
}
