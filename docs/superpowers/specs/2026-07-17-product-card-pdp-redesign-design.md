# Rediseño de ProductCard y ficha de producto (PDP)

**Fecha:** 2026-07-17
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El usuario relevó varias webs de la competencia (otras marcas de suplementos/hongos
funcionales) y quiere incorporar mejoras puntuales a la tienda sin romper la
experiencia de compra actual ni la estética de marca (paleta, tipografía,
radios de borde, tono "calma").

De las 4 ideas traídas, esta spec cubre las **primeras dos** (bajo riesgo,
reutilizan componentes existentes). Las otras dos quedan para specs futuras:

- **Fuera de alcance de esta spec:** sección de FAQ tipo acordeón (spec futura).
- **Fuera de alcance de esta spec:** opción de suscripción mensual con cobro
  recurrente vía Mercado Pago (spec futura — requiere integrar el producto de
  pagos recurrentes/preapproval de MP, portal de cancelación, manejo de
  reintentos; se decidió explícitamente ir por el camino de cobro real, no
  una intención manual).

## 1. Modelo de datos

Dos campos nuevos en el producto, **ambos opcionales** — no rompen productos
existentes que no los tengan cargados.

| Campo | Tipo | Uso |
|---|---|---|
| `beneficios` | `string[]` (máx. 3 recomendado) | Bullets de venta cortos en la card y ficha |
| `precioAnterior` | `number` opcional | Si está y es mayor a `precio`, se muestra tachado junto al precio actual |

Cambios en cadena (todos deben actualizarse juntos para que el panel siga
funcionando):

1. `src/content.config.ts` — agregar `beneficios: z.array(z.string()).default([])`
   y `precioAnterior: z.number().int().positive().optional()` al schema de la
   colección `productos`.
2. `src/lib/types.ts` — agregar `beneficios?: string[]` y `precioAnterior?: number`
   a la interfaz `Product`.
3. `supabase/schema.sql` — agregar columnas `beneficios text[] not null default '{}'`
   y `precio_anterior integer` a la tabla `productos` (migración nueva, no se
   reescribe el schema existente — se agrega un bloque `alter table` al final
   del archivo, ejecutable de forma idempotente con `add column if not exists`).
4. `src/lib/catalog.ts` (`rowToProduct`) — mapear `r.beneficios ?? []` y
   `r.precio_anterior ?? undefined`.
5. Panel (`src/pages/panel.astro` + `src/pages/api/panel.ts`):
   - Nuevo campo `f-beneficios` (textarea, una frase por línea, se parsea a
     array al guardar — mismo patrón que ya usa `combinaCon` pero con salto
     de línea en vez de coma, porque acá son frases largas).
   - Nuevo campo `f-precio-anterior` (input numérico opcional).
   - Agregar `'beneficios', 'precio_anterior'` a la lista de columnas
     permitidas en `api/panel.ts`.
   - Precargar ambos campos al editar un producto existente.

No se migran datos existentes: los productos actuales simplemente no tienen
`beneficios` ni `precioAnterior` cargados, y la UI debe comportarse
exactamente como hoy en ese caso (sin bullets, sin precio tachado).

## 2. ProductCard (home + catálogo)

Estructura de `.card-body`, de arriba a abajo:

1. `card-line` (línea de producto) — sin cambios.
2. `h3` con el nombre — sin cambios.
3. **Nuevo:** rating — reutiliza `Stars.astro` + texto "(N reseñas)". Sólo se
   renderiza si `product.reseñas.length > 0`. Si no hay reseñas, no se
   muestra nada (no "0 reseñas").
4. `card-sub` (volumen · descripción corta) — sin cambios.
5. **Nuevo:** lista de hasta 3 `beneficios`, cada uno con un ícono de check
   (mismo SVG que ya usa el badge "Compra verificada" en las reseñas de la
   ficha, para consistencia visual). **Oculto por debajo de 640px** (mobile);
   visible desde tablet/desktop.
6. Precio: si `precioAnterior` está definido y es mayor a `precio`, se muestra
   tachado en `var(--text-muted)` junto al precio actual en verde. Si no,
   precio solo (comportamiento actual, sin cambios).
7. **Nuevo:** fila de dos CTAs desde 640px: "Ver Detalles" (outline, variante
   ya existente de `.btn-add` con texto en vez de ícono, enlaza a la ficha) +
   `AddToCartButton` (variant="solid"). **En mobile (<640px) se muestra un
   solo botón** (`AddToCartButton`, comportamiento actual) para no saturar la
   card angosta.
8. Radios de borde: se mantiene `--r-btn` (rectángulo de esquinas suaves) en
   los botones, no `--r-pill` — la marca reserva la pastilla completa para
   badges/chips, según la convención ya documentada en `tokens.css`.

**Producto agotado:** sin cambios — sigue mostrando sólo el link "Ver
producto", sin bullets, rating ni segundo botón.

## 3. Ficha de producto (PDP) — reorganización

**Columna derecha (`.info`), nuevo orden:**

1. Título + rating (sin cambios)
2. "Para qué momento" (sin cambios)
3. Tags de objetivos (sin cambios)
4. Precio — ahora también muestra `precioAnterior` tachado si está cargado
5. Selector de cantidad + botón de compra (sin cambios)
6. Aviso de poco stock (sin cambios)
7. Calculadora de envío / calculadora de dosis (sin cambios, misma posición)
8. Medios de pago + microconfianza (sin cambios)
9. **Nuevo acá:** "Sobre este ritual" — la descripción larga (`descripcionLarga`),
   visible siempre, sin colapsar en acordeón (decisión explícita: se prioriza
   que el storytelling de marca se vea sin click extra)
10. **Nuevo acá:** los 5 acordeones existentes (modo de uso y dosis,
    ingredientes y graduación, nuestro proceso, envío y cuidado,
    advertencias) — se mudan tal cual desde la sección `pdp-detail`,
    reutilizando el componente `Accordion.astro` sin cambios.

**Se elimina** la sección `.pdp-detail` (el bloque de dos columnas —
descripción a la izquierda, acordeones a la derecha — que hoy vive más abajo
en la página, después del bloque principal de galería+info). Todo su
contenido pasa a la columna derecha del bloque principal.

**Sin cambios:** galería sticky a la izquierda, disclaimer ANMAT, sección de
cross-sell ("Combiná con…") y sección de reseñas — todas siguen debajo, con
ancho completo, en el mismo lugar donde están hoy.

**Responsive:** en la ruptura existente (`max-width: 860px`) donde la grilla
pasa a una sola columna, el nuevo bloque de descripción+acordeones simplemente
sigue el flujo normal debajo del bloque de compra — no requiere reglas nuevas
de media query más allá de las que ya existen para `.pdp-grid`.

## Testing / verificación

- Producto sin `beneficios` ni `precioAnterior` (todos los productos actuales
  hoy): la card y la ficha se ven exactamente igual que antes de este cambio.
- Producto con `beneficios` (3 items) y `precioAnterior`: se ven los bullets
  (solo desde tablet) y el precio tachado, tanto en card como en ficha.
- Producto sin reseñas: no aparece rating en la card ni en el header de la
  ficha (comportamiento ya existente en la ficha, se replica en la card).
- Producto agotado: sin bullets, sin segundo botón, comportamiento actual
  intacto.
- Panel: crear/editar un producto cargando beneficios y precio anterior,
  guardar, y confirmar que persiste en Supabase y se refleja en la card/ficha
  sin romper el resto del formulario.
- Verificar visualmente en mobile (375px), tablet (768px) y desktop (1280px)
  con el navegador de preview.
