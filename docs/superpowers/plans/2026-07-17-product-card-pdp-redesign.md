# ProductCard + PDP Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sales bullets, comparison pricing and dual CTAs to `ProductCard`, and reorganize the product detail page (PDP) so its info accordions sit next to the buy button instead of in a separate section further down the page.

**Architecture:** Two new optional product fields (`beneficios`, `precioAnterior`) flow through the existing data pipeline (Astro Content Collection schema → `Product` type → Supabase table/mapping → panel admin form), then get consumed by `ProductCard.astro` and `producto/[slug].astro`. The PDP's existing `.pdp-detail` section (description + accordions) is deleted; its content moves inside the `.info` column of the main `.pdp-grid` block.

**Tech Stack:** Astro 5 (static output + on-demand PDP route), TypeScript, Supabase (Postgres), vanilla CSS with design tokens from `src/styles/tokens.css`.

## Global Constraints

- Both new fields are **optional** — every existing product (4 markdown files, any live Supabase rows) must render identically to today when the fields are absent. Never assume they're populated.
- Preserve the design tokens already in use (`--r-btn` for buttons, not `--r-pill`; existing color variables). Don't introduce new colors or radii.
- Never touch `src/pages/api/checkout.ts`, `src/pages/api/mp-webhook.ts`, or `src/lib/cart.ts` — the purchase flow is out of scope and must keep working exactly as it does today.
- **No test runner exists in this project** (`package.json` only has `astro`, `astro check`, `astro build`/`dev`/`preview` — no `vitest`/`jest`). Verification for each task is: (1) `npm run check` must report the same or fewer errors than before the task, and (2) a manual visual check in the browser preview at mobile (375px), tablet (768px) and desktop (1280px) widths where the task touches UI. Do not invent a fake unit-test suite for this — follow the codebase's actual verification pattern.
- Product line/objective language stays ANMAT-safe: wellness framing, never medical claims ("cura", "trata", "previene enfermedades"). Any new bullet copy (Task 6) must match the tone already used in `paraQueMomento` across the 4 existing products.

---

### Task 1: Data model — `beneficios` and `precioAnterior`

**Files:**
- Modify: `src/content.config.ts`
- Modify: `src/lib/types.ts`
- Modify: `supabase/schema.sql`
- Modify: `src/lib/catalog.ts`

**Interfaces:**
- Produces: `Product.beneficios?: string[]`, `Product.precioAnterior?: number` — consumed by Task 3 (`ProductCard.astro`) and Task 4 (`producto/[slug].astro`).

- [ ] **Step 1: Add the two fields to the Content Collection schema**

In `src/content.config.ts`, the schema currently reads (lines 11-46):

```ts
  schema: z.object({
    nombre: z.string(),
    linea: z.enum(['alquimia', 'bach', 'humos', 'cristales']),
    // Tipo de producto en lenguaje del cliente (facet principal del catálogo).
    tipo: z.enum(['extracto', 'esencia', 'sahumerio', 'cristal', 'kit']),
    objetivos: z.array(z.enum(['calma', 'sueno', 'enfoque', 'ritual'])).min(1),
    precio: z.number().int().positive(),
    volumen: z.string().optional(),
    graduacion: z.string().optional(),
    descripcionCorta: z.string(),
```

Change it to:

```ts
  schema: z.object({
    nombre: z.string(),
    linea: z.enum(['alquimia', 'bach', 'humos', 'cristales']),
    // Tipo de producto en lenguaje del cliente (facet principal del catálogo).
    tipo: z.enum(['extracto', 'esencia', 'sahumerio', 'cristal', 'kit']),
    objetivos: z.array(z.enum(['calma', 'sueno', 'enfoque', 'ritual'])).min(1),
    precio: z.number().int().positive(),
    // Precio de lista antes de un descuento puntual. Si está y es mayor a
    // `precio`, la UI lo muestra tachado. Si no está, no cambia nada.
    precioAnterior: z.number().int().positive().optional(),
    volumen: z.string().optional(),
    graduacion: z.string().optional(),
    descripcionCorta: z.string(),
    // Hasta 3 frases cortas de venta para la card y la ficha (ej. "500mg de
    // extracto por cápsula"). Opcional: si está vacío no se muestra nada.
    beneficios: z.array(z.string()).default([]),
```

- [ ] **Step 2: Add the two fields to the `Product` type**

In `src/lib/types.ts`, the interface currently reads (lines 6-29):

