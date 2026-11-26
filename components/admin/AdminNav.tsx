import Link from 'next/link';
import { logout } from '@/app/admin/actions';

const TABS = [
  ['inicio', '/admin', 'Inicio'],
  ['pedidos', '/admin/pedidos', 'Ventas'],
  ['productos', '/admin/productos', 'Productos'],
  ['tienda', '/admin/tienda', 'Pagos y envíos'],
  ['textos', '/admin/textos', 'Textos'],
  ['fotos', '/admin/fotos', 'Fotos'],
] as const;

export default function AdminNav({ on }: { on: (typeof TABS)[number][0] }) {
  return (
    <header className="adm-nav">
      <strong>SCHERZANDO · Panel</strong>
      <nav>
        {TABS.map(([k, href, label]) => (
          <Link key={k} href={href} className={on === k ? 'on' : ''}>{label}</Link>
        ))}
      </nav>
      <div className="adm-nav-end">
        <a href="/" target="_blank" rel="noopener">Ver tienda ↗</a>
        <form action={logout}><button type="submit">Salir</button></form>
      </div>
    </header>
  );
}
