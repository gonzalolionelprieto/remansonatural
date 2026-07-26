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
  /** Monto del pedido a partir del cual el envío es gratis. */
  envioGratisDesde: number;
  /** Cómo se nombra la cobertura de la promo en el copy del sitio. */
  zonaGratisLabel: string;
}

/**
 * Tres zonas, no cuatro. Había una tarifa de "Zona Sur" a $3.500 que era la
 * mitad del costo real: la competencia cobra entre $6.045 y $9.036 para
 * despachar a ese mismo CP. Quien está en Zona Sur ya tiene la opción de
 * retiro en persona a $0.
 *
 * El envío se cobra SIEMPRE, con suscripción o sin ella, y se libera recién
 * a partir de un monto. Es lo que hacen las dos marcas líderes del rubro, y
 * la razón es doble: el envío gratis en la suscripción se comía casi todo su
 * margen, y al no cobrarlo en un caso y sí en otro había que explicar en cada
 * pantalla "mirá el total, no el precio del producto". Con la misma regla
 * para todos, el descuento se compara solo.
 *
 * El umbral está en pesos y no en unidades: alcanzable (dos frascos) y no
 * depende de cuántos productos distintos tenga el pedido.
 */
export const DEFAULTS_ENVIOS: ConfigEnvios = {
  zonas: [
    { id: 'retiro', label: 'Retiro en persona (Zona Sur)', costo: 0, demora: 'coordinamos por WhatsApp', gratisElegible: true },
    { id: 'caba_gba', label: 'CABA y GBA', costo: 6500, demora: '1 a 3 días hábiles', gratisElegible: true },
    { id: 'interior', label: 'Interior del país', costo: 12000, demora: '3 a 7 días hábiles', gratisElegible: false },
  ],
  envioGratisDesde: 50000,
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
    envioGratisDesde: Number(p.envioGratisDesde) > 0
      ? Number(p.envioGratisDesde)
      : DEFAULTS_ENVIOS.envioGratisDesde,
    zonaGratisLabel: p.zonaGratisLabel || DEFAULTS_ENVIOS.zonaGratisLabel,
  };
}

/** La usa el servidor (BaseLayout y el checkout) con lo que hay en la base. */
export function setConfigEnvios(p: Partial<ConfigEnvios> | null | undefined): void {
  cfg = normalizar(p ?? {});
}

export const zonas = (): ZonaEnvio[] => leerConfig().zonas;
export const envioGratisDesde = (): number => leerConfig().envioGratisDesde;
export const zonaGratisLabel = (): string => leerConfig().zonaGratisLabel;

/** La zona preseleccionada: la primera que tiene costo (no el retiro). */
export const zonaDefault = (): string =>
  zonas().find((z) => z.costo > 0)?.id ?? zonas()[0].id;

/**
 * Deduce la zona a partir del código postal.
 *
 * Los CP argentinos de 4 dígitos están asignados por región, así que se puede
 * mapear sin consultar a nadie. Es una aproximación deliberada: alcanza para
 * que la persona no tenga que elegir su zona de una lista donde se puede
 * equivocar, que es el error más caro (elige la barata y después hay que
 * pedirle la diferencia).
 *
 *   1000–1499  CABA
 *   1500–1999  GBA (Lomas 1832, Quilmes 1878, San Isidro 1642, La Plata 1900)
 *   resto      Interior
 *
 * Devuelve null si el CP no es válido: ahí la UI deja elegir a mano.
 */
export function zonaPorCP(cp: string): string | null {
  const n = parseInt(String(cp).replace(/\D/g, '').slice(0, 4), 10);
  if (!n || n < 1000 || n > 9999) return null;
  const esAmba = n >= 1000 && n <= 1999;
  // Si la zona del AMBA no existe en la config (la editan desde el panel),
  // caemos a la primera con costo en vez de romper.
  const destino = esAmba ? 'caba_gba' : 'interior';
  return zonas().some((z) => z.id === destino) ? destino : null;
}

export interface ContextoEnvio {
  /** Total del pedido, con los descuentos ya aplicados. */
  subtotal: number;
}

/**
 * Si el pedido CALIFICA para el envío gratis por su monto. La zona se chequea
 * aparte: en la ficha todavía no sabemos a dónde va.
 *
 * La modalidad NO entra en la cuenta: el envío se cobra igual con suscripción
 * o sin ella.
 */
export function tieneEnvioGratis({ subtotal }: ContextoEnvio): boolean {
  return subtotal >= envioGratisDesde();
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