```ts
export interface Product {
  nombre: string;
  slug: string;
  linea: Linea;
  tipo: Tipo;
  objetivos: Objetivo[];
  precio: number;
  volumen?: string;
  graduacion?: string;
  descripcionCorta: string;
```

Change it to:

```ts
export interface Product {
  nombre: string;
  slug: string;
  linea: Linea;
  tipo: Tipo;
  objetivos: Objetivo[];
  precio: number;
  /** Precio de lista antes de un descuento puntual (se muestra tachado si es mayor a `precio`). */
  precioAnterior?: number;
  volumen?: string;
  graduacion?: string;
  descripcionCorta: string;
  /** Hasta 3 frases cortas de venta (card + ficha). */
  beneficios?: string[];
```

- [ ] **Step 3: Add the columns to the Supabase schema (idempotent migration)**

Append this block to the end of `supabase/schema.sql` (after the last line, which is the comment about órdenes not being publicly readable):

```sql

-- ============================================================
-- Migración: beneficios (bullets de venta) y precio anterior
-- (para mostrar precio tachado cuando hay una promoción puntual).
-- `add column if not exists` es idempotente: se puede correr de nuevo
-- sin romper nada si ya se aplicó.
-- ============================================================
alter table productos add column if not exists beneficios text[] not null default '{}';
alter table productos add column if not exists precio_anterior integer;
```

- [ ] **Step 4: Map the new Supabase columns in `catalog.ts`**

In `src/lib/catalog.ts`, `rowToProduct` currently reads (lines 6-31):

```ts
function rowToProduct(r: Record<string, any>): Product {
  return {
    slug: r.slug,
    nombre: r.nombre,
    linea: r.linea,
    tipo: r.tipo,
    objetivos: r.objetivos ?? [],
    precio: r.precio,
    volumen: r.volumen ?? undefined,
```

Change it to:

```ts
function rowToProduct(r: Record<string, any>): Product {
  return {
    slug: r.slug,
    nombre: r.nombre,
    linea: r.linea,
    tipo: r.tipo,
    objetivos: r.objetivos ?? [],
    precio: r.precio,
    precioAnterior: r.precio_anterior ?? undefined,
    volumen: r.volumen ?? undefined,
```

And a few lines further down, where `descripcionCorta` is mapped:

```ts
    descripcionCorta: r.descripcion_corta ?? '',
    paraQueMomento: r.para_que_momento ?? undefined,
```

Change it to:

