/** Modelo de producto. Coincide con la Content Collection del paso 3. */
export type Linea = 'alquimia' | 'bach' | 'humos' | 'cristales';
export type Tipo = 'extracto' | 'esencia' | 'sahumerio' | 'cristal' | 'kit';
export type Objetivo = 'calma' | 'sueno' | 'enfoque' | 'ritual';

export interface Product {
  nombre: string;
  slug: string;
  linea: Linea;
  tipo: Tipo;
  objetivos: Objetivo[];
  precio: number;
  /** Precio de lista antes de un descuento puntual (se muestra tachado si es mayor a `precio`). */
  precioAnterior?: number;
  volumen?: string;
  graduacion?: string;
  descripcionCorta: string;
  /** Hasta 6 frases cortas de venta (card del catálogo + grilla de la ficha). */
  beneficios?: string[];
  paraQueMomento?: string;
  ingredientes?: string;
  modoDeUso?: string;
  advertencias?: string;
  nuestroProceso?: string;
  envioYCuidado?: string;
  descripcionLarga?: string;
  imagenes?: string[];
  destacado?: boolean;
  stock?: number;
  orden?: number;
  combinaCon?: string[];
  reseñas?: Resena[];
  /** Cards del bloque "Por qué funciona" de la ficha. */
  ingredientesDestacados?: IngredienteDestacado[];
  /** Si es false, la ficha no ofrece suscripción (un cristal no se recompra). */
  suscribible?: boolean;
  /** Etiqueta sobre la galería: "Más vendido", "Nuevo". */
  badge?: string;
}

/** Ingrediente o componente explicado en la ficha (bloque educativo). */
export interface IngredienteDestacado {
  nombre: string;
  texto: string;
  imagen?: string;
}

export interface Resena {
  autor: string;
  texto: string;
  estrellas: number;
  fecha?: string;
  verificada?: boolean;
}

/** Color de acento por línea (para el punto en la card). */
export const lineaColor: Record<Linea, string> = {
  alquimia: 'var(--linea-alquimia)',
  bach: 'var(--linea-bach)',
  humos: 'var(--linea-humos)',
  cristales: 'var(--linea-cristales)',
};

/** Etiqueta legible de la línea. */
export const lineaLabel: Record<Linea, string> = {
  alquimia: 'Alquimia',
  bach: 'Flores de Bach',
  humos: 'Humos & Ritual',
  cristales: 'Cristales',
};
