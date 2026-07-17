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
 * Catálogo: lee de Supabase si está configurado y tiene datos; si no, cae
 * al catálogo local (Content Collection). Así el sitio funciona siempre.
 */
export async function getCatalog(): Promise<Product[]> {
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

/** Config editable del Home (hero + bento). Devuelve {} si no está configurado. */
export async function getHomeConfig(): Promise<Record<string, any>> {
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