```ts
    descripcionCorta: r.descripcion_corta ?? '',
    beneficios: r.beneficios ?? [],
    paraQueMomento: r.para_que_momento ?? undefined,
```

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: no new TypeScript/Astro errors (the 4 existing product markdown files don't set `beneficios`/`precioAnterior`, and both are optional/defaulted, so they still validate against the schema).

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts src/lib/types.ts supabase/schema.sql src/lib/catalog.ts
git commit -m "feat: agregar beneficios y precioAnterior al modelo de producto"
```

---

### Task 2: Panel admin — edit `beneficios` and `precioAnterior`

**Files:**
- Modify: `src/pages/panel.astro`
- Modify: `src/pages/api/panel.ts`

**Interfaces:**
- Consumes: `Product.beneficios?: string[]`, `Product.precioAnterior?: number` (Task 1).
- Produces: nothing new consumed by later tasks — this task only keeps the admin panel in sync so store owners can populate the fields added in Task 1.

- [ ] **Step 1: Allow the two new columns through the API's field allowlist**

In `src/pages/api/panel.ts`, the `CAMPOS` array currently reads (lines 22-28):

```ts
const CAMPOS = [
  'slug', 'nombre', 'linea', 'tipo', 'objetivos', 'precio', 'volumen',
  'graduacion', 'descripcion_corta', 'para_que_momento', 'ingredientes',
  'modo_de_uso', 'nuestro_proceso', 'envio_y_cuidado', 'advertencias',
  'descripcion_larga', 'imagenes', 'destacado', 'stock', 'orden',
  'combina_con', 'resenas', 'activo',
];
```

Change it to:

```ts
const CAMPOS = [
  'slug', 'nombre', 'linea', 'tipo', 'objetivos', 'precio', 'precio_anterior',
  'volumen', 'graduacion', 'descripcion_corta', 'beneficios',
  'para_que_momento', 'ingredientes', 'modo_de_uso', 'nuestro_proceso',
  'envio_y_cuidado', 'advertencias', 'descripcion_larga', 'imagenes',
  'destacado', 'stock', 'orden', 'combina_con', 'resenas', 'activo',
];
```

- [ ] **Step 2: Add the two form fields to the product editor**

In `src/pages/panel.astro`, the grid of price/stock fields currently reads (lines 262-263):

```html
              <div><label>Precio (ARS)</label><input id="f-precio" type="number" /></div>
              <div><label>Stock</label><input id="f-stock" type="number" /></div>
```

Change it to:

```html
              <div><label>Precio (ARS)</label><input id="f-precio" type="number" /></div>
              <div><label>Precio anterior (opcional, se muestra tachado)</label><input id="f-precio-anterior" type="number" /></div>
              <div><label>Stock</label><input id="f-stock" type="number" /></div>
```

A few lines further down, the short-description field currently reads (line 275):

```html
            <label>Descripción corta</label><input id="f-descCorta" />
```

Change it to:

```html
            <label>Descripción corta</label><input id="f-descCorta" />
            <label>Beneficios (uno por línea, hasta 3 — se usan en la card y la ficha)</label>
            <textarea id="f-beneficios" placeholder="500mg de extracto por cápsula&#10;Hecho a mano en pequeños lotes&#10;Sin conservantes"></textarea>
```

- [ ] **Step 3: Load the new fields when opening a product for editing**

In `src/pages/panel.astro`, inside `openP(p, isDup)`, the field-population lines currently read (lines 538, 541):

```js
        $('#f-precio').value = p.precio ?? ''; $('#f-stock').value = p.stock ?? 0;
```

Change it to:

```js
        $('#f-precio').value = p.precio ?? ''; $('#f-precio-anterior').value = p.precio_anterior ?? '';
        $('#f-stock').value = p.stock ?? 0;
```

And:

```js
        $('#f-descCorta').value = p.descripcion_corta || ''; $('#f-momento').value = p.para_que_momento || '';
```

Change it to:

```js
        $('#f-descCorta').value = p.descripcion_corta || ''; $('#f-beneficios').value = (p.beneficios || []).join('\n');
        $('#f-momento').value = p.para_que_momento || '';
```

- [ ] **Step 4: Send the new fields when saving**

In `src/pages/panel.astro`, inside the `$('#guardar').addEventListener(...)` handler, the `product` object literal currently reads (lines 573-582):

```js
        const product = {
          slug: $('#f-slug').value.trim(), nombre: $('#f-nombre').value.trim(), linea: $('#f-linea').value, tipo: $('#f-tipo').value,
          objetivos: [...objSel], precio: parseInt($('#f-precio').value, 10) || 0, stock: parseInt($('#f-stock').value, 10) || 0,
          volumen: $('#f-volumen').value.trim() || null, graduacion: $('#f-graduacion').value.trim() || null,
          orden: $('#f-orden').value ? parseInt($('#f-orden').value, 10) : null, destacado: $('#f-destacado').checked,
          descripcion_corta: $('#f-descCorta').value.trim(), para_que_momento: $('#f-momento').value.trim(), descripcion_larga: $('#f-descLarga').value.trim(),
          ingredientes: $('#f-ingredientes').value.trim(), modo_de_uso: $('#f-modo').value.trim(), nuestro_proceso: $('#f-proceso').value.trim(),
          envio_y_cuidado: $('#f-envio').value.trim(), advertencias: $('#f-advertencias').value.trim(),
          combina_con: $('#f-combina').value.split(',').map((s) => s.trim()).filter(Boolean), imagenes: prodImgs, activo: true,
        };
```

Change it to:

```js
        const product = {
          slug: $('#f-slug').value.trim(), nombre: $('#f-nombre').value.trim(), linea: $('#f-linea').value, tipo: $('#f-tipo').value,
          objetivos: [...objSel], precio: parseInt($('#f-precio').value, 10) || 0,
          precio_anterior: $('#f-precio-anterior').value ? parseInt($('#f-precio-anterior').value, 10) : null,
          stock: parseInt($('#f-stock').value, 10) || 0,
          volumen: $('#f-volumen').value.trim() || null, graduacion: $('#f-graduacion').value.trim() || null,
          orden: $('#f-orden').value ? parseInt($('#f-orden').value, 10) : null, destacado: $('#f-destacado').checked,
          descripcion_corta: $('#f-descCorta').value.trim(),
          beneficios: $('#f-beneficios').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3),
          para_que_momento: $('#f-momento').value.trim(), descripcion_larga: $('#f-descLarga').value.trim(),
          ingredientes: $('#f-ingredientes').value.trim(), modo_de_uso: $('#f-modo').value.trim(), nuestro_proceso: $('#f-proceso').value.trim(),
          envio_y_cuidado: $('#f-envio').value.trim(), advertencias: $('#f-advertencias').value.trim(),
          combina_con: $('#f-combina').value.split(',').map((s) => s.trim()).filter(Boolean), imagenes: prodImgs, activo: true,
        };
