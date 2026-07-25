/**
 * Motor de precios: una sola fuente de verdad para los descuentos.
 *
 * La ficha, el carrito y el checkout calculan el precio con estas mismas
 * funciones. Si viven en tres lugares distintos terminan mostrando tres
 * números distintos, que es la forma más rápida de perder la venta.
 *
 * REGLA CENTRAL: los descuentos NO se acumulan. Se aplica el mayor.
 */

export type Modalidad = 'unica' | 'suscripcion';

/* El envío gratis dejó de depender de un monto: ahora se gana por cantidad
   o por suscribirse. La regla vive en lib/shipping.ts. */

/**
 * Descuento por suscribirse. Es 15% y NO 20% a propósito: la suscripción
 * además lleva envío gratis siempre, sin mínimo. Sumado, el beneficio real
 * es mayor que el 20% pelado, y se comunica entero ("15% + envío gratis")
 * en vez de esconder la mitad.
 */
export const SUSCRIPCION_OFF = 0.15;

/**
 * Descuento por pagar con transferencia.
 *
 * El 18,5% no es generosidad: es lo que cuesta cobrar con tarjeta. Entre la
 * comisión de Mercado Pago y las 3 cuotas sin interés —que en Argentina las
 * financia el vendedor, no el banco— la venta con tarjeta deja cerca de 18
 * puntos menos. El precio de lista absorbe ese costo y quien paga por
 * transferencia no lo paga.
 *
 * Con el extracto a $27.000 da exactamente $22.000.
 *
 * Es informativo: se comunica en la ficha pero se coordina fuera de Mercado
 * Pago. Y no compite con la suscripción, porque una suscripción necesita
 * débito automático con tarjeta: son excluyentes por naturaleza.
 */
export const TRANSFERENCIA_OFF = 0.185;

/** Frecuencias de suscripción ofrecidas (en días). La primera es la default. */
export const FRECUENCIAS = [30, 45, 60] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const FRECUENCIA_LABEL: Record<Frecuencia, string> = {
  30: 'Cada 30 días',
  45: 'Cada 45 días',
  60: 'Cada 60 días',
};

/*
 * NO hay descuento por cantidad del mismo producto.
 *
 * Se probó con packs de 2 y 3 unidades y se sacó a propósito: ninguna de las
 * dos marcas líderes del rubro los usa, y con razón. Nadie quiere tres
 * frascos iguales — son medio año del mismo sabor, un compromiso enorme para
 * alguien que compra por primera vez.
 *
 * La jugada de volumen son los COMBOS: productos distintos armados como kit
 * (el Kit Ritual de Calma). Son una compra de descubrimiento, hacen probar
 * toda la línea y su precio no se compara fácil contra un competidor.
 *
 * El incentivo a llevar más de uno queda en el envío gratis desde 2 unidades
 * (ver lib/shipping.ts), que no cuesta margen de producto.
 */

export interface PrecioInput {
  /** Precio de lista del producto (siempre el de la base, nunca el del navegador). */
  precio: number;
  modalidad: Modalidad;
  qty: number;
}

export interface PrecioCalculado {
  /** Precio unitario ya con descuento, redondeado a centenas. */
  unitario: number;
  /** Precio de lista, para tacharlo cuando hay descuento. */
  lista: number;
  /** Total de la línea: unitario × cantidad. */
  total: number;
  /** Descuento aplicado, 0 a 1. */
  off: number;
  /** De dónde sale el descuento aplicado. */
  origen: 'ninguno' | 'suscripcion';
  /** Cuánto se ahorra en total respecto del precio de lista. */
  ahorro: number;
}

/** Redondeo a centenas: los precios de la tienda son "redondos" ($39.600). */
function redondear(v: number): number {
  return Math.round(v / 100) * 100;
}

/** Precio de una línea. Hoy el único descuento sobre el producto es la suscripción. */
export function calcularPrecio({
  precio,
  modalidad,
  qty,
}: PrecioInput): PrecioCalculado {
  const cantidad = Math.max(1, Math.floor(qty) || 1);
  const off = modalidad === 'suscripcion' ? SUSCRIPCION_OFF : 0;
  const origen: PrecioCalculado['origen'] =
    off === 0 ? 'ninguno' : 'suscripcion';

  const unitario = off > 0 ? redondear(precio * (1 - off)) : precio;

  return {
    unitario,
    lista: precio,
    total: unitario * cantidad,
    off,
    origen,
    ahorro: (precio - unitario) * cantidad,
  };
}

/**
 * El descuento por transferencia sólo se comunica cuando no hay otro
 * descuento activo: si ya está pagando 15% menos por suscribirse, prometerle
 * otro 10% encima es una promesa que no vamos a cumplir.
 */
export function muestraTransferencia(p: PrecioCalculado): boolean {
  return p.off === 0;
}

/** Precio pagando por transferencia (sólo tiene sentido si `muestraTransferencia`). */
export function precioTransferencia(precio: number): number {
  return redondear(precio * (1 - TRANSFERENCIA_OFF));
}

/**
 * Etiqueta corta del descuento, para badges: "15% off".
 *
 * Redondea SIEMPRE para abajo. El descuento real varía unas décimas según el
 * redondeo a centenas de cada producto, y prometer un punto de más que el que
 * se aplica es exactamente el tipo de detalle que hace desconfiar del resto
 * de la página.
 */
export function etiquetaOff(off: number): string {
  return `${Math.floor(off * 100)}% off`;
}

/** Porcentaje mostrable de un descuento, redondeado para abajo. */
export function porcentajeOff(off: number): number {
  return Math.floor(off * 100);
}

/** Normaliza lo que llega del navegador a una modalidad válida. */
export function parseModalidad(v: unknown): Modalidad {
  return v === 'suscripcion' ? 'suscripcion' : 'unica';
}

/** Normaliza una frecuencia recibida del navegador. */
export function parseFrecuencia(v: unknown): Frecuencia {
  const n = Number(v);
  return (FRECUENCIAS as readonly number[]).includes(n) ? (n as Frecuencia) : 30;
}
