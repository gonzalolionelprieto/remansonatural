# Remanso Natural · Tienda online

Botica holística artesanal (100% online). Astro + TypeScript, CSS con tokens,
carrito client-side y checkout con Mercado Pago. Sin costos fijos mensuales.

## Requisitos

- Node 18.20.8+ / 20.3+ / 22+ (probado con Node 22)

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Comando           | Qué hace                               |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Servidor de desarrollo                 |
| `npm run build`   | Build de producción a `dist/`          |
| `npm run preview` | Previsualiza el build local            |
| `npm run check`   | Chequeo de tipos de Astro/TS           |

## Estructura

```
src/
  components/   # Nav, Footer, Logo, AnnounceBar, WhatsAppFab, ...
  layouts/      # BaseLayout (head SEO, view transitions, slots)
  lib/          # site.ts (config: nav, contacto, disclaimer)
  scripts/      # reveal.ts (animaciones on-scroll)
  styles/       # tokens.css, global.css, animations.css
  pages/        # rutas
public/         # favicon, imágenes estáticas, OG
```

## Variables de entorno

Copiá `.env.example` a `.env` y completá. Nunca commitees `.env`.
Se usan en el paso de checkout (Mercado Pago).

## Deploy

Pensado para Vercel o Netlify (plan gratuito). El adaptador se agrega en el
paso de checkout, cuando el endpoint de preferencia de Mercado Pago necesita
ejecutarse on-demand. (Instrucciones detalladas al final del proyecto.)

## Marca

- Verde bosque `#2F4A3A` · Salvia `#6B8469` · Tierra `#A87C5A` · Crema `#F4F1EA` · Negro cálido `#1E1E1E`
- Tipografías: Fraunces (títulos) · Inter (texto) — self-hosted vía @fontsource

## Legal (Argentina / ANMAT)

Sin claims médicos. Comunicación por bienestar y momento. Disclaimer visible en
footer y en cada ficha. Botón de arrepentimiento y link a Defensa del
Consumidor presentes (obligatorios).