```

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: no new errors (panel.astro's inline script is `// @ts-nocheck`, so this step is mainly a syntax sanity check via the dev server).

Then, if a local `.env` with working Supabase credentials is available: start the dev server, open `/panel`, log in, edit an existing product, type 2-3 lines into "Beneficios" and a number into "Precio anterior", save, and reopen the same product to confirm both fields reloaded correctly. If no local Supabase is configured, skip the live save/reload check — Task 6's content changes and Task 3/4/5's rendering checks don't depend on the panel.

- [ ] **Step 6: Commit**

```bash
git add src/pages/panel.astro src/pages/api/panel.ts
git commit -m "feat(panel): editar beneficios y precio anterior del producto"
```

---

### Task 3: `ProductCard.astro` — rating, benefit bullets, comparison price, dual CTA

**Files:**
- Modify: `src/components/ProductCard.astro`

**Interfaces:**
- Consumes: `Product.beneficios?: string[]`, `Product.precioAnterior?: number`, `Product.reseñas?: Resena[]` (already on `Product`, just newly read here), `Stars.astro` (`{ value: number; size?: number }`).
- Produces: no new exports — this is a leaf component already used by `Catalog.astro` and the PDP's cross-sell section, both unaffected structurally (same `product` prop).

- [ ] **Step 1: Import `Stars` and read the new fields**

In `src/components/ProductCard.astro`, the imports and destructuring currently read (lines 1-26):

```astro
---
import Logo from './Logo.astro';
import AddToCartButton from './AddToCartButton.astro';
import { formatPrice } from '../lib/format';
import { lineaColor, lineaLabel, type Product } from '../lib/types';

interface Props {
  product: Product;
  /** umbral de envío gratis */
  envioGratisDesde?: number;
  /** animar al hacer scroll (Home). En el catálogo se desactiva. */
  reveal?: boolean;
}
const { product, envioGratisDesde = 85000, reveal = true } = Astro.props;
const {
  nombre,
  slug,
  linea,
  tipo,
  objetivos,
  precio,
  volumen,
  descripcionCorta,
  imagenes = [],
  stock = 0,
} = product;
```

Change it to:

```astro
---
import Logo from './Logo.astro';
import AddToCartButton from './AddToCartButton.astro';
import Stars from './Stars.astro';
import { formatPrice } from '../lib/format';
import { lineaColor, lineaLabel, type Product } from '../lib/types';

interface Props {
  product: Product;
  /** umbral de envío gratis */
  envioGratisDesde?: number;
  /** animar al hacer scroll (Home). En el catálogo se desactiva. */
  reveal?: boolean;
}
const { product, envioGratisDesde = 85000, reveal = true } = Astro.props;
const {
  nombre,
  slug,
  linea,
  tipo,
  objetivos,
  precio,
  precioAnterior,
  volumen,
  descripcionCorta,
  imagenes = [],
  stock = 0,
  beneficios = [],
  reseñas = [],
} = product;
const avgRating =
  reseñas.length > 0
    ? reseñas.reduce((s, r) => s + r.estrellas, 0) / reseñas.length
    : 0;
```

- [ ] **Step 2: Add the rating line and benefit bullets to the card body**

The card body currently reads (lines 65-75):

```astro
  <div class="card-body">
    <span class="card-line">{lineaLabel[linea]}</span>
    <h3><a href={href}>{nombre}</a></h3>
    {sub && <p class="card-sub">{sub}</p>}
    <p class="card-price">{formatPrice(precio)}</p>
    {sinStock ? (
      <a class="card-add is-disabled" href={href}>Ver producto</a>
    ) : (
      <div class="card-add-wrap"><AddToCartButton product={product} /></div>
    )}
  </div>
```

Change it to:

