import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase';
import { addressLine, orderRef, type Order } from '@/lib/orders';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas al abrir en Excel o Numbers
  return `"${s.replace(/"/g, '""')}"`;
};

/** Planilla de ventas (CSV) para abrir en Excel o Numbers. */
export async function GET() {
  if (!(await isAdmin())) return new Response('No autorizado', { status: 401 });
  const { data } = await db().from('orders').select('*').order('created_at', { ascending: false }).limit(10000);
  const head = ['Pedido', 'Fecha', 'Estado del pago', 'Envío', 'Nombre', 'Apellido', 'DNI', 'Correo', 'Teléfono', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Opción de envío', 'Costo de envío', 'Total', 'Entrega', 'Detalles del envío', 'Seguimiento'];
  const rows = ((data ?? []) as Order[]).map((o) => [
    orderRef(o), o.created_at, o.status, o.fulfillment_status, o.first_name, o.last_name, o.dni, o.email, o.phone,
    o.product_name ?? 'Mazo', o.quantity, o.unit_price, o.items_total, o.shipping_label, o.shipping_cost, o.total, addressLine(o), o.address.notes ?? '', o.tracking,
  ]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ventas-scherzando-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' },
  });
}
