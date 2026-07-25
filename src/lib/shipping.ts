/**
 * Zonas, costos y regla de envío gratis: fuente única.
 *
 * Antes esto vivía copiado en tres lugares con números distintos: la
 * calculadora de la ficha decía $2.500 para CABA y el checkout cobraba
 * $5.000. Un comprador nuevo que ve un precio en la ficha y otro al pagar
 * no vuelve, y con razón.
 *
 * Los valores de acá son el DEFAULT y el fallback. Los reales se editan
 * desde el panel (tabla config_comercial) y llegan por `setConfigEnvios`,
 * así cambiar una tarifa no necesita un deploy.
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

export interface ConfigEnvios {
  zonas: ZonaEnvio[];
  /** Unidades a partir de las cuales el envío es gratis. */
  envioGratisUnidades: number;
  /** Cómo se nombra la cobertura de la promo en el copy del sitio. */
  zonaGratisLabel: string;
}

/**
 * Tres zonas, no cuatro. Había una tarifa de "Zona Sur" a $3.500 que era la
 * mitad del costo real: la competencia cobra entre $6.045 y $9.036 para
 * despachar a ese mismo CP. Quien está en Zona Sur ya tiene la opción de
 * retiro en persona a $0.
 *
 * El envío gratis se gana por CANTIDAD y no por monto: con umbral en pesos
 * ($80.000) y productos de ~$22.000 hacían falta 5 unidades, así que la
 * promesa estaba escrita en toda la tienda y no la cobraba nadie.
 */
export const DEFAULTS_ENVIOS: ConfigEnvios = {
  zonas: [
    { id: 'retiro', label: 'Retiro en persona (Zona Sur)', costo: 0, demora: 'coordinamos por WhatsApp', gratisElegible: true },
    { id: 'caba_gba', label: 'CABA y GBA', costo: 6500, demora: '1 a 3 días hábiles', gratisElegible: true },
    { id: 'interior', label: 'Interior del país', costo: 12000, demora: '3 a 7 días hábiles', gratisElegible: false },
  ],
  envioGratisUnidades: 2,
  zonaGratisLabel: 'CABA y GBA',
};

let cfg: ConfigEnvios | null = null;

/** Igual que en pricing.ts: en el navegador la config viene embebida. */
function leerConfig(): ConfigEnvios {
  if (cfg) return cfg;
  if (typeof document !== 'undefined') {
    const el = document.querySelector('[data-config-comercial]');
    if (el?.textContent) {
      try {
        const raw = JSON.parse(el.textContent) as Partial<ConfigEnvios>;
        cfg = normalizar(raw);
        return cfg;
      } catch {
        /* config rota: seguimos con los defaults */
      }
    }
  }
  cfg = { ...DEFAULTS_ENVIOS };
  return cfg;
}

/** Nunca dejamos la lista de zonas vacía: sin zonas no se puede vender. */
function normalizar(p: Partial<ConfigEnvios>): ConfigEnvios {
  const zonas = Array.isArray(p.zonas) && p.zonas.length > 0 ? p.zonas : DEFAULTS_ENVIOS.zonas;
  return {
    zonas,
    envioGratisUnidades: Number(p.envioGratisUnidades) > 0
      ? Number(p.envioGratisUnidades)
      : DEFAULTS_ENVIOS.envioGratisUnidades,
    zonaGratisLabel: p.zonaGratisLabel || DEFAULTS_ENVIOS.zonaGratisLabel,
  };
}

/** La usa el servidor (BaseLayout y el checkout) con lo que hay en la base. */
export function setConfigEnvios(p: Partial<ConfigEnvios> | null | undefined): void {
  cfg = normalizar(p ?? {});
}

export const zonas = (): ZonaEnvio[] => leerConfig().zonas;
export const envioGratisUnidades = (): number => leerConfig().envioGratisUnidades;
export const zonaGratisLabel = (): string => leerConfig().zonaGratisLabel;

/** La zona preseleccionada: la primera que tiene costo (no el retiro). */
export const zonaDefault = (): string =>
  zonas().find((z) => z.costo > 0)?.id ?? zonas()[0].id;

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
  return haySuscripcion || unidades >= envioGratisUnidades();
}

export function zonaPorId(id: string): ZonaEnvio {
  const lista = zonas();
  return lista.find((z) => z.id === id) ?? lista[0];
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
function conCosto(): number[] {
  const v = zonas().filter((z) => z.costo > 0).map((z) => z.costo);
  return v.length > 0 ? v : [0];
}

export const envioMin = (): number => Math.min(...conCosto());
export const envioMax = (): number => Math.max(...conCosto());