```astro
  <div class="card-body">
    <span class="card-line">{lineaLabel[linea]}</span>
    <h3><a href={href}>{nombre}</a></h3>
    {reseñas.length > 0 && (
      <p class="card-rating">
        <Stars value={avgRating} size={13} />
        <span>({reseñas.length})</span>
      </p>
    )}
    {sub && <p class="card-sub">{sub}</p>}
    {!sinStock && beneficios.length > 0 && (
      <ul class="card-benefits" role="list">
        {beneficios.slice(0, 3).map((b) => (
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 6"></path></svg>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    )}
    <p class="card-price">
      {precioAnterior && precioAnterior > precio && (
        <span class="card-price-old">{formatPrice(precioAnterior)}</span>
      )}
      <span class="card-price-now">{formatPrice(precio)}</span>
    </p>
    {sinStock ? (
      <a class="card-add is-disabled" href={href}>Ver producto</a>
    ) : (
      <div class="card-cta">
        <a class="card-view" href={href}>Ver Detalles</a>
        <div class="card-cta-add"><AddToCartButton product={product} /></div>
      </div>
    )}
  </div>
```

- [ ] **Step 3: Update the styles — replace `.card-price` and `.card-add-wrap`, add the new classes**

The price and CTA styles currently read (lines 189-213):

```css
  .card-price {
    font-family: var(--font-serif);
    font-size: 1.375rem;
    font-weight: 500;
    color: var(--verde);
    margin: 0.85rem 0;
    font-variation-settings: 'opsz' 40;
  }

  .card-add-wrap {
    margin-top: auto;
  }
  .card-add {
    display: block;
    margin-top: auto;
    text-align: center;
    padding: 0.72rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--r-pill);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
```

Change it to:

```css
  .card-rating {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0.3rem 0 0;
  }

  .card-benefits {
    display: none;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0.75rem 0 0;
    font-size: 0.78rem;
    color: var(--text-soft);
  }
  .card-benefits li {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
  }
  .card-benefits svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-top: 0.15rem;
    color: var(--salvia);
  }
  @media (min-width: 640px) {
    .card-benefits {
      display: flex;
    }
  }

  .card-price {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0.85rem 0;
  }
  .card-price-now {
    font-family: var(--font-serif);
    font-size: 1.375rem;
    font-weight: 500;
    color: var(--verde);
    font-variation-settings: 'opsz' 40;
  }
  .card-price-old {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .card-add {
    display: block;
    margin-top: auto;
    text-align: center;
    padding: 0.72rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--r-pill);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .card-cta {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
  }
  .card-cta-add {
    flex: 1;
  }
  .card-view {
    display: none;
    flex: 1;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0.8rem 1rem;
    border: 1px solid var(--verde);
    border-radius: var(--r-btn);
    font-size: 0.82rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--verde);
    transition: background var(--dur) var(--ease-out), color var(--dur) var(--ease-out);
  }
  .card-view:hover {
    background: var(--verde);
    color: var(--crema);
  }
  @media (min-width: 640px) {
    .card-view {
      display: inline-flex;
    }
  }
```

