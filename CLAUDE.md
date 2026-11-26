# Tienda SCHERZANDO.AR

Tienda online del mazo de cartas SCHERZANDO.AR («una baraja española, pero de música clásica»).
La administran Javier y Lourdes, que **no programan**: hablales en español sencillo, de a un paso
por vez, con enlaces directos, y ejecutá vos todos los comandos.

## Cómo funciona

- **Sitio:** Next.js 15 (App Router) publicado en Netlify → https://scherzando.netlify.app
- **Base de datos:** Supabase, proyecto `scherzando` (región São Paulo), propio de Scherzando.
  Tablas: `settings` (todo el contenido editable en una fila JSON), `inventory` (stock por producto),
  `orders` (pedidos), `event_log` (registro de errores). RLS activado: sólo el servidor accede.
  El esquema está en `supabase/schema.sql`.
- **Cobro:** por **transferencia bancaria** (CBU/alias cargados en el panel). No hay pasarela de pago:
  no agregar Mercado Pago ni otra sin que lo pidan.
  El pedido reserva stock por 48 h; el administrador confirma la transferencia desde el panel.
- **Envíos:** Correo Argentino. Tarifas fijas por zona cargadas en el panel (CABA y GBA / Provincias).
  `lib/micorreo.ts` tiene la integración con la API MiCorreo lista, inactiva hasta que Correo
  Argentino entregue credenciales (variables `MICORREO_USER`, `MICORREO_PASSWORD`, `MICORREO_CUSTOMER_ID`).
- **Correo:** Gmail de scherzandogames@gmail.com con contraseña de aplicación (SMTP).
  Los avisos de pedidos llegan a scherzandogames@gmail.com.
- **Panel:** https://scherzando.netlify.app/admin (contraseña en la variable `ADMIN_PASSWORD` de Netlify).
  Secciones: Inicio, Ventas, Productos, Pagos y envíos, Textos, Fotos.

## Reglas

- Todo lo que se pueda cambiar desde el panel se cambia desde el panel, no en el código.
- No inventar datos del producto (cantidad de cartas, medidas, materiales, reglas), precios ni tarifas.
- Las fotos de `public/fotos` son las originales del producto: no se alteran.
- Nunca escribir claves en el código ni pedirlas por el chat: viven en las variables de entorno de Netlify.
- Antes de publicar, `npm run build` tiene que terminar sin errores.
- Los cambios van a una rama y se publican al unirlos a `main` (Netlify publica `main` automáticamente).

## Estructura

```
app/page.tsx              Página de venta
app/comprar/              Formulario de compra
app/gracias/              Datos para transferir y estado del pedido
app/admin/                Panel (ventas, productos, pagos y envíos, textos, fotos)
app/api/                  Pedidos, cotización de envíos, subida de fotos, planilla CSV
lib/content.ts            Contenido editable y valores iniciales
lib/orders.ts             Pedidos, stock, correos
lib/shipping.ts           Cálculo del envío
components/               Piezas visuales
supabase/schema.sql       Esquema de la base de datos
```
