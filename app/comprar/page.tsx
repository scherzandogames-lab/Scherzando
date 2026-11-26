import type { Metadata } from 'next';
import Image from 'next/image';
import { getContent } from '@/lib/settings';
import { saleStatus, transferRows } from '@/lib/orders';
import { formatARS, productById, photoSize } from '@/lib/content';
import { PROVINCES } from '@/lib/micorreo';
import CheckoutForm from '@/components/CheckoutForm';
import SimpleHeader from '@/components/SimpleHeader';
import LegalFooter from '@/components/LegalFooter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Comprar · SCHERZANDO.AR', alternates: { canonical: '/comprar' } };

type SP = { searchParams: Promise<{ cantidad?: string; producto?: string }> };

export default async function Comprar({ searchParams }: SP) {
  const { cantidad, producto } = await searchParams;
  const c = await getContent();
  const product = productById(c, producto) ?? productById(c, null)!;
  const st = await saleStatus(c, product.id);
  return (
    <>
      <SimpleHeader name={c.brand.name} />
      <main className="page">
        <div className="page-grid">
          <aside className="page-aside">
            <Image src={product.image} alt={product.name} width={photoSize(product.image).w} height={photoSize(product.image).h} sizes="(max-width: 900px) 40vw, 320px" priority />
            <div>
              <h1>{product.name}</h1>
              {product.description && <p className="muted">{product.description}</p>}
              {product.price !== null && <p className="page-price">{formatARS(product.price)} <span>por {product.unit[0]}</span></p>}
            </div>
            {transferRows(c).length > 0 && (
              <div className="pay-box">
                <p className="pay-title">Pagás por transferencia a esta cuenta</p>
                <dl>{transferRows(c).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="sel">{v}</dd></div>)}</dl>
                <p className="muted small">Al confirmar el pedido te mostramos el importe exacto, con el envío incluido.</p>
              </div>
            )}
          </aside>
          <section className="page-main">
            {st.ok ? (
              <CheckoutForm productId={product.id} unit={product.unit} price={product.price!} max={Math.min(product.maxPerOrder, st.stock ?? 1)} initialQty={Number(cantidad) || 1}
                provinces={PROVINCES.map((p) => p.name)} />
            ) : (
              <>
                <h2>{st.label}</h2>
                <p>{st.reason}</p>
                <a className="btn btn-gold" href="/">Volver</a>
              </>
            )}
          </section>
        </div>
      </main>
      <footer className="footer"><LegalFooter c={c} /></footer>
    </>
  );
}
