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
  volumen?: string;
  graduacion?: string;
  descripcionCorta: string;
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
