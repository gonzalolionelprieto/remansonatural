import { getCollection, type CollectionEntry } from 'astro:content';
import type { Product, Linea, Tipo, Objetivo } from './types';

export type ProductoEntry = CollectionEntry<'productos'>;

/** Mapea una entrada de la colección al tipo `Product` (agrega slug). */
export function toProduct(entry: ProductoEntry): Product {
  return { slug: entry.id, ...entry.data };
}

/** Todos los productos, ordenados por `orden` y luego por nombre. */
export async function getProducts(): Promise<Product[]> {
  const entries = await getCollection('productos');
  return entries
    .map(toProduct)
    .sort(
      (a, b) =>
        (a.orden ?? 999) - (b.orden ?? 999) ||
        a.nombre.localeCompare(b.nombre, 'es')
    );
}

/** Sólo destacados (para la Home). */
export async function getFeatured(): Promise<Product[]> {
  return (await getProducts()).filter((p) => p.destacado);
}

/** Un producto por slug (para la ficha). Devuelve la entrada cruda + Product. */
export async function getProductEntry(
  slug: string
): Promise<ProductoEntry | undefined> {
  const entries = await getCollection('productos');
  return entries.find((e) => e.id === slug);
}

/** Resuelve varios slugs a productos (cross-sell "combiná con…"). */
export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  const all = await getProducts();
  return slugs
    .map((s) => all.find((p) => p.slug === s))
    .filter((p): p is Product => Boolean(p));
}

/* ---- Metadatos derivados para la UI de filtros ---- */
export interface FacetOption<T extends string> {
  slug: T;
  label: string;
  count: number;
}

export const objetivoLabels: Record<Objetivo, string> = {
  calma: 'Calma & Ansiedad',
  sueno: 'Sueño & Descanso',
  enfoque: 'Enfoque & Claridad',
  ritual: 'Ritual & Espacio',
};

export const lineaLabels: Record<Linea, string> = {
  alquimia: 'Alquimia',
  bach: 'Flores de Bach',
  humos: 'Humos & Ritual',
  cristales: 'Cristales',
};

/** Tipo de producto en lenguaje del cliente. */
export const tipoLabels: Record<Tipo, string> = {
  extracto: 'Extractos de hongos',
  esencia: 'Esencias florales',
  sahumerio: 'Sahumerios',
  cristal: 'Cristales',
  kit: 'Kits & sets',
};

// Orden canónico de los tipos en el sidebar.
const tipoOrden: Tipo[] = ['extracto', 'esencia', 'sahumerio', 'cristal', 'kit'];
const objetivoOrden: Objetivo[] = ['calma', 'sueno', 'enfoque', 'ritual'];

/**
 * Facetas derivadas dinámicamente de los productos presentes (con conteo).
 * Nunca devuelve una opción con 0 resultados, así el filtro no muestra
 * categorías vacías.
 */
export function getFacets(products: Product[]) {
  const countBy = <T extends string>(pick: (p: Product) => T[]) => {
    const map = new Map<T, number>();
    for (const p of products) {
      for (const v of pick(p)) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return map;
  };

  const tipoCounts = countBy((p) => [p.tipo]);
  const objetivoCounts = countBy((p) => p.objetivos);

  const tipos: FacetOption<Tipo>[] = tipoOrden
    .filter((t) => tipoCounts.has(t))
    .map((t) => ({ slug: t, label: tipoLabels[t], count: tipoCounts.get(t)! }));

  const objetivos: FacetOption<Objetivo>[] = objetivoOrden
    .filter((o) => objetivoCounts.has(o))
    .map((o) => ({
      slug: o,
      label: objetivoLabels[o],
      count: objetivoCounts.get(o)!,
    }));

  return { tipos, objetivos };
}
