# Ficha de producto optimizada para conversión

Fecha: 2026-07-24
Estado: aprobado por el usuario, listo para implementar

## Objetivo

Rediseñar `/producto/[slug]` para maximizar la conversión de **compradores
nuevos**. Esa es la prioridad declarada: una vez que alguien compró por primera
vez, la recompra y la suscripción son mucho más fáciles. Todo lo que sigue se
ordena en función de esa persona: alguien que no conoce la marca, que está
evaluando si confiar, y que decide en los primeros dos scrolls.

Referencia analizada: el rediseño de conversionUX sobre la ficha de Bayond
(educación → aspiración → upsell → cross-sell → educación).

## Diagnóstico de la ficha actual

Lo que la referencia resuelve y hoy no tenemos:

- Título, precio y rating quedan **debajo** de una galería cuadrada. En mobile
  el precio nace fuera de pantalla.
- No hay grilla de beneficios. El campo `beneficios` existe en el modelo y en
  el panel, pero la ficha nunca lo muestra: sólo lo usa la card del catálogo.
- No hay bloque de opciones de compra (suscripción vs. compra única).
- El cross-sell son `ProductCard` completas al final de la página, lejos del CTA.
- No hay bloque educativo de ingredientes.

Lo que sobra o está mal ubicado:

- Entre el CTA y la descripción hay cuatro bloques seguidos: calculadora de
  envío, calculadora de dosis, medios de pago y microconfianza. Es justo el
  espacio donde la referencia pone upsell y cross-sell.
- Las reseñas están al final, en un marquee automático. No se lee bien algo
  que se mueve, y no hay prueba social cerca del botón.
- El disclaimer ANMAT parte la página entre la compra y el cross-sell.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Suscripciones | UI + carrito reales ahora. El ítem entra al carrito marcado como suscripción y Mercado Pago cobra el primer envío. La renovación automática (preapproval de MP) queda como proyecto aparte. |
| Beneficio de suscripción | **15% off + envío gratis siempre**, sin monto mínimo. No 20% pelado: el envío gratis vale más que los 5 puntos que se restan, y comunicar las dos cosas es más honesto que esconder la mitad del beneficio en la letra chica. |
| Costo de envío | Se comunica en la ficha, antes de agregar al carrito. Nunca aparece por primera vez en el checkout. |
| Calculadora de dosis | Sección propia y visible después de la compra, no dentro de un acordeón. |
| Descuento por cantidad | **No hay.** La jugada de volumen son los combos. |
| Acumulación | **Nunca se suman.** Se aplica el descuento mayor. |
| Envío gratis | A **CABA y GBA**, llevando 2 unidades o más, o suscribiéndose (desde 1). Al interior se cobra siempre. |
| Precio de referencia | $27.000 con tarjeta / $22.000 por transferencia, el extracto de 50 ml. |
| Brecha tarjeta/transferencia | 18,5%. No es generosidad: es lo que cuestan la comisión de MP más las 3 cuotas sin interés, que financia el vendedor. |
| Bloque educativo | Se construye con campo nuevo y editor en el panel, con foto. |
| Calculadoras | Se bajan, no se borran. |
| Suscripción preseleccionada | Sí, como en la referencia. |

## A · Orden de la ficha

Orden real del DOM, que es también el orden en mobile:

1. Breadcrumb.
2. **Cabezal**: línea, `nombre`, `volumen · graduación`, `paraQueMomento` en una
   línea, estrellas con enlace a reseñas.
3. **Galería**: badge editable (Más vendido / Nuevo), badge de envío gratis o
   agotado, miniaturas.
4. **Beneficios**: grilla de dos columnas alimentada por `beneficios`. Debajo,
   los objetivos como chips secundarios que enlazan al catálogo filtrado.
5. **Caja de compra** (sección B).
6. **Tira de confianza**: tres ítems en fila con ícono.
7. **Combiná con**: fila compacta de cross-sell — miniatura, nombre, precio y
   botón `+` que agrega directo al carrito.
