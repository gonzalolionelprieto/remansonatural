import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

const MP_ACCESS_TOKEN =
  import.meta.env.MP_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN ?? '';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, url }) => {
  // 1. Obtener ID del pago
  let paymentId = url.searchParams.get('id') || url.searchParams.get('data.id');
  let topic = url.searchParams.get('topic') || url.searchParams.get('type');

  try {
    const body = await request.json().catch(() => ({}));
    if (body.data?.id) {
      paymentId = String(body.data.id);
    }
    if (body.type) {
      topic = String(body.type);
    }
  } catch {
    // Continuamos con los query params
  }

  // Si no es una notificación de pago, o no hay ID, respondemos 200 para que MP no reintente.
  if (topic !== 'payment' || !paymentId) {
    return json({ ok: true });
  }

  if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN.includes('xxxx')) {
    console.error('[webhook] Falta configurar MP_ACCESS_TOKEN en variables de entorno.');
    return json({ error: 'Falta configurar token del servidor' }, 503);
  }

  try {
    // 2. Consultar el pago en la API de Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
    });

    if (!mpRes.ok) {
      console.error(`[webhook] Error al consultar pago ${paymentId} en Mercado Pago:`, await mpRes.text());
      return json({ error: 'Error al consultar pago' }, 502);
    }

    const payment = await mpRes.json();
    const { status, external_reference: externalReference } = payment;

    // Solo nos interesan los pagos aprobados
    if (status !== 'approved' || !externalReference) {
      return json({ ok: true, status });
    }

    // 3. Actualizar la orden y el stock en Supabase
    const admin = supabaseAdmin();
    if (!admin) {
      console.error('[webhook] Supabase admin no configurado.');
      return json({ error: 'Supabase no disponible' }, 503);
    }

    // Buscar la orden correspondiente
    const { data: orden, error: findError } = await admin
      .from('ordenes')
      .select('*')
      .eq('external_reference', externalReference)
      .single();

    if (findError || !orden) {
      console.error(`[webhook] Orden no encontrada para ref: ${externalReference}`);
      return json({ error: 'Orden no encontrada' }, 404);
    }

    // Evitar procesamiento duplicado
    if (orden.estado === 'aprobado' || orden.estado === 'despachado') {
      return json({ ok: true, message: 'Orden ya procesada anteriormente' });
    }

    // Actualizar estado de la orden
    const { error: updateError } = await admin
      .from('ordenes')
      .update({ estado: 'aprobado' })
      .eq('id', orden.id);

    if (updateError) {
      console.error('[webhook] Error al actualizar estado de la orden:', updateError);
      return json({ error: 'Error al actualizar orden' }, 500);
    }

    // Descontar stock de cada producto
    const items = Array.isArray(orden.items) ? orden.items : [];
    for (const item of items) {
      if (!item.slug || !item.qty) continue;

      // Obtener stock actual
      const { data: prod, error: getProdError } = await admin
        .from('productos')
        .select('stock')
        .eq('slug', item.slug)
        .single();

      if (getProdError || !prod) {
        console.error(`[webhook] No se pudo obtener el stock para el producto ${item.slug}`);
        continue;
      }

      const nuevoStock = Math.max(0, prod.stock - Number(item.qty));

      // Actualizar stock
      await admin
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('slug', item.slug);
    }

    console.log(`[webhook] Pago aprobado procesado correctamente para la orden ${orden.id}`);
    return json({ ok: true });

  } catch (err) {
    console.error('[webhook] Error inesperado procesando webhook:', err);
    return json({ error: 'Error interno del servidor' }, 500);
  }
};
