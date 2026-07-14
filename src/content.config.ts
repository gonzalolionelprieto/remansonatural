import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Colección de productos. Cada producto es un archivo Markdown en
 * src/content/productos/<slug>.md — el nombre del archivo es el slug.
 * El cuerpo Markdown se usa como descripción larga en la ficha (PDP).
 */
const productos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/productos' }),
  schema: z.object({
    nombre: z.string(),
    linea: z.enum(['alquimia', 'bach', 'humos', 'cristales']),
    // Tipo de producto en lenguaje del cliente (facet principal del catálogo).
    tipo: z.enum(['extracto', 'esencia', 'sahumerio', 'cristal', 'kit']),
    objetivos: z.array(z.enum(['calma', 'sueno', 'enfoque', 'ritual'])).min(1),
    precio: z.number().int().positive(),
    volumen: z.string().optional(),
    graduacion: z.string().optional(),
    descripcionCorta: z.string(),
    // Lenguaje ANMAT-seguro: bienestar y momento, nunca claims médicos.
    paraQueMomento: z.string(),
    ingredientes: z.string().optional(),
    modoDeUso: z.string().optional(),
    nuestroProceso: z.string().optional(),
    envioYCuidado: z.string().optional(),
    advertencias: z.string().optional(),
    imagenes: z.array(z.string()).default([]),
    destacado: z.boolean().default(false),
    stock: z.number().int().nonnegative().default(0),
    // Orden manual opcional para "relevancia" (menor = primero).
    orden: z.number().optional(),
    // Cross-sell: slugs de productos que combinan con este.
    combinaCon: z.array(z.string()).default([]),
    reseñas: z
      .array(
        z.object({
          autor: z.string(),
          texto: z.string(),
          estrellas: z.number().min(1).max(5).default(5),
          fecha: z.string().optional(),
          verificada: z.boolean().default(true),
        })
      )
      .default([]),
  }),
});

export const collections = { productos };
