import type { Metadata } from 'next';
import { getContent } from '@/lib/settings';
import SimpleHeader from '@/components/SimpleHeader';
import RegretForm from '@/components/RegretForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Botón de arrepentimiento · SCHERZANDO.AR', alternates: { canonical: '/arrepentimiento' } };

export default async function Arrepentimiento() {
  const c = await getContent();
  return (
    <>
      <SimpleHeader name={c.brand.name} />
      <main className="page status">
        <h1>Botón de arrepentimiento</h1>
        <p>
          Podés revocar tu compra dentro de los <strong>10 días corridos</strong> desde que recibiste el producto o desde que hiciste la compra,
          lo último que ocurra, sin costo y sin dar explicaciones (art. 34 de la Ley 24.240 y Resolución 424/2020).
        </p>
        <p>Completá el formulario. Te enviamos por correo un código que identifica tu pedido de arrepentimiento y nos comunicamos para coordinar la devolución.</p>
        <RegretForm />
      </main>
    </>
  );
}
