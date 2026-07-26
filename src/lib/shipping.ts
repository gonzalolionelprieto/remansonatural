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

/**
 * Zonas de cobertura, deducidas del código postal.
 *
 * `sur` está separada de `gba` porque el envío propio en 24 h sólo llega ahí
 * y a CABA: sin esa distinción no se podría ofrecer.
 */
export const ZONAS_CP = ['caba', 'sur', 'gba', 'interior'] as const;
export type ZonaCP = (typeof ZONAS_CP)[number];

export const ZONA_CP_LABEL: Record<ZonaCP, string> = {
  caba: 'CABA',
  sur: 'Zona Sur (GBA)',
  gba: 'Resto de GBA',
  interior: 'Interior del país',
};

/**
 * Una forma concreta de recibir el pedido: un servicio con su precio.
 *
 * Antes esto era "una tarifa por zona", pero el mismo destino admite varios
 * servicios a precios distintos (Correo Clásico, Expreso, a sucursal, envío
 * propio). Modelarlo como opciones permite ofrecer todas y que el cliente
 * elija, en vez de imponerle una.
 *
 * Para un mismo servicio a distinto precio según el destino se cargan dos
 * opciones separadas. Es una fila más en el panel y evita una matriz
 * servicio × zona que sería imposible de editar a mano.
 */
export interface OpcionEnvio {
  id: string;
  label: string;
  costo: number;
  demora: string;
  /** Zonas donde esta opción está disponible. */
  zonasCP: ZonaCP[];
  /**
   * Si entra en la promo de envío gratis. El interior queda afuera:
   * despachar ahí cuesta casi el doble y no es el público al que apuntamos.
   * Es lo mismo que hacen las marcas líderes del rubro — regalan el envío
   * sólo donde les sale barato.
   */
  gratisElegible: boolean;
}

/** Alias histórico: medio proyecto todavía la nombra así. */
export type ZonaEnvio = OpcionEnvio;

export interface ConfigEnvios {
  /** Las opciones de envío. Se sigue llamando `zonas` por compatibilidad
   *  con la config ya guardada en la base. */
  zonas: OpcionEnvio[];
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
/**
 * Precios de referencia tomados de una cotización real de Correo Argentino
 * (Lomas de Zamora → Lomas de Zamora, 1 kg, 20×10×15 cm): Clásico $8.046 y
 * Expreso $8.853. Ese es el piso: si el envío local ya cuesta eso, no hay
 * tarifa por debajo de los $8.000 que sea real.
 *
 * PENDIENTE de cotizar: el retiro en sucursal y el interior. Los valores de
 * abajo son estimados y están marcados como tales.
 */
export const DEFAULTS_ENVIOS: ConfigEnvios = {
  zonas: [
    { id: 'retiro', label: 'Retiro en persona (Zona Sur)', costo: 0, demora: 'coordinamos por WhatsApp', zonasCP: ['sur'], gratisElegible: true },
    { id: 'propio_24', label: 'Envío propio en menos de 24 h', costo: 15000, demora: 'menos de 24 h', zonasCP: ['caba', 'sur'], gratisElegible: false },
    { id: 'ca_sucursal', label: 'Correo Argentino · retiro en sucursal', costo: 7000, demora: '2 a 5 días hábiles', zonasCP: ['caba', 'sur', 'gba'], gratisElegible: true },
    { id: 'ca_clasico', label: 'Correo Argentino Clásico · a domicilio', costo: 8100, demora: '2 a 5 días hábiles', zonasCP: ['caba', 'sur', 'gba'], gratisElegible: true },
    { id: 'ca_expreso', label: 'Correo Argentino Expreso · a domicilio', costo: 8900, demora: '1 a 3 días hábiles', zonasCP: ['caba', 'sur', 'gba'], gratisElegible: false },
    { id: 'ca_interior', label: 'Correo Argentino · interior del país', costo: 12000, demora: '3 a 7 días hábiles', zonasCP: ['interior'], gratisElegible: false },
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

/** Nunca dejamos la lista de opciones vacía: sin opciones no se puede vender. */
function normalizar(p: Partial<ConfigEnvios>): ConfigEnvios {
  const zonas = (
    Array.isArray(p.zonas) && p.zonas.length > 0 ? p.zonas : DEFAULTS_ENVIOS.zonas
  ).map((o) => ({
    ...o,
    // Una opción sin zonas declaradas no aparecería en ningún lado. Si viene
    // de una config vieja (cuando eran zonas y no servicios), la damos por
    // disponible en todas para no dejar la tienda sin envíos.
    zonasCP: Array.isArray(o.zonasCP) && o.zonasCP.length > 0 ? o.zonasCP : [...ZONAS_CP],
  }));
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

/** La opción preseleccionada cuando todavía no sabemos el CP. */
export const zonaDefault = (): string =>
  zonas().find((z) => z.costo > 0)?.id ?? zonas()[0].id;

/**
 * Deduce la zona de cobertura a partir del código postal.
 *
 * Los CP argentinos de 4 dígitos están asignados por región, así que se
 * mapean sin consultar a ningún servicio. Zona Sur se identifica por su
 * rango propio porque es la única donde llega el envío propio en 24 h.
 *
 *   1000–1499  CABA
 *   1800–1899  Zona Sur (Lanús 1824, Lomas 1832, Adrogué 1846, Quilmes 1878,
 *              Berazategui 1884, Florencio Varela 1888)
 *   1870–1879  Avellaneda entra en el mismo rango
 *   1500–1999  resto de GBA (San Isidro 1642, Ramos Mejía 1704, La Plata 1900)
 *   resto      Interior
 *
 * Devuelve null si el CP no es válido: ahí la UI deja elegir a mano.
 */
export function zonaPorCP(cp: string): ZonaCP | null {
  const n = parseInt(String(cp).replace(/\D/g, '').slice(0, 4), 10);
  if (!n || n < 1000 || n > 9999) return null;
  if (n <= 1499) return 'caba';
  if (n >= 1800 && n <= 1899) return 'sur';
  if (n <= 1999) return 'gba';
  return 'interior';
}

/** Opciones disponibles para una zona, de más barata a más cara. */
export function opcionesPara(zona: ZonaCP): OpcionEnvio[] {
  return zonas()
    .filter((o) => (o.zonasCP ?? []).includes(zona))
    .sort((a, b) => a.costo - b.costo);
}

/** La opción preseleccionada de una zona: la más barata que llegue. */
export function opcionDefaultPara(zona: ZonaCP): string | null {
  return opcionesPara(zona)[0]?.id ?? null;
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
