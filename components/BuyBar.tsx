'use client';
import { useEffect, useState } from 'react';

/** Barra fija de compra en el celular: aparece al dejar atrás la portada y se oculta en la sección de compra. */
export default function BuyBar({ label, price }: { label: string; price: string | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('portada');
    const buy = document.getElementById('comprar');
    let heroOut = false;
    let buyIn = false;
    const update = () => setShow(heroOut && !buyIn);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) heroOut = !e.isIntersecting;
        if (e.target === buy) buyIn = e.isIntersecting;
      }
      update();
    });
    if (hero) io.observe(hero);
    if (buy) io.observe(buy);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`buybar${show ? ' is-visible' : ''}`} aria-hidden={!show}>
      <span className="buybar-price">{price ?? 'SCHERZANDO.AR'}</span>
      <a href="#comprar" className="btn btn-gold" tabIndex={show ? 0 : -1}>{label}</a>
    </div>
  );
}
