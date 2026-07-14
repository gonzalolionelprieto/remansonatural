/** Formato de precio en pesos argentinos: 49500 -> "$49.500". */
export function formatPrice(value: number): string {
  return `$${value.toLocaleString('es-AR')}`;
}

/** Precio con descuento por transferencia (10% off), redondeado. */
export function precioTransferencia(value: number, off = 0.1): number {
  return Math.round((value * (1 - off)) / 100) * 100;
}

/** Cuota simple sin interés: 3 cuotas. */
export function cuota(value: number, n = 3): string {
  return formatPrice(Math.round(value / n));
}
