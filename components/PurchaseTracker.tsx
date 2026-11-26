'use client';
import { useEffect } from 'react';
import { track } from './MetaPixel';

/** Registra la compra en Meta Pixel una sola vez por pedido. */
export default function PurchaseTracker({ value, orderId }: { value: number; orderId: string }) {
  useEffect(() => {
    const key = `compra-${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    track('Purchase', { value, currency: 'ARS' });
  }, [value, orderId]);
  return null;
}
