'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Vuelve a consultar el estado cada pocos segundos mientras el pago está pendiente. */
export default function AutoRefresh({ every = 4000, times = 30 }: { every?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > times) return clearInterval(t);
      router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every, times]);
  return null;
}
