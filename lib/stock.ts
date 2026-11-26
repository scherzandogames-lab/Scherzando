import 'server-only';
import { db, hasDb } from './supabase';
import { logEvent } from './log';

export const SKU = 'mazo';

/** Unidades disponibles para vender (null si la base todavía no está conectada). */
export async function getStock(sku: string = SKU): Promise<number | null> {
  if (!hasDb()) return null;
  const { data, error } = await db().from('inventory').select('available').eq('sku', sku).maybeSingle();
  if (error) {
    console.error('[stock]', error.message);
    return null;
  }
  return data ? Number(data.available) : 0;
}

export async function setStock(n: number, sku: string = SKU) {
  const { error } = await db().from('inventory').upsert({ sku, available: Math.max(0, Math.floor(n)), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/**
 * Devuelve al stock las unidades de pedidos que no se pagaron a tiempo.
 * Se ejecuta antes de cada compra nueva y al abrir el panel.
 */
export async function releaseExpired() {
  if (!hasDb()) return;
  const { data } = await db()
    .from('orders')
    .select('id')
    .eq('status', 'pendiente')
    .eq('stock_reserved', true)
    .lt('reserved_until', new Date().toISOString())
    .limit(50);
  for (const o of data ?? []) {
    const { data: freed } = await db().rpc('liberar_stock', { p_order: o.id });
    if (freed) {
      await db().from('orders').update({ status: 'vencido', updated_at: new Date().toISOString() }).eq('id', o.id).eq('status', 'pendiente');
      await logEvent('info', 'stock', 'Reserva vencida sin pago: se devolvió el stock', o.id);
    }
  }
}

/** Stock de varios productos a la vez. */
export async function getStocks(): Promise<Record<string, number>> {
  if (!hasDb()) return {};
  const { data } = await db().from('inventory').select('sku, available');
  return Object.fromEntries((data ?? []).map((r) => [r.sku as string, Number(r.available)]));
}
