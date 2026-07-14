import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

const PASSWORD =
  (import.meta.env.PANEL_PASSWORD as string | undefined) ??
  process.env.PANEL_PASSWORD ??
  '';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function checkAuth(pass: string | null): boolean {
  return Boolean(PASSWORD) && pass === PASSWORD;
}

// Campos permitidos de la tabla productos (evita inyección de columnas).
const CAMPOS = [
  'slug', 'nombre', 'linea', 'tipo', 'objetivos', 'precio', 'volumen',
  'graduacion', 'descripcion_corta', 'para_que_momento', 'ingredientes',
  'modo_de_uso', 'nuestro_proceso', 'envio_y_cuidado', 'advertencias',
  'descripcion_larga', 'imagenes', 'destacado', 'stock', 'orden',
  'combina_con', 'resenas', 'activo',
];

function cleanProduct(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of CAMPOS) if (k in input) out[k] = input[k];
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const admin = supabaseAdmin();
  if (!admin) return json({ error: 'Supabase no configurado en el servidor.' }, 503);

  const contentType = request.headers.get('content-type') ?? '';

  // ---- Subida de imagen (multipart) ----
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    if (!checkAuth(String(form.get('password') ?? ''))) return json({ error: 'No autorizado' }, 401);
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'Sin archivo' }, 400);
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `productos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await admin.storage
      .from('remanso')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return json({ error: error.message }, 502);
    const { data } = admin.storage.from('remanso').getPublicUrl(path);
    return json({ url: data.publicUrl });
  }

  // ---- Acciones JSON ----
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }
  if (!checkAuth(String(body.password ?? ''))) return json({ error: 'No autorizado' }, 401);

  const action = body.action as string;

  switch (action) {
    case 'login':
      return json({ ok: true });

    case 'list': {
      const { data, error } = await admin
        .from('productos')
        .select('*')
        .order('orden', { ascending: true, nullsFirst: false });
      if (error) return json({ error: error.message }, 502);
      return json({ productos: data });
    }

    case 'save': {
      const row = cleanProduct(body.product ?? {});
      if (!row.slug || !row.nombre) return json({ error: 'Faltan slug o nombre' }, 400);
      const { data, error } = await admin
        .from('productos')
        .upsert(row, { onConflict: 'slug' })
        .select()
        .single();
      if (error) return json({ error: error.message }, 502);
      return json({ producto: data });
    }

    case 'delete': {
      const slug = String(body.slug ?? '');
      if (!slug) return json({ error: 'Falta slug' }, 400);
      const { error } = await admin.from('productos').delete().eq('slug', slug);
      if (error) return json({ error: error.message }, 502);
      return json({ ok: true });
    }

    case 'getHome': {
      const { data, error } = await admin
        .from('home_config')
        .select('data')
        .eq('id', 1)
        .single();
      if (error) return json({ error: error.message }, 502);
      return json({ data: data?.data ?? {} });
    }

    case 'saveHome': {
      const { error } = await admin
        .from('home_config')
        .upsert({ id: 1, data: body.data ?? {} });
      if (error) return json({ error: error.message }, 502);
      return json({ ok: true });
    }

    case 'listOrders': {
      const { data, error } = await admin
        .from('ordenes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 502);
      return json({ ordenes: data });
    }

    case 'updateOrderState': {
      const id = String(body.id ?? '');
      const estado = String(body.estado ?? '');
      if (!id || !estado) return json({ error: 'Faltan id o estado' }, 400);
      const { error } = await admin
        .from('ordenes')
        .update({ estado })
        .eq('id', id);
      if (error) return json({ error: error.message }, 502);
      return json({ ok: true });
    }

    default:
      return json({ error: 'Acción desconocida' }, 400);
  }
};
