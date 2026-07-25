/**
 * Configuración comercial: descuentos y envíos, editables desde el panel.
 *
 * Antes estos números estaban escritos a mano en pricing.ts y shipping.ts, así
 * que cambiar un porcentaje o el precio de una zona pedía un commit y un
 * deploy. Ahora viven en la tabla `config_comercial` y se aplican en el
 * siguiente render.
 *
 * El código sigue teniendo defaults: si Supabase no está configurado o la
 * consulta falla, la tienda sigue vendiendo con esos valores en vez de
 * romperse o —peor— mostrar precios en cero.
 */
import { supabase } from './supabase';
import {
  DEFAULTS_PRECIOS,
  setConfigPrecios,
  type ConfigPrecios,
} from './pricing';
import {
  DEFAULTS_ENVIOS,
  setConfigEnvios,
  type ConfigEnvios,
} from './shipping';

export type ConfigComercial = ConfigPrecios & ConfigEnvios;

export const DEFAULTS_COMERCIAL: ConfigComercial = {
  ...DEFAULTS_PRECIOS,
  ...DEFAULTS_ENVIOS,
};

/**
 * Mismo cache de proceso que usa catalog.ts: sin esto cada página dispararía
 * su propia consulta y sumaría latencia a cada click.
 */
const CACHE_TTL_MS = 30_000;
let cache: { data: ConfigComercial; at: number } | null = null;
let inFlight: Promise<ConfigComercial> | null = null;

export function invalidateComercialCache(): void {
  cache = null;
  inFlight = null;
}

async function fetchComercial(): Promise<ConfigComercial> {
  if (!supabase) return DEFAULTS_COMERCIAL;
  try {
    const { data, error } = await supabase
      .from('config_comercial')
      .select('data')
      .eq('id', 1)
      .single();
    if (error || !data?.data) return DEFAULTS_COMERCIAL;
    return { ...DEFAULTS_COMERCIAL, ...(data.data as Partial<ConfigComercial>) };
  } catch {
    // La tabla puede no existir todavía (migración sin correr): eso no puede
    // tumbar la tienda.
    return DEFAULTS_COMERCIAL;
  }
}

export async function getComercial(): Promise<ConfigComercial> {
  const ahora = Date.now();
  if (cache && ahora - cache.at < CACHE_TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = fetchComercial()
    .then((data) => {
      cache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Lee la config y la aplica a los módulos de precios y envíos.
 *
 * Lo llama BaseLayout (una vez por render, cubre todo el sitio) y el endpoint
 * de checkout, que no pasa por el layout y necesita los mismos números para
 * cobrar lo que la ficha prometió.
 */
export async function aplicarComercial(): Promise<ConfigComercial> {
  const c = await getComercial();
  setConfigPrecios(c);
  setConfigEnvios(c);
  return c;
}