8. **Por qué funciona**: cards de ingredientes destacados.
9. **Sobre este ritual**: descripción larga.
8b. **¿Cuánto me corresponde?**: la calculadora de dosis, en sección propia y
    a la vista. Va acá y no arriba porque «¿cuántas gotas tomo?» es la duda
    que aparece justo después de decidir la compra, no antes. Y no va en un
    acordeón porque escondida detrás de un click no la abre nadie.
10. **Reseñas**: grid estático de tres, con botón para ver el resto.
11. **Acordeones**: modo de uso, ingredientes, nuestro proceso, envío y
    cuidado, advertencias.
12. Disclaimer ANMAT.

En desktop, los pasos 2 a 7 van en la columna derecha y la galería queda sticky
a la izquierda; del 8 al 12 pasan a ancho completo. Un solo DOM, resuelto con
`grid-template-areas`: nada duplicado ni oculto por media query.

## B · Caja de compra

```
┌──────────────────────────────────────────────┐
│ ● Suscribite: 15% off + envío gratis         │  ← preseleccionada
│                        $22.000  $18.700      │
│   Ahorrás $3.300 en cada pedido y no pagás   │
│   el envío ($3.500 a $8.000)                 │
│   [ Cada 30 días                        ▾ ]  │
│   · Envío gratis siempre, sin monto mínimo   │
│   · Cancelás cuando quieras, sin permanencia │
│   · Te avisamos antes de cada envío          │
├──────────────────────────────────────────────┤
│ ○ Comprá una vez                    $22.000  │
│   [ 1 u ] [ 2 u −10% ] [ 3 u −15% ]          │
├──────────────────────────────────────────────┤
│         AGREGAR AL CARRITO                   │
│              $18.700                         │
│  · 3 cuotas sin interés de $6.233            │
│  · Envío gratis, sin monto mínimo            │
│  PAGÁ CON  Mercado Pago · Visa · Mastercard  │
└──────────────────────────────────────────────┘
```

El ahorro por suscripción va **dentro de la caja**, pegado al precio que lo
produce. Antes estaba como un cartel arriba de la foto: ahí era una promesa
suelta que la persona no podía contrastar contra ningún número.

Reglas:

- Las pills de cantidad reemplazan al stepper `− 1 +`: muestran el ahorro en el
  mismo control donde se elige. Se ocultan las que superan el stock.
- La nota de transferencia 10% aparece sólo cuando no hay otro descuento
  activo, es decir en «comprá una vez / 1 u».
- Si el producto tiene `suscribible = false`, la caja muestra únicamente compra
  única. Un cristal no se recompra cada 30 días.
- Si el producto está agotado, la caja se reemplaza por el aviso de WhatsApp
  que ya existe.
- El CTA se vuelve sticky al pie en mobile cuando el original sale de pantalla.

## B1 · La escalera de incentivos

El orden de conveniencia para el negocio, de mejor a peor: combo, suscripción,
unidad suelta. El combo entra completo y de una, sin riesgo de cancelación; la
suscripción asegura recurrencia y amortiza el costo de publicidad en varios
envíos; la unidad suelta es la que menos deja pero es la que rompe la barrera
de la primera compra.

Con el extracto a $27.000 con tarjeta / $22.000 por transferencia, envío a CABA:

| Opción | Producto | Envío | **Total** |
|---|---|---|---|
| 1 unidad, tarjeta | $27.000 | $5.000 | $32.000 |
| 1 unidad, transferencia | $22.000 | $5.000 | $27.000 |
| **Suscripción −15%** | $22.950 | $0 | **$22.950** |
| 2 unidades, transferencia | $44.000 | $0 | $44.000 |
| Kit / combo | precio propio | $0 | — |

**Hay que mostrar el total, no el precio del frasco.** El 15% de suscripción
sobre $27.000 da $22.950, que es más caro que los $22.000 de transferencia: si
la ficha mostrara sólo el precio del producto, la suscripción se leería como la
peor opción. Gana por el envío incluido, y así se comunica — de ahí la línea
«Te llega por $22.950, envío incluido» dentro de la tarjeta de suscripción.

