# Deploy — Remanso Natural

Sitio Astro con adaptador de Netlify (funciones serverless para checkout y panel).

## 1. GitHub
El código ya está en este repo. El `.env` **no se sube** (está en `.gitignore`).

## 2. Netlify
1. En [netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub** → elegí este repo.
2. Netlify detecta Astro. Build command: `npm run build` (ya está en `netlify.toml`).
3. **Cargá las variables de entorno** en Site settings → Environment variables
   (los mismos valores de tu `.env` local):

| Variable | Qué es |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | anon key (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (SECRETA) |
| `PANEL_PASSWORD` | contraseña del panel `/panel` |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago (SECRETO) |
| `PUBLIC_MP_PUBLIC_KEY` | Public Key de Mercado Pago |
| `PUBLIC_SITE_URL` | la URL final del sitio (ej. `https://remanso-natural.netlify.app`) |
| `PUBLIC_WHATSAPP` | número de WhatsApp |
| `PUBLIC_CONTACT_EMAIL` | email de contacto |

4. **Deploy**. Al terminar tenés el link (`https://<tu-sitio>.netlify.app`).
5. Volvé a poner `PUBLIC_SITE_URL` con esa URL definitiva y redeploy (así Mercado Pago
   usa el `auto_return` con tu dominio real).

## Notas
- El panel vive en `/<sitio>/panel`.
- Cuando tengas dominio propio, cambialo en `astro.config.mjs` (`site`) y en `PUBLIC_SITE_URL`.
