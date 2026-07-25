/**
 * Zonas, costos y regla de envío gratis: fuente única.
 *
 * Antes esto vivía copiado en tres lugares con números distintos: la
 * calculadora de la ficha decía $2.500 para CABA y el checkout cobraba
 * $5.000. Un comprador nuevo que ve un precio en la ficha y otro al pagar
 * no vuelve, y con razón. Ahora la ficha, el carrito y el checkout leen de
 * acá, así que no pueden discrepar.
 */

export interface ZonaEnvio {
  id: string;
  label: string;
  costo: number;
  demora: string;
  /**
   * Si la zona entra en la promo de envío gratis. El interior queda afuera:
   * despachar ahí cuesta el doble y no es el público al que apuntamos. Es lo
   * mismo que hacen las marcas líderes del rubro — regalan el envío sólo
   * donde les sale barato.
   */
  gratisElegible: boolean;
}

/**
 * Tres zonas, no cuatro.
 *
 * Antes había una tarifa de "Zona Sur" a $3.500 que era la mitad del costo
 * real: la competencia cobra entre $6.045 y $9.036 para despachar a ese mismo
 * CP. Con envío gratis desde 2 unidades, cada pedido perdía plata. Quien está
 * en Zona Sur ya tiene la opción de retiro en persona a $0, así que no hace
 * falta además una tarifa propia más barata.
 *
 * Los montos siguen siendo estimados sobre dos datos observados ($6.045 lo
 * más barato a domicilio en GBA Sur, $6.500 en el día) y hay que contrastarlos
 * con una cotización propia por peso: ~500 g un frasco, ~1,5 kg tres.
 */
export const ZONAS: ZonaEnvio[] = [
  { id: 'retiro', label: 'Retiro en persona (Zona Sur)', costo: 0, demora: 'coordinamos por WhatsApp', gratisElegible: true },
  { id: 'caba_gba', label: 'CABA y GBA', costo: 6500, demora: '1 a 3 días hábiles', gratisElegible: true },
  { id: 'interior', label: 'Interior del país', costo: 12000, demora: '3 a 7 días hábiles', gratisElegible: false },
];

/** Cómo se nombra la cobertura de la promo en el copy del sitio. */
export const ZONA_GRATIS_LABEL = 'CABA y GBA';

export const ZONA_DEFAULT = 'caba_gba';

/**
 * Unidades a partir de las cuales el envío es gratis.
 *
 * Es por CANTIDAD y no por monto a propósito. Con umbral en pesos ($80.000)
 * y productos de ~$22.000, hacían falta 5 unidades para alcanzarlo: la
 * promesa estaba escrita en toda la tienda y no la cobraba nadie. Por
 * unidades es alcanzable, se entiende sin hacer cuentas ("llevando 2 o más")
 * y empuja justo hacia donde conviene, que es el pack.
 */
export const ENVIO_GRATIS_UNIDADES = 2;

export interface ContextoEnvio {
  /** Total de unidades en el pedido. */
  unidades: number;
  /** Si hay al menos una suscripción: el envío es gratis desde 1 unidad. */
  haySuscripcion: boolean;
}

/**
 * Si el pedido CALIFICA para el envío gratis por su composición. La zona se
 * chequea aparte: en la ficha todavía no sabemos a dónde va.
 *
 * La suscripción califica desde una sola unidad. Ese es el eje en el que se
 * diferencia de comprar suelto, y lo que evita que las dos ofertas compitan
 * por lo mismo.
 */
export function tieneEnvioGratis({ unidades, haySuscripcion }: ContextoEnvio): boolean {
  return haySuscripcion || unidades >= ENVIO_GRATIS_UNIDADES;
}

export function zonaPorId(id: string): ZonaEnvio {
  return ZONAS.find((z) => z.id === id) ?? ZONAS[1];
}

/** Si un pedido concreto, a una zona concreta, viaja gratis. */
export function envioGratisAplica(ctx: ContextoEnvio, zonaId: string): boolean {
  const z = zonaPorId(zonaId);
  if (z.costo === 0) return true;
  return z.gratisElegible && tieneEnvioGratis(ctx);
}

/** Costo final de envío para un pedido y una zona. */
export function costoEnvio(ctx: ContextoEnvio, zonaId: string): number {
  return envioGratisAplica(ctx, zonaId) ? 0 : zonaPorId(zonaId).costo;
}

/** Envíos con costo (excluye el retiro), para comunicar el rango en la ficha. */
const conCosto = ZONAS.filter((z) => z.costo > 0).map((z) => z.costo);

export const ENVIO_MIN = Math.min(...conCosto);
export const ENVIO_MAX = Math.max(...conCosto);