Las dos opciones son excluyentes por naturaleza: **una suscripción no se puede
pagar por transferencia**, necesita débito automático con tarjeta. No hace
falta inventar reglas para que no se acumulen. Por el mismo motivo la nota de
«3 cuotas sin interés» se oculta al elegir suscripción: cada envío se cobra
entero.

**No hay descuento por llevar varias del mismo producto.** Se probó con packs
de 2 y 3 unidades y se sacó: ninguna de las dos marcas líderes del rubro los
usa. Nadie quiere tres frascos iguales — son medio año del mismo sabor, un
compromiso enorme para quien compra por primera vez. La jugada de volumen son
los combos de productos distintos, que además son una compra de descubrimiento
y cuyo precio no se compara fácil contra un competidor. Por eso el cross-sell
de la ficha ordena los kits primero.

El incentivo a llevar más de uno queda en el envío gratis desde 2 unidades,
que no cuesta margen de producto.

**Riesgo asumido a conciencia:** suscribirse sale $24.650 y comprar una suelta
sale $34.000 con envío, así que quien quiera una sola botella se va a suscribir
y cancelar. Se acepta como costo de captación: queda el mail, el WhatsApp y una
primera compra concretada, más barato que cualquier publicidad. Con los costos
estimados (producto $4.000, publicidad $5.000, MP + retenciones ~10%, envío
~$4.250) el primer envío deja ~$8.900 y los siguientes ~$13.900, porque la
publicidad se paga una sola vez. Ese es el argumento real de la suscripción.

## B2 · Envío · `src/lib/shipping.ts`

Los costos de envío estaban copiados en tres lugares y dos se contradecían: la
calculadora de la ficha decía $2.500 para CABA y el checkout cobraba $5.000.
Además la calculadora ofrecía «Interior», que no existía como opción en el
checkout: no se le podía vender a nadie fuera del AMBA.

Ahora hay un solo módulo con las zonas y sus precios, del que leen la
calculadora de la ficha, el selector del carrito y el cálculo del checkout. La
calculadora dejó de adivinar por código postal y ofrece exactamente las mismas
zonas que después se eligen al pagar.

| Zona | Costo | Demora | ¿Entra en la promo? |
|---|---|---|---|
| Retiro en persona (Zona Sur) | $0 | a coordinar | — |
| CABA y GBA | $6.500 | 1 a 3 días hábiles | sí |
| Interior del país | $12.000 | 3 a 7 días hábiles | **no** |

Tres zonas, no cuatro. Había una tarifa de «Zona Sur» a $3.500 que era la
mitad del costo real — la competencia cobra entre $6.045 y $9.036 para
despachar a ese mismo CP — y con envío gratis desde 2 unidades cada pedido
perdía plata. Quien está en Zona Sur ya tiene el retiro en persona a $0, así
que no hace falta además una tarifa propia más barata.

**El envío gratis cubre sólo CABA y GBA.** Al interior se cobra siempre, aun
con suscripción: despachar ahí cuesta el doble y no es el público al que se
apunta. Es lo mismo que hacen las marcas líderes del rubro — regalan el envío
sólo donde les sale barato.

Los montos son la estructura acordada, **pendientes de contrastar con una
cotización real** de correo por peso (~500 g un frasco, ~1,5 kg un pack de 3).
Nota: el precio es plano por zona y no por peso, así que un pack de 3 cuesta
despacharlo bastante más que una unidad — justo cuando el envío es gratis.

**El envío gratis se gana por cantidad, no por monto.** El umbral anterior
($80.000) era inalcanzable: con productos de ~$22.000 hacían falta 5 unidades.
La promesa estaba escrita en toda la tienda y no la cobraba nadie. Por
unidades es alcanzable, se entiende sin hacer cuentas y empuja hacia el pack.

Bajo el CTA se comunica el rango («Envío de $3.500 a $10.000 según zona») y
cuántas unidades faltan. El costo nunca aparece por primera vez en el checkout.

## C · Motor de precios · `src/lib/pricing.ts`

