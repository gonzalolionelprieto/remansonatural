import type { Product } from './types';
import { supabase } from './supabase';
import { getProducts as localProducts } from './products';

/** Mapea una fila de la tabla `productos` (snake_case) al tipo `Product`. */
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
    graduacion: r.graduacion ?? undefined,
    descripcionCorta: r.descripcion_corta ?? '',
    beneficios: r.beneficios ?? [],
    paraQueMomento: r.para_que_momento ?? undefined,
    ingredientes: r.ingredientes ?? undefined,
    modoDeUso: r.modo_de_uso ?? undefined,
    nuestroProceso: r.nuestro_proceso ?? undefined,
    envioYCuidado: r.envio_y_cuidado ?? undefined,
    advertencias: r.advertencias ?? undefined,
    descripcionLarga: r.descripcion_larga ?? undefined,
    imagenes: r.imagenes ?? [],
    destacado: r.destacado ?? false,
    stock: r.stock ?? 0,
    orden: r.orden ?? undefined,
    combinaCon: r.combina_con ?? [],
    reseñas: r.resenas ?? [],
  };
}

function sortProducts(a: Product, b: Product) {
  return (
    (a.orden ?? 999) - (b.orden ?? 999) ||
    a.nombre.localeCompare(b.nombre, 'es')
  );
}

/**
 * Cache en memoria de proceso (sobrevive entre requests mientras la función
 * serverless siga "tibia"). Cada página que renderiza llama a getCatalog()
 * o getHomeConfig() por su cuenta (Home, Tienda, la ficha, ProductoEstrella,
 * el Nav para el mega-menú...) y sin esto cada click terminaba disparando
 * 2 o 3 consultas idénticas a Supabase en cadena — el 1-2 seg de demora por
 * navegación que se sentía en todo el sitio. `inFlight` además evita que
 * dos llamadas concurrentes (misma página, distintos componentes) disparen
 * dos consultas en paralelo: la segunda espera el mismo resultado.
 * IMPORTANTE: el checkout NO pasa por acá — hace su propia consulta directa
 * a Supabase para validar stock/precio con datos siempre frescos.
 */
const CACHE_TTL_MS = 30_000;

let catalogCache: Product[] | null = null;
let catalogCacheTime = 0;
let catalogInFlight: Promise<Product[]> | null = null;

async function fetchCatalogFresh(): Promise<Product[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true);
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(rowToProduct).sort(sortProducts);
      }
    } catch {
      /* red o tabla inexistente → fallback */
    }
  }
  return localProducts();
}

/**
 * Catálogo: lee de Supabase si está configurado y tiene datos; si no, cae
 * al catálogo local (Content Collection). Así el sitio funciona siempre.
 */
export async function getCatalog(): Promise<Product[]> {
  if (catalogCache && Date.now() - catalogCacheTime < CACHE_TTL_MS) {
    return catalogCache;
  }
  if (!catalogInFlight) {
    catalogInFlight = fetchCatalogFresh()
      .then((data) => {
        catalogCache = data;
        catalogCacheTime = Date.now();
        return data;
      })
      .finally(() => {
        catalogInFlight = null;
      });
  }
  return catalogInFlight;
}

/** El panel escribe directo en Supabase (no pasa por este cache): lo llama
 *  después de guardar/borrar un producto para que la vista previa no
 *  muestre datos de hasta 30s atrás. */
export function invalidateCatalogCache(): void {
  catalogCache = null;
  catalogCacheTime = 0;
}

export async function getCatalogBySlug(slug: string): Promise<Product | null> {
  const all = await getCatalog();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getCatalogFeatured(): Promise<Product[]> {
  return (await getCatalog()).filter((p) => p.destacado);
}

export async function getCatalogBySlugs(slugs: string[]): Promise<Product[]> {
  const all = await getCatalog();
  return slugs
    .map((s) => all.find((p) => p.slug === s))
    .filter((p): p is Product => Boolean(p));
}

let homeConfigCache: Record<string, any> | null = null;
let homeConfigCacheTime = 0;
let homeConfigInFlight: Promise<Record<string, any>> | null = null;

async function fetchHomeConfigFresh(): Promise<Record<string, any>> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('home_config')
        .select('data')
        .eq('id', 1)
        .single();
      if (data?.data) return data.data as Record<string, any>;
    } catch {
      /* fallback vacío */
    }
  }
  return {};
}

/**
 * Config editable del Home + Nav (hero, bento, producto estrella, mega-menú).
 * Devuelve {} si no está configurado. Mismo cache que getCatalog() y por la
 * misma razón: el Nav la llama en TODAS las páginas para el mega-menú.
 */
export async function getHomeConfig(): Promise<Record<string, any>> {
  if (homeConfigCache && Date.now() - homeConfigCacheTime < CACHE_TTL_MS) {
    return homeConfigCache;
  }
  if (!homeConfigInFlight) {
    homeConfigInFlight = fetchHomeConfigFresh()
      .then((data) => {
        homeConfigCache = data;
        homeConfigCacheTime = Date.now();
        return data;
      })
      .finally(() => {
        homeConfigInFlight = null;
      });
  }
  return homeConfigInFlight;
}

/** Mismo motivo que invalidateCatalogCache(): lo llama el panel tras
 *  guardar la config del sitio (hero, bento, estrella, mega-menú). */
export function invalidateHomeConfigCache(): void {
  homeConfigCache = null;
  homeConfigCacheTime = 0;
}
