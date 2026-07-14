// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  // Cambiar a tu dominio real cuando lo tengas (usado por sitemap + canonical + OG).
  site: 'https://remansonatural.com.ar',

  // El sitio es estático; sólo el endpoint de checkout (Mercado Pago) se
  // renderiza on-demand (export const prerender = false en esa ruta).
  output: 'static',
  adapter: netlify(),

  // Imágenes optimizadas por defecto con el servicio integrado de Sharp.
  image: {
    // Placeholder: permitir dominios remotos si más adelante servís fotos desde un CDN.
    remotePatterns: [{ protocol: 'https' }],
  },

  build: {
    // Rutas limpias sin extensión .html
    format: 'directory',
  },
});
