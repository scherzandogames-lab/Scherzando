# SCHERZANDO.AR — tienda online

Tienda de venta directa del mazo SCHERZANDO.AR. Misma arquitectura que la tienda de
«Bach y mis 47 pesos» (Next.js + Netlify + Supabase + Mercado Pago Checkout Pro + Gmail),
con datos comerciales **totalmente separados**: proyecto de Supabase propio, aplicación de
Mercado Pago propia y sitio de Netlify propio.

> Repositorio oficial de la tienda: scherzandogames-lab/Scherzando.

## Estado
- [x] Etapa 1 · Diagnóstico de la tienda del libro
- [x] Etapa 2 · Dirección de arte (a partir de las fotografías reales)
- [x] Etapa 3 · Página de venta (10 secciones, móvil primero)
- [x] Etapa 4 · Mercado Pago (checkout con cantidad, datos, envío, reserva de stock y webhook) — falta probar con credenciales de prueba
- [x] Etapa 5 · Correo Argentino: tabla de tarifas por zona (activa) y API MiCorreo (lista, inactiva hasta tener credenciales)
- [x] Etapa 6 · Panel: ventas, despachos y seguimiento, precio, stock, envíos, textos, fotos, planilla CSV, eventos y errores
- [ ] Etapa 7 · Pruebas del circuito completo
- [ ] Etapa 8 · Publicación en Netlify y manual de administración

## Reglas de contenido
- Las fotografías de `public/fotos` son las originales del producto: no se alteran.
- `public/marca` contiene recortes del monograma y del medallón tomados de las piezas de
  Instagram; se reemplazarán por los archivos originales cuando estén disponibles.
- Lo que no está confirmado (cantidad de cartas, medidas, materiales, reglas, precio,
  stock, tarifas de envío) queda vacío y la página lo muestra como «a confirmar».

## Correo Argentino
- API MiCorreo (`/token`, `/rates`, `/agencies`, `/shipping/import`): cotiza por código
  postal, lista sucursales e importa envíos a la cuenta de MiCorreo. Requiere credenciales
  que entrega Correo Argentino (distintas del usuario de MiCorreo).
- API PAQ.AR (`/v1/orders`, `/v1/labels`, `/v1/tracking`, `/v1/agencies`): rótulos y
  seguimiento; requiere acuerdo comercial.
- Mientras no haya credenciales, el envío se cobra según la tabla cargada en el panel con
  los importes cotizados en MiCorreo, y los despachos se gestionan a mano en MiCorreo.

## Desarrollo
`npm install`, copiar `.env.example` a `.env.local`, `npm run dev`.
Sin variables de entorno la página funciona con los textos iniciales y la compra deshabilitada.
