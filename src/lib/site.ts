/**
 * Configuración global del sitio: metadatos, navegación y contacto.
 * Fuente única para Nav, Footer y SEO.
 */

export const site = {
  name: 'Remanso Natural',
  tagline: 'Rituales de calma, hechos a mano',
  description:
    'Botica holística artesanal. Extractos dobles de hongos adaptógenos, flores de Bach, sahumerios y cristales para acompañar tus momentos de calma.',
  // Cambiar por el dominio real cuando esté disponible.
  url: 'https://remansonatural.com.ar',
  locale: 'es_AR',
  // Datos de contacto (idealmente vía env en producción).
  whatsapp: import.meta.env.PUBLIC_WHATSAPP ?? '5491100000000',
  email: import.meta.env.PUBLIC_CONTACT_EMAIL ?? 'hola@remansonatural.com.ar',
} as const;

/** Aviso legal ANMAT — obligatorio en footer y en cada ficha. */
export const disclaimer =
  'Producto de bienestar. No es un medicamento; no reemplaza tratamientos ni consultas médicas. Consultá a un profesional ante embarazo, lactancia o medicación. Mantener fuera del alcance de niños.';

/** Navegación principal (menú superior). */
export const mainNav = [
  { label: 'Tienda', href: '/tienda' },
  { label: 'Test de Bienestar', href: '/test' },
  { label: 'Nuestro método', href: '/metodo' },
  { label: 'Filosofía', href: '/filosofia' },
  { label: 'Ayuda', href: '/ayuda' },
] as const;

/** Objetivos (navegación por beneficio). */
export const objetivos = [
  { slug: 'calma', label: 'Calma & Ansiedad', desc: 'Para aquietar la mente' },
  { slug: 'sueno', label: 'Sueño & Descanso', desc: 'Para dormir mejor' },
  { slug: 'enfoque', label: 'Enfoque & Claridad', desc: 'Para concentrarte' },
  { slug: 'ritual', label: 'Ritual & Espacio', desc: 'Para tu momento' },
] as const;

/** Líneas de producto con su color de acento. */
export const lineas = [
  { slug: 'alquimia', label: 'Alquimia', color: 'var(--linea-alquimia)' },
  { slug: 'bach', label: 'Flores de Bach', color: 'var(--linea-bach)' },
  { slug: 'humos', label: 'Humos & Ritual', color: 'var(--linea-humos)' },
  { slug: 'cristales', label: 'Cristales', color: 'var(--linea-cristales)' },
] as const;

/** Tipos de producto (navegación por formato). */
export const tipos = [
  { slug: 'extracto', label: 'Extractos de hongos' },
  { slug: 'esencia', label: 'Esencias florales' },
  { slug: 'sahumerio', label: 'Sahumerios' },
  { slug: 'cristal', label: 'Cristales' },
  { slug: 'kit', label: 'Kits & sets' },
] as const;

/** Columnas del footer. */
export const footerNav = {
  tienda: {
    title: 'Tienda',
    links: [
      { label: 'Calma & Ansiedad', href: '/tienda?objetivo=calma' },
      { label: 'Sueño & Descanso', href: '/tienda?objetivo=sueno' },
      { label: 'Enfoque & Claridad', href: '/tienda?objetivo=enfoque' },
      { label: 'Ritual & Espacio', href: '/tienda?objetivo=ritual' },
    ],
  },
  lineas: {
    title: 'Tipo de producto',
    links: [
      { label: 'Extractos de hongos', href: '/tienda?tipo=extracto' },
      { label: 'Esencias florales', href: '/tienda?tipo=esencia' },
      { label: 'Sahumerios', href: '/tienda?tipo=sahumerio' },
      { label: 'Cristales', href: '/tienda?tipo=cristal' },
    ],
  },
  ayuda: {
    title: 'Ayuda',
    links: [
      { label: 'Cómo usar', href: '/ayuda#como-usar' },
      { label: 'Envíos', href: '/ayuda#envios' },
      { label: 'Cambios y devoluciones', href: '/ayuda#cambios' },
      { label: 'Preguntas frecuentes', href: '/ayuda#faq' },
      { label: 'Contacto', href: '/ayuda#contacto' },
    ],
  },
} as const;
