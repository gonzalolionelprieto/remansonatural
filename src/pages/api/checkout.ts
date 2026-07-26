import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Endpoint on-demand (no estático): crea una preferencia de Checkout Pro.
export const prerender = false;

// El navegador manda QUÉ se quiere comprar, nunca cuánto sale: el precio y
// el descuento se resuelven acá, contra la base.
interface BodyItem {
  slug: string;
  qty: number;
  modalidad?: string;
  frecuencia?: number;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

import { supabaseAdmin } from '../../lib/supabase';
import {
  calcularPrecio,
  parseModalidad,
  parseFrecuencia,
  FRECUENCIA_LABEL,
  type Modalidad,
  type Frecuencia,
} from '../../lib/pricing';

import { costoEnvio, zonaPorId } from '../../lib/shipping';
import { aplicarComercial } from '../../lib/comercial';

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
      cp?: string;
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

  // Este endpoint no pasa por BaseLayout, así que tiene que cargar la config
  // comercial por su cuenta: es el que efectivamente cobra, y tiene que usar
  // exactamente los mismos descuentos y tarifas que mostró la ficha.
  await aplicarComercial();

  // SEGURIDAD: nunca confiar en el precio que manda el navegador.
  // Sólo tomamos slug + cantidad; el precio, el nombre y el stock salen de la base.
  const { data: dbProductos, error: dbError } = await admin
    .from('productos')
    .select('slug, nombre, precio, activo, stock, suscribible')
    .in('slug', pedido.map((i) => String(i.slug)));

  if (dbError) {
    console.error('[checkout] Error leyendo productos:', dbError);
    return json({ error: 'No se pudo validar el carrito.' }, 502);
  }

  interface LineaPedido {
    slug: string;
    nombre: string;
    /** Precio de lista, tal cual está en la base. */
    lista: number;
    /** Precio unitario ya con el descuento que corresponda. */
    precio: number;
    qty: number;
    stock: number;
    modalidad: Modalidad;
    frecuencia?: Frecuencia;
  }

  const items = pedido
    .map((i): LineaPedido | null => {
      const p = (dbProductos ?? []).find((d) => d.slug === String(i.slug));
      if (!p || !p.activo) return null;

      const qty = Math.min(99, Math.max(1, Math.floor(Number(i.qty)) || 1));
      // Si el producto dejó de ser suscribible entre que lo agregó al carrito
      // y llegó a pagar, la línea vuelve a compra única en vez de cobrarle un
      // 20% de descuento que ya no ofrecemos.
      const modalidad: Modalidad =
        p.suscribible === false ? 'unica' : parseModalidad(i.modalidad);
      const lista = Number(p.precio);
      const { unitario } = calcularPrecio({ precio: lista, modalidad, qty });

      return {
        slug: p.slug,
        nombre: p.nombre,
        lista,
        precio: unitario,
        qty,
        stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
        modalidad,
        ...(modalidad === 'suscripcion'
          ? { frecuencia: parseFrecuencia(i.frecuencia) }
          : {}),
      };
    })
    .filter((i): i is LineaPedido => i !== null);

  if (items.length === 0) {
    return json({ error: 'Los productos del carrito ya no están disponibles.' }, 400);
  }

  // SEGURIDAD: nunca vender más de lo que hay. Si algún ítem no tiene stock
  // suficiente, no creamos la orden y devolvemos el detalle para que el
  // navegador pueda ajustar el carrito y explicarle al cliente qué pasó.
  // Sumamos por slug antes de comparar: un mismo producto puede venir en dos
  // líneas (compra única + suscripción) y por separado cada una pasaría el
  // control mientras que juntas superan el stock.
  const pedidoPorSlug = new Map<string, { nombre: string; qty: number; stock: number }>();
  for (const i of items) {
    const acc = pedidoPorSlug.get(i.slug);
    if (acc) acc.qty += i.qty;
    else pedidoPorSlug.set(i.slug, { nombre: i.nombre, qty: i.qty, stock: i.stock });
  }

  const sinStock = [...pedidoPorSlug.entries()]
    .filter(([, v]) => v.qty > v.stock)
    .map(([slug, v]) => ({ slug, nombre: v.nombre, disponible: v.stock }));

  if (sinStock.length > 0) {
    return json(
      {
        error:
          sinStock.length === 1 && sinStock[0].disponible === 0
            ? `${sinStock[0].nombre} se quedó sin stock.`
            : 'Algunos productos ya no tienen stock suficiente.',
        sinStock,
      },
      409
    );
  }

  // Subtotal calculado con los precios REALES de la base.
  const subtotal = items.reduce((sum, i) => sum + i.precio * i.qty, 0);

  // El envío se cobra siempre y se libera por monto, con suscripción o sin
  // ella. Se recalcula acá sobre el subtotal ya validado contra la base.
  const shippingCost = costoEnvio({ subtotal }, cliente.metodoEnvio);

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
        items: items.map((i) => ({
          slug: i.slug,
          nombre: i.nombre,
          precio: i.precio,
          lista: i.lista,
          qty: i.qty,
          modalidad: i.modalidad,
          ...(i.frecuencia ? { frecuencia: i.frecuencia } : {}),
        })),
        monto_productos: subtotal,
        costo_envio: shippingCost,
        monto_total: total,
        nombre_cliente: cliente.nombre,
        email_cliente: cliente.email,
        whatsapp_cliente: cliente.whatsapp,
        direccion: cliente.direccion,
        localidad: [cliente.localidad, cliente.cp && `CP ${cliente.cp}`]
          .filter(Boolean)
          .join(' · '),
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
    // El título de MP es lo último que ve antes de pagar: si eligió
    // suscripción tiene que decirlo ahí también, no sólo en nuestro carrito.
    const mpItems = items.map((i) => ({
      id: String(i.slug),
      title: (i.modalidad === 'suscripcion'
        ? `${i.nombre} · Suscripción ${(FRECUENCIA_LABEL[i.frecuencia ?? 30] ?? 'Cada 30 días').toLowerCase()}`
        : String(i.nombre)
      ).slice(0, 250),
      quantity: Math.max(1, Math.floor(Number(i.qty)) || 1),
      unit_price: Number(i.precio),
      currency_id: 'ARS',
    }));

    // Si hay costo de envío, agregarlo como item
    if (shippingCost > 0) {
      mpItems.push({
        id: 'envio',
        title: `Envío · ${zonaPorId(cliente.metodoEnvio).label}`,
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