(`.card-add` keeps its pill radius and out-of-stock styling exactly as before — it's still used for the disabled "Ver producto" state.)

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: no new errors.

Then start the dev server (`npm run dev`) and open the home page (has featured products via `ProductCard`) and `/tienda` in the browser preview:
- At 1280px (desktop): a product **with no `beneficios`/`precioAnterior`/`reseñas`** (all 4 current products, before Task 6) must look pixel-identical to before this change — single price, single "Agregar" button, no bullets, no rating line.
- Temporarily add `beneficios: [Test 1, Test 2, Test 3]` and `precioAnterior: 99999` (higher than `precio`) to one product's frontmatter (don't commit this — revert after checking), reload, and confirm: rating (if reseñas exist) + 3 checkmarked bullets + strikethrough price + both "Ver Detalles" and "Agregar" buttons show side by side.
- Resize to 375px (mobile): confirm the bullets disappear and only one button ("Agregar") shows, with "Ver Detalles" hidden.
- Revert the temporary frontmatter edit before moving on (it's test data, not part of this task).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductCard.astro
git commit -m "feat: card de producto con rating, beneficios y precio comparativo"
```

---

### Task 4: PDP price block — show `precioAnterior`

**Files:**
- Modify: `src/pages/producto/[slug].astro`

**Interfaces:**
- Consumes: `Product.precioAnterior?: number` (Task 1).

- [ ] **Step 1: Destructure `precioAnterior`**

In `src/pages/producto/[slug].astro`, the destructuring currently reads (lines 29-47):

```astro
const {
  nombre,
  linea,
  tipo,
  precio,
  volumen,
  graduacion,
```

Change it to:

```astro
const {
  nombre,
  linea,
  tipo,
  precio,
  precioAnterior,
  volumen,
  graduacion,
```

- [ ] **Step 2: Show it tachado in the price block**

The price block markup currently reads (lines 168-174):

```astro
        <div class="price-block">
          <div class="price-main">
            <span class="price">{formatPrice(precio)}</span>
            {(volumen || graduacion) && (
              <span class="price-meta">{[volumen, graduacion].filter(Boolean).join(' · ')}</span>
            )}
          </div>
```

Change it to:

```astro
        <div class="price-block">
          <div class="price-main">
            {precioAnterior && precioAnterior > precio && (
              <span class="price-old">{formatPrice(precioAnterior)}</span>
            )}
            <span class="price">{formatPrice(precio)}</span>
            {(volumen || graduacion) && (
              <span class="price-meta">{[volumen, graduacion].filter(Boolean).join(' · ')}</span>
            )}
          </div>
```

- [ ] **Step 3: Add the `.price-old` style**

The `.price` style currently reads (lines 482-488):

```css
  .price {
    font-family: var(--font-serif);
    font-size: 2rem;
    font-weight: 500;
    color: var(--verde);
    font-variation-settings: 'opsz' 40;
  }
```

Change it to:

```css
  .price-old {
    font-size: 1.15rem;
    color: var(--text-muted);
    text-decoration: line-through;
  }
  .price {
    font-family: var(--font-serif);
    font-size: 2rem;
    font-weight: 500;
    color: var(--verde);
    font-variation-settings: 'opsz' 40;
  }
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: no new errors.

Then, with the dev server running, open any product page in the browser preview. Since none of the 4 existing products have `precioAnterior` yet, the price block must look exactly as before (single price, no strikethrough). Temporarily set `precioAnterior: 99999` in one product's frontmatter (don't commit), reload the PDP, confirm the strikethrough price appears to the left of the current price and reads correctly with `formatPrice`. Revert the temporary edit.

- [ ] **Step 5: Commit**

```bash
git add "src/pages/producto/[slug].astro"
git commit -m "feat(pdp): mostrar precio anterior tachado cuando hay promoción"
```

---

### Task 5: PDP reorganization — move description + accordions into the info column

**Files:**
- Modify: `src/pages/producto/[slug].astro`

**Interfaces:**
- Consumes: `acordeones` (already computed in the component from `modoDeUso`/`ingredientes`/`nuestroProceso`/`envioYCuidado`/`advertencias`), `descripcionParrafos` (already computed), `Accordion.astro` (`{ title: string; open?: boolean }`) — none of these change shape, only their position in the markup.

- [ ] **Step 1: Move the description + accordions inside `.info`, right after the microconfianza list**

The end of the `.info` column currently reads (lines 225-233):

```astro
        <!-- Microconfianza -->
        <ul class="microtrust" role="list">
          <li>Hecho a mano en pequeños lotes</li>
          <li>Envío protegido en 24–72 h</li>
          <li>Atención humana por WhatsApp</li>
        </ul>
      </div>
    </div>
  </section>
```

Change it to:

```astro
        <!-- Microconfianza -->
        <ul class="microtrust" role="list">
          <li>Hecho a mano en pequeños lotes</li>
          <li>Envío protegido en 24–72 h</li>
          <li>Atención humana por WhatsApp</li>
        </ul>

        <!-- Descripción + acordeones: viven acá (junto al botón de compra)
             en vez de en una sección aparte más abajo, para que la info
             quede a un scroll corto y la ficha no se sienta interminable. -->
        <div class="descripcion">
          <h2>Sobre este ritual</h2>
          <div class="prose-body">
            {descripcionParrafos.map((p) => <p>{p}</p>)}
          </div>
        </div>
        <div class="acordeones">
          {acordeones.map((a, i) => (
            <Accordion title={a.title} open={i === 0}>
              <p>{a.body}</p>
            </Accordion>
          ))}
        </div>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Delete the old `.pdp-detail` section**

Immediately after the block from Step 1 (the closing `</section>` of the main PDP block), the following section currently exists (lines 236-252) — delete it entirely:

```astro
  <!-- Descripción + acordeones -->
  <section class="section pdp-detail">
    <div class="wrap pdp-detail-grid">
      <div class="descripcion" data-reveal="rise">
        <h2>Sobre este ritual</h2>
        <div class="prose-body">
          {descripcionParrafos.map((p) => <p>{p}</p>)}
        </div>
      </div>
      <div class="acordeones" data-reveal="rise">
        {acordeones.map((a, i) => (
          <Accordion title={a.title} open={i === 0}>
            <p>{a.body}</p>
          </Accordion>
        ))}
      </div>
    </div>
  </section>
```

After this deletion, the file should go directly from the closing `</section>` of the main PDP block to `<!-- Disclaimer ANMAT -->`.

- [ ] **Step 3: Update the CSS — remove the two-column detail grid, add vertical spacing for the now-stacked blocks**

The detail-section styles currently read (lines 628-651):

```css
  /* ---- Detalle: descripción + acordeones ---- */
  .pdp-detail {
    background: var(--bg-alt);
  }
  .pdp-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(2rem, 5vw, 3.5rem);
    align-items: start;
  }
  .descripcion h2,
  .cross .section-head h2,
  .resenas .section-head h2 {
    margin-top: 0.4rem;
  }
  .prose-body :global(p) {
    color: var(--text-soft);
    margin-bottom: 1rem;
    max-width: 60ch;
  }
  .prose-body :global(strong) {
    color: var(--verde);
    font-weight: 600;
  }
```

Change it to:

```css
  /* ---- Descripción + acordeones (dentro de la columna de compra) ---- */
  .descripcion {
    margin-top: 2rem;
    padding-top: 1.75rem;
    border-top: 1px solid var(--border);
  }
  .descripcion h2,
  .cross .section-head h2,
  .resenas .section-head h2 {
    margin-top: 0.4rem;
  }
  .prose-body :global(p) {
    color: var(--text-soft);
    margin-bottom: 1rem;
    max-width: 60ch;
  }
  .prose-body :global(strong) {
    color: var(--verde);
    font-weight: 600;
  }
  .acordeones {
    margin-top: 0.5rem;
  }
```

- [ ] **Step 4: Remove the now-dead `.pdp-detail-grid` reference from the responsive rules**

The responsive block currently reads (lines 754-765):

```css
  @media (max-width: 860px) {
    .pdp-grid,
    .pdp-detail-grid {
      grid-template-columns: 1fr;
    }
    .gallery {
      position: static;
    }
    .cross-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
```

Change it to:

```css
  @media (max-width: 860px) {
    .pdp-grid {
      grid-template-columns: 1fr;
    }
    .gallery {
      position: static;
    }
    .cross-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
```

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: no new errors.

Then, with the dev server running, open a product page with reviews and multiple info fields (e.g. `/producto/doble-extracto-reishi`, which has `modoDeUso`, `ingredientes`, `nuestroProceso`, `envioYCuidado`, `advertencias` and reseñas) in the browser preview:
- Desktop (1280px): confirm "Sobre este ritual" and the 5 accordions now appear in the right column, below "Medios de pago"/microconfianza and above the page's next section (disclaimer). Confirm the old two-column section is gone — there should be no second, separate description+accordions block further down the page.
- Confirm the gallery on the left stays sticky while scrolling through the now-taller right column.
- Confirm cross-sell ("Combiná con…") and the reviews section still render, unchanged, below the disclaimer.
- Tablet (768px) and mobile (375px): confirm the layout collapses to a single column (gallery on top, then all of `.info` including the accordions) exactly as the existing `.pdp-grid` breakpoint already handles — no visual regression at the breakpoint.
- Click each accordion to confirm they still open/close (this is unmodified `Accordion.astro` behavior, just relocated).

- [ ] **Step 6: Commit**

```bash
git add "src/pages/producto/[slug].astro"
git commit -m "refactor(pdp): mover descripción y acordeones a la columna de compra"
```

---

### Task 6: Content — populate `beneficios` for the 4 existing products

**Files:**
- Modify: `src/content/productos/doble-extracto-melena-de-leon.md`
- Modify: `src/content/productos/doble-extracto-reishi.md`
- Modify: `src/content/productos/esencia-serenidad-bach.md`
- Modify: `src/content/productos/kit-ritual-de-calma.md`

**Interfaces:**
- Consumes: the `beneficios` schema field from Task 1.

This task has no code — it's frontmatter content, written in the same ANMAT-safe, artisanal-brand tone already used in each product's `paraQueMomento`/`nuestroProceso`. `precioAnterior` is intentionally **not** set on any product here — inventing a fake "before" price isn't this task's call to make; that field stays available for whenever the store owner actually runs a promotion.

- [ ] **Step 1: Add `beneficios` to `doble-extracto-melena-de-leon.md`**

In `src/content/productos/doble-extracto-melena-de-leon.md`, insert this line right after `descripcionCorta: Para el enfoque y la claridad` (line 9):

```yaml
beneficios:
  - Doble extracción real, alcohol y agua
  - Hecho a mano en pequeños lotes
  - Sin azúcares, sin conservantes, sin saborizantes
```

- [ ] **Step 2: Add `beneficios` to `doble-extracto-reishi.md`**

In `src/content/productos/doble-extracto-reishi.md`, insert this line right after `descripcionCorta: Para tus momentos de calma` (line 9):

```yaml
beneficios:
  - Doble extracción real, alcohol y agua
  - Gotero pensado para tu ritual nocturno
  - Hecho a mano en pequeños lotes
```

- [ ] **Step 3: Add `beneficios` to `esencia-serenidad-bach.md`**

In `src/content/productos/esencia-serenidad-bach.md`, insert this line right after `descripcionCorta: Flores de Bach para el estrés` (line 8):

```yaml
beneficios:
  - Sistema tradicional de Flores de Bach
  - Gotero práctico para llevar a donde vayas
  - Elaborada de forma artesanal, por lote
```

- [ ] **Step 4: Add `beneficios` to `kit-ritual-de-calma.md`**

In `src/content/productos/kit-ritual-de-calma.md`, insert this line right after `descripcionCorta: Extracto + Bach + sahumerio` (line 7):

```yaml
beneficios:
  - Incluye extracto, esencia y sahumerio
  - Packaging pensado para regalar
  - Todo lo que necesitás en una sola caja
```

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: no new errors (the schema's `beneficios` field accepts a `string[]`, matching the YAML list syntax used above).

Then, with the dev server running, open the home page and `/tienda` in the browser preview at 768px+ and confirm all 4 products now show their 3 bullets on the card. Open each of the 4 product pages and confirm the bullets don't appear on the PDP (they're a `ProductCard`-only feature per the approved design — the PDP doesn't render `beneficios` anywhere).

- [ ] **Step 6: Commit**

```bash
git add src/content/productos/doble-extracto-melena-de-leon.md src/content/productos/doble-extracto-reishi.md src/content/productos/esencia-serenidad-bach.md src/content/productos/kit-ritual-de-calma.md
git commit -m "content: agregar beneficios a los 4 productos existentes"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check and production build**

Run: `npm run check`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds with no errors (this also validates every content markdown file against the updated schema, and catches any Astro/TS issue the dev server might not surface).

- [ ] **Step 2: Full visual walkthrough in the browser preview**

With the dev server running (`npm run dev`, port 4321):

- Home page (`/`) at 375px, 768px, 1280px: featured product cards show rating (if reviews exist), 3 benefit bullets (tablet+ only), and the "Ver Detalles"/"Agregar" button pair (tablet+) or single "Agregar" button (mobile).
- `/tienda` at the same 3 widths: same card behavior, filters still work (facet buttons, search), grid reflows correctly.
- One product page per product line (e.g. `/producto/doble-extracto-melena-de-leon` and `/producto/kit-ritual-de-calma`) at the same 3 widths: accordions and description sit in the right column under the buy box; gallery stays sticky on desktop; accordions open/close; cross-sell and reviews sections still render below.

- [ ] **Step 3: Regression-check the purchase flow (untouched code, but must still work end to end)**

- Add a product to the cart from a `ProductCard` (home or `/tienda`) — confirm the "Agregado" state animation still plays and the `CartDrawer` item count updates.
- Add a product to the cart from a PDP's quantity selector + "Agregar al carrito" button — confirm it respects the stock cap.
- Open the cart drawer, confirm totals and the envío gratis threshold message are unchanged.
- Do **not** submit a real Mercado Pago checkout in this pass (no order should be created) — the goal is confirming the cart UI still works, not exercising payment.

- [ ] **Step 4: Final commit (only if Step 2/3 turned up small fixes)**

If everything passed with no fixes needed, there's nothing to commit here — Task 6's commit is the last one. If small fixes were needed during this pass, commit them individually with a message describing what regression they fix, referencing which task introduced it.
