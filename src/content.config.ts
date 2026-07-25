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
    // Precio de lista antes de un descuento puntual. Si está y es mayor a
    // `precio`, la UI lo muestra tachado. Si no está, no cambia nada.
    precioAnterior: z.number().int().positive().optional(),
    volumen: z.string().optional(),
    graduacion: z.string().optional(),
    descripcionCorta: z.string(),
    // Hasta 6 frases cortas de venta (ej. "500mg de extracto por cápsula").
    // La card del catálogo muestra las primeras 3; la ficha las muestra todas
    // en una grilla de dos columnas. Si está vacío no se muestra nada.
    beneficios: z.array(z.string()).default([]),
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
    // Bloque "Por qué funciona" de la ficha: qué lleva y qué aporta.
    ingredientesDestacados: z
      .array(
        z.object({
          nombre: z.string(),
          texto: z.string(),
          imagen: z.string().optional(),
        })
      )
      .default([]),
    // La suscripción es para productos SELECCIONADOS: los que realmente se
    // consumen mes a mes. Opt-in, para que haya que decidirlo producto por
    // producto en vez de ofrecerla donde no tiene sentido.
    suscribible: z.boolean().default(false),
    // Etiqueta sobre la galería ("Más vendido", "Nuevo").
    badge: z.string().optional(),
    reseñas: z
      .array(
        z.object({
          autor: z.string(),
          texto: z.string(),
          estrellas: z.number().min(1).max(5).default(5),
          fecha: z.string().optional(),
          // Default FALSE a propósito. El sello "Compra verificada" sólo
          // puede ir en una reseña que corresponda a un pedido real: si se
          // pone por defecto termina apareciendo en reseñas de siembra, y
          // eso es publicidad engañosa (Ley 24.240), no una licencia de
          // marketing. Se marca a mano, reseña por reseña.
          verificada: z.boolean().default(false),
        })
      )
      .default([]),
  }),
});

export const collections = { productos };