Módulo único con las constantes y una función que devuelve el precio unitario
aplicando el descuento mayor:

- suscripción: 20%
- cantidad: 2 u → 10%, 3 u o más → 15%
- transferencia: 10%, sólo informativo y sólo cuando no hay otro descuento

Lo importan la ficha, el carrito y el checkout. Una sola fuente de verdad evita
que los tres muestren números distintos.

Seguridad: `checkout.ts` ya relee precio y stock de Supabase e ignora lo que
manda el navegador. El descuento se recalcula ahí también, sobre el precio de
la base. El cliente sólo manda `slug`, `qty` y `modalidad`.

## D · Carrito

`CartItem` suma `modalidad: 'unica' | 'suscripcion'` y `frecuencia?: number`.

Hoy la identidad del ítem es el `slug`, así que una suscripción y una compra
única del mismo producto se pisarían entre sí. La clave pasa a ser
`slug::modalidad`. Eso obliga a subir la clave de `localStorage` a
`remanso-cart-v2`: los carritos viejos se descartan limpio en vez de romperse
al leer una forma que ya no existe.

El drawer muestra el badge «Suscripción · cada 30 días» y el precio de lista
tachado cuando hay descuento.

## E · Campos nuevos

| Campo | Tipo | Para qué |
|---|---|---|
| `ingredientes_destacados` | jsonb | cards de «Por qué funciona»: `[{nombre, texto, imagen}]` |
| `suscribible` | boolean, default true | oculta la opción de suscripción donde no tiene sentido |
| `badge` | text | «Más vendido», «Nuevo», editable desde el panel |

Migración idempotente con `add column if not exists`, siguiendo el patrón que
ya usa `supabase/schema.sql`. Se sincronizan `types.ts`, `catalog.ts`,
`content.config.ts` y los cuatro `.md` locales que sirven de fallback.

En el panel: editor repetible de ingredientes destacados reusando `imgWidget()`,
checkbox de suscribible e input de badge. El tope de `beneficios` sube de 3 a 6,
porque una grilla de dos columnas con tres ítems queda coja.

## F · Upsell: un solo momento

Las marcas líderes del rubro interrumpen cuatro veces: un modal al agregar al
carrito, otro modal encima con más sugerencias, una fila en el carrito y otra
en el checkout. Convierte, pero la compra se siente una pelea.

Acá hay **una sola superficie de upsell: el carrito**. Es el momento donde la
persona ya decidió comprar, así que sumar algo cuesta poco, y una fila que no
tapa nada se puede ignorar sin fricción. Hasta tres productos que todavía no
lleva, **con los kits primero** — un combo es la venta que más conviene y la
que más sentido tiene ofrecerle a alguien que ya eligió un extracto. El título
cambia a «Completá tu ritual» cuando lo primero que se sugiere es un kit.

Se suma a la fila de cross-sell que ya está en la ficha, debajo del CTA. Dos
momentos en total, ninguno bloqueante, ningún modal.

## G · Reseñas y el sello «Compra verificada»

El sello sólo puede ir en una reseña que corresponda a un pedido real. Por eso
el default del campo `verificada` es **false** tanto en el esquema de contenido
como en el mapeo desde Supabase, y el resumen dejó de decir «de compras
verificadas» en bloque: eso sólo vale para las reseñas marcadas una por una.

Reseñas de siembra con sello de verificadas son publicidad engañosa bajo la
Ley 24.240, y en un producto que se ingiere es el peor lugar donde arriesgarse.
Lo que sí sirve para la primera venta: garantía de devolución (verificable,
pesa más que un testimonio anónimo) y sembrar reseñas reales regalando producto
a cambio de una opinión honesta, publicada como tal.

## Fuera de alcance

- Preapproval de Mercado Pago (cobro recurrente automático, tabla de
  suscriptores, webhook de renovación, cancelación desde el panel).
- Rediseño del catálogo o del carrito más allá de lo que exige la modalidad.
- Fotos reales de producto e ingredientes: el diseño degrada a placeholder
  cuando no hay imagen, igual que la galería actual.
