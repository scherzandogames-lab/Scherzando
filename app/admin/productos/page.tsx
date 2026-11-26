import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getContent } from '@/lib/settings';
import { getStocks } from '@/lib/stock';
import { PHOTOS } from '@/lib/content';
import AdminNav from '@/components/admin/AdminNav';
import PhotoUpload from '@/components/admin/PhotoUpload';
import { saveProducts } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Productos · SCHERZANDO', robots: { index: false } };

export default async function Productos({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (!(await isAdmin())) redirect('/admin');
  const { ok } = await searchParams;
  const c = await getContent();
  const stocks = await getStocks();
  const photos = [...new Set([...Object.values(PHOTOS).map((p) => p.src), ...c.photos.gallery.map((g) => g.src), ...c.extraProducts.map((p) => p.image).filter(Boolean)])];
  const rows = [...c.extraProducts, null, null];

  return (
    <main className="adm">
      <AdminNav on="productos" />
      <div className="adm-wrap">
        <h1>Productos</h1>
        {ok && <p className="okmsg">Cambios guardados y publicados.</p>}

        <form action={saveProducts} className="adm-form">
          <h2>El mazo (producto principal)</h2>
          <div className="adm-grid">
            <label className="f">Precio ($)<input name="main_price" inputMode="numeric" defaultValue={c.sale.price ?? ''} /></label>
            <label className="f">Unidades en stock<input name="main_stock" inputMode="numeric" defaultValue={stocks.mazo ?? ''} /><small>Se descuenta solo con cada venta.</small></label>
            <label className="f">Máximo por compra<input name="main_max" inputMode="numeric" defaultValue={c.sale.maxPerOrder} /></label>
          </div>

          <h2>Otros productos</h2>
          <p className="muted">Completá una fila para agregar un producto. Aparece en la página, en la sección «Más de Scherzando», con su propio botón de compra. Para sacarlo de la venta sin borrarlo, desmarcá «A la venta».</p>
          {rows.map((p, i) => (
            <fieldset className="adm-product" key={p?.id ?? `nuevo-${i}`}>
              <legend>{p ? p.name : 'Producto nuevo'}</legend>
              <input type="hidden" name={`p_${i}_id`} value={p?.id ?? ''} />
              <div className="adm-grid">
                <label className="f">Nombre<input name={`p_${i}_name`} defaultValue={p?.name ?? ''} placeholder="Ej. Edición especial" /></label>
                <label className="f">Precio ($)<input name={`p_${i}_price`} inputMode="numeric" defaultValue={p?.price ?? ''} /></label>
                <label className="f">Unidades en stock<input name={`p_${i}_stock`} inputMode="numeric" defaultValue={p ? stocks[p.id] ?? 0 : ''} /></label>
                <label className="f">Máximo por compra<input name={`p_${i}_max`} inputMode="numeric" defaultValue={p?.maxPerOrder ?? 5} /></label>
              </div>
              <label className="f">Descripción breve<textarea name={`p_${i}_description`} rows={2} defaultValue={p?.description ?? ''} /></label>
              <label className="f">Foto
                <select name={`p_${i}_image`} defaultValue={p?.image ?? ''}>
                  <option value="">(la foto de la caja)</option>
                  {photos.map((s) => <option key={s} value={s}>{s.split('/').pop()}</option>)}
                </select>
                <small>Para usar una foto nueva, subila primero acá abajo y después elegila en esta lista.</small>
              </label>
              <div className="adm-checks-row">
                <label className="chk"><input type="checkbox" name={`p_${i}_active`} defaultChecked={p ? p.active : true} /> A la venta</label>
                {p && <label className="chk"><input type="checkbox" name={`p_${i}_remove`} /> Eliminar este producto</label>}
              </div>
            </fieldset>
          ))}
          <div className="adm-save"><button className="btn btn-gold" type="submit">Guardar y publicar</button></div>
        </form>

        <h2>Subir una foto para un producto</h2>
        <PhotoUpload />
      </div>
    </main>
  );
}
