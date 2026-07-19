import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

// Endpoint on-demand: guarda el email en newsletter_subscribers.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const admin = supabaseAdmin();
  if (!admin) return json({ error: 'Supabase no configurado en el servidor.' }, 503);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Email inválido' }, 400);

  const { error } = await admin
    .from('newsletter_subscribers')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });

  // Si ya estaba suscripto no es un error para el usuario, es éxito igual.
  if (error) return json({ error: error.message }, 502);
  return json({ ok: true });
};
