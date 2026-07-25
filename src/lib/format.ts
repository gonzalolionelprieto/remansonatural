/** Formato de precio en pesos argentinos: 49500 -> "$49.500". */
export function formatPrice(value: number): string {
  return `$${value.toLocaleString('es-AR')}`;
}

/* El descuento por transferencia vive en lib/pricing.ts, junto al resto de
   los descuentos, para que no haya dos verdades sobre el mismo número. */

/** Cuota simple sin interés: 3 cuotas. */
export function cuota(value: number, n = 3): string {
  return formatPrice(Math.round(value / n));
}
