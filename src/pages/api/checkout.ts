import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Endpoint on-demand (no estático): crea una preferencia de Checkout Pro.
export const prerender = false;

interface BodyItem {
  slug: string;
  nombre: string;
  precio: number;
  qty: number;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

import { supabaseAdmin } from '../../lib/supabase';

const SHIPPING_RATES: Record<string, number> = {
  sur: 3500,
  caba_gba: 5000,
  norte: 8000,
  retiro: 0,
};

export const POST: APIRoute = async ({ request, url }) => {
  const token =
    import.meta.env.MP_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN ?? '';

  // Sin credenciales reales todavía → mensaje claro (dev).
  if (!token || token.includes('xxxx')) {
    return json(
      {
        error:
          'Falta configurar MP_ACCESS_TOKEN en el archivo .env. Ver .env.example.',
      },
      503
    );
  }

  let body: { 
    items?: BodyItem[]; 
    cliente?: {
      nombre: string;
      email: string;
      whatsapp: string;
      direccion: string;
      localidad: string;
      metodoEnvio: string;
    }
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const pedido = Array.isArray(body.items) ? body.items : [];
  if (pedido.length === 0) return json({ error: 'El carrito está vacío' }, 400);

  const cliente = body.cliente;
  if (!cliente || !cliente.nombre || !cliente.email || !cliente.whatsapp || !cliente.direccion || !cliente.localidad) {
    return json({ error: 'Faltan datos de envío o de contacto' }, 400);
  }

  const admin = supabaseAdmin();
  if (!admin) return json({ error: 'Servidor no configurado.' }, 503);

  // SEGURIDAD: nunca confiar en el precio que manda el navegador.
  // Sólo tomamos slug + cantidad; el precio y el nombre salen de la base.
  const { data: dbProductos, error: dbError } = await admin
    .from('productos')
    .select('slug, nombre, precio, activo')
    .in('slug', pedido.map((i) => String(i.slug)));

  if (dbError) {
    console.error('[checkout] Error leyendo productos:', dbError);
    return json({ error: 'No se pudo validar el carrito.' }, 502);
  }

  const items = pedido
    .map((i) => {
      const p = (dbProductos ?? []).find((d) => d.slug === String(i.slug));
      if (!p || !p.activo) return null;
      return {
        slug: p.slug,
        nombre: p.nombre,
        precio: Number(p.precio),
        qty: Math.min(99, Math.max(1, Math.floor(Number(i.qty)) || 1)),
      };
    })
    .filter((i): i is { slug: string; nombre: string; precio: number; qty: number } => i !== null);

  if (items.length === 0) {
    return json({ error: 'Los productos del carrito ya no están disponibles.' }, 400);
  }

  // Subtotal calculado con los precios REALES de la base.
  const subtotal = items.reduce((sum, i) => sum + i.precio * i.qty, 0);

  // Umbral de envío gratis: 80000
  const shippingCost = (subtotal >= 80000 || cliente.metodoEnvio === 'retiro') 
    ? 0 
    : (SHIPPING_RATES[cliente.metodoEnvio] ?? 3500);

  const total = subtotal + shippingCost;

  const siteUrl =
    import.meta.env.PUBLIC_SITE_URL ??
    process.env.PUBLIC_SITE_URL ??
    url.origin;

  const externalReference = `rn-${Date.now()}`;

  // Registrar orden pendiente en Supabase
  {
    const { error } = await admin
      .from('ordenes')
      .insert({
        external_reference: externalReference,
        estado: 'pendiente',
        items: items.map(i => ({ slug: i.slug, nombre: i.nombre, precio: i.precio, qty: i.qty })),
        monto_productos: subtotal,
        costo_envio: shippingCost,
        monto_total: total,
        nombre_cliente: cliente.nombre,
        email_cliente: cliente.email,
        whatsapp_cliente: cliente.whatsapp,
        direccion: cliente.direccion,
        localidad: cliente.localidad,
        metodo_envio: cliente.metodoEnvio,
      });

    if (error) {
      console.error('[checkout] Error al guardar orden en Supabase:', error);
      return json({ error: 'Error al registrar la orden.' }, 500);
    }
  }

  try {
    const client = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(client);

    // Mapear items de la compra
    const mpItems = items.map((i) => ({
      id: String(i.slug),
      title: String(i.nombre).slice(0, 250),
      quantity: Math.max(1, Math.floor(Number(i.qty)) || 1),
      unit_price: Number(i.precio),
      currency_id: 'ARS',
    }));

    // Si hay costo de envío, agregarlo como item
    if (shippingCost > 0) {
      mpItems.push({
        id: 'envio',
        title: `Envío - ${cliente.metodoEnvio === 'sur' ? 'Zona Sur' : cliente.metodoEnvio === 'norte' ? 'Zona Norte' : 'CABA / GBA'}`,
        quantity: 1,
        unit_price: shippingCost,
        currency_id: 'ARS',
      });
    }

    const result = await preference.create({
      body: {
        items: mpItems,
        payer: {
          name: cliente.nombre,
          email: cliente.email,
          phone: { number: cliente.whatsapp },
        },
        back_urls: {
          success: `${siteUrl}/gracias`,
          failure: `${siteUrl}/tienda`,
          pending: `${siteUrl}/gracias`,
        },
        // MP sólo acepta auto_return con una URL https real (no localhost).
        ...(siteUrl.startsWith('https')
          ? { auto_return: 'approved' as const }
          : {}),
        // MP nos avisa acá cuando el pago se aprueba (marca la orden, descuenta
        // stock y dispara los emails).
        notification_url: `${siteUrl}/api/mp-webhook`,
        statement_descriptor: 'REMANSO NATURAL',
        external_reference: externalReference,
      },
    });

    return json({ init_point: result.init_point, id: result.id });
  } catch (err) {
    console.error('[checkout] Error creando preferencia MP:', err);
    return json({ error: 'No se pudo iniciar el pago. Intentá de nuevo.' }, 502);
  }
};

