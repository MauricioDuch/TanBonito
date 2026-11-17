# Tan Bonito — Plan del sistema de gestión

Sistema web para el negocio de velas artesanales de Jennifer. Reemplaza el Excel actual por
un panel accesible desde la tablet (feria) y la compu, hosteado en la nube.

## Stack

| Capa      | Tecnología                                              |
|-----------|---------------------------------------------------------|
| Server    | Node + Express + TypeScript, `mysql2`, `express-session` (igual que nabi-barber) |
| Client    | React + TypeScript con **Vite** (create-react-app está deprecado) + `react-router-dom` |
| Base      | MySQL 8                                                  |
| Hosting   | VPS básico (~$10.000–12.000 ARS/mes), Express sirve el build del client |

Diferencias con nabi-barber: contraseñas con hash (`bcryptjs`), rutas REST (`/api/supplies`,
`/api/sales/:id`) en vez de rutas planas, y la UI pensada primero para tablet.

## Fases

### Fase 1 — MVP (esta base)
- [x] Login usuario/contraseña (sesión 12 h).
- [x] **Proveedores**: alta, edición, baja.
- [x] **Insumos**: producto, unidad, cantidad del envase, precio del envase, proveedor.
      El **precio unitario se calcula solo** (`precio envase / cantidad envase`, p. ej. $/g de cera de soja).
- [x] **Productos + recetas**: cada producto tiene ingredientes (insumo + cantidad), mano de obra y packaging.
      Costo = insumos + mano de obra + packaging + gastos fijos prorrateados. Precio sugerido = costo × (1 + margen).
- [x] **Aromas**: fijos y de temporada; se activan/desactivan para que aparezcan en el desplegable de ventas.
- [x] **Ventas**: fecha, producto, aroma, cantidad, precio unitario, total, medio de pago
      (efectivo, Mercado Pago, tarjeta, transferencia) y canal (feria / online). Carga rápida pensada para los lunes.
- [x] **Compras**: fecha, insumo, cantidad, precio, proveedor. Opción de actualizar el precio del insumo con la compra.
- [x] **Gastos fijos**: luz, gas, etc. (monto mensual). Se prorratean por las unidades estimadas al mes (configurable).
- [x] **Recetas** en su propia solapa (crear, editar, borrar) y **Crear** en Productos: aplica la receta, descuenta insumos y avisa qué falta.
- [x] **Stock** de productos terminados por aroma (secciones por producto) e insumos. Ventas descuentan, compras suman.
      El stock nunca queda negativo: no se puede vender más de lo que hay (validado en servidor y base de datos).
- [x] **Velas y aromas** separados en Productos y Recetas (comparten insumos).
- [x] **Estadísticas por rango de fechas**: ingresos, unidades, top productos, top aromas, desglose por canal y medio de pago.

### Fase 2 — Clientes y retención
- Base de clientes (nombre, mail, teléfono, fecha de nacimiento).
- Página pública de registro + **QR para el puesto de feria** (descuento 20–30 % por registrarse).
- Mensajes de cumpleaños con descuento:
  - Mail (gratis, vía SMTP).
  - WhatsApp: reutilizar el servicio Baileys de nabi-barber para una base chica, o WhatsApp Business API
    (tiene costo por mensaje; **pendiente revisar precios actuales de Meta**).

### Fase 3 — Extras
- Tienda online propia (catálogo, carrito, Mercado Pago Checkout) como alternativa a Tienda Nube.
- Facturación ARCA (monotributo, factura C) con un botón desde la venta — vía web service WSFE
  con certificado digital de Jennifer.
- Exportar a Excel (`exceljs`, como en nabi-barber).

## Pendientes de Jennifer
- ~~Paleta de colores~~ ✓ aplicada (`client/src/index.css`, variables `--brand-*`). Logo ✓ (`client/public/logo.png`).
- **Excel actual** con todas las pestañas → validar campos y fórmulas de costeo antes de cargar datos reales.

## Checklist para pasar a producción
- [ ] **No reutilizar las credenciales de desarrollo** (`tanbonito`/`tanbonito`, `root`/`root`, login `jennifer`/`tanbonito`).
- [ ] Crear `.env` en el servidor desde `.env.example` con `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `SESSION_SECRET` y `ADMIN_PASSWORD` nuevos, largos y generados.
- [ ] Contraseña de Jennifer distinta a la de desarrollo (se crea al primer arranque desde `ADMIN_USER`/`ADMIN_PASSWORD`).
- [ ] HTTPS con Caddy delante y `COOKIE_SECURE=true`; MySQL sin puerto expuesto (ya es así en `docker-compose.prod.yml`).
- [ ] Probar el backup (`mysqldump`, ver README) antes de cargar datos reales.

## Modelo de datos

Ver [`server/db/migrations/`](../server/db/migrations/).

```
suppliers ─┬─< supplies ─< recipe_items >─ products ─< sales >─ scents
           └─< purchases >─ supplies
fixed_expenses, settings (margen, unidades/mes), users
```
