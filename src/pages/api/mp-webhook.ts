import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { supabaseAdmin } from '../../lib/supabase';

// Mercado Pago llama a este endpoint cuando cambia el estado de un pago.
export const prerender = false;

const env = (k: string) =>
  (import.meta.env[k] as string | undefined) ?? process.env[k] ?? '';

const fmt = (n: number) => `$${Number(n).toLocaleString('es-AR')}`;

/**
 * Valida la firma `x-signature` que manda Mercado Pago.
 *
 * MP arma el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y lo
 * firma con HMAC-SHA256 usando la clave secreta del webhook. Si todavía no
 * cargaste MP_WEBHOOK_SECRET devolvemos `true` (útil en pruebas): el endpoint
 * igual re-consulta el pago real contra la API de MP antes de tocar nada.
 */
function firmaValida(request: Request, dataId: string): boolean {
  const secret = env('MP_WEBHOOK_SECRET');
  if (!secret) {
    console.warn('[mp-webhook] MP_WEBHOOK_SECRET sin configurar: no se verifica la firma.');
    return true;
  }

  const signature = request.headers.get('x-signature') ?? '';
  const requestId = request.headers.get('x-request-id') ?? '';

  const partes = Object.fromEntries(
    signature.split(',').map((p) => {
      const [k, ...v] = p.split('=');
      return [k.trim(), v.join('=').trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(esperado, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Envía un email con Resend (si no está configurado, no rompe nada). */
async function enviarEmail(to: string, subject: string, html: string) {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM') || 'Remanso Natural <onboarding@resend.dev>';
  if (!key || !to) return;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) console.error('[resend]', await r.text());
  } catch (e) {
    console.error('[resend] error', e);
  }
}

export const POST: APIRoute = async ({ request, url }) => {
  // MP espera un 200 rápido siempre; los errores se loguean, no se devuelven.
  try {
    const token = env('MP_ACCESS_TOKEN');
    const admin = supabaseAdmin();
    if (!token || !admin) return new Response('ok', { status: 200 });

    // El id del pago puede venir por query o por body.
    let paymentId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '';
    let tipo = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '';
    try {
      const body = await request.json();
      paymentId = String(body?.data?.id ?? paymentId);
      tipo = String(body?.type ?? body?.topic ?? tipo);
    } catch {
      /* algunos avisos vienen sin body */
    }

    if (!tipo.includes('payment') || !paymentId) {
      return new Response('ok', { status: 200 });
    }

    // 0. Rechazar avisos que no vengan firmados por Mercado Pago.
    if (!firmaValida(request, paymentId)) {
      console.error('[mp-webhook] Firma inválida para el pago', paymentId);
      return new Response('firma inválida', { status: 401 });
    }

    // 1. Consultar el pago real en Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: token });
    const pago = await new Payment(client).get({ id: paymentId });
    const estadoPago = pago.status; // approved | rejected | pending...
    const ref = pago.external_reference;
    if (!ref) return new Response('ok', { status: 200 });

    // 2. Buscar la orden
    const { data: orden } = await admin
      .from('ordenes')
      .select('*')
      .eq('external_reference', ref)
      .single();
    if (!orden) return new Response('ok', { status: 200 });

    // Idempotencia: si ya la procesamos, no repetimos ni mails ni stock.
    if (orden.estado === 'aprobado') return new Response('ok', { status: 200 });

    if (estadoPago !== 'approved') {
      if (estadoPago === 'rejected') {
        await admin.from('ordenes').update({ estado: 'rechazado' }).eq('id', orden.id);
      }
      return new Response('ok', { status: 200 });
    }

    // 3. Marcar como aprobada
    await admin.from('ordenes').update({ estado: 'aprobado' }).eq('id', orden.id);

    // 4. Descontar stock (atómico: una sola sentencia por producto, para que
    //    dos compras simultáneas no puedan vender de más).
    const items: Array<{ slug: string; nombre: string; precio: number; qty: number }> =
      orden.items ?? [];
    for (const it of items) {
      const { error } = await admin.rpc('descontar_stock', {
        p_slug: it.slug,
        p_qty: Number(it.qty),
      });
      if (error) console.error('[mp-webhook] no se pudo descontar stock de', it.slug, error);
    }

    // 5. Emails
    const listaHtml = items
      .map((i) => `<li>${i.qty} × ${i.nombre} — ${fmt(i.precio * i.qty)}</li>`)
      .join('');
    const listaTxt = items.map((i) => `${i.qty} x ${i.nombre}`).join(', ');
    const envioTxt =
      orden.metodo_envio === 'retiro'
        ? 'Retiro en persona'
        : `${orden.direccion}, ${orden.localidad}`;

    // 5a. Al cliente
    await enviarEmail(
      orden.email_cliente,
      '¡Gracias por tu compra! 🌿 Remanso Natural',
      `
      <div style="font-family:system-ui,sans-serif;color:#1E1E1E;max-width:520px">
        <h2 style="color:#2F4A3A">Gracias por elegir tu remanso, ${orden.nombre_cliente} 🌿</h2>
        <p>Recibimos tu pago y ya estamos preparando tu pedido a mano, con cuidado.</p>
        <h3 style="color:#2F4A3A">Tu pedido</h3>
        <ul>${listaHtml}</ul>
        <p>Productos: ${fmt(orden.monto_productos)}<br>
           Envío: ${orden.costo_envio === 0 ? 'Sin cargo' : fmt(orden.costo_envio)}<br>
           <b>Total: ${fmt(orden.monto_total)}</b></p>
        <p><b>Entrega:</b> ${envioTxt}</p>
        <p>Lo despachamos en 24–72 h hábiles y te avisamos por WhatsApp.</p>
        <p style="font-size:12px;color:#6B8469;margin-top:24px">
          Producto de bienestar. No es un medicamento; no reemplaza tratamientos ni consultas médicas.
        </p>
      </div>`
    );

    // 5b. A vos, con el mensaje de WhatsApp listo para copiar y pegar
    const wsp = `¡Hola ${orden.nombre_cliente}! 🌿 Soy de Remanso Natural. Recibimos tu pedido (${listaTxt}) y ya lo estamos preparando a mano. Lo enviamos a: ${envioTxt}. Te aviso apenas lo despache. ¡Gracias por elegirnos!`;
    await enviarEmail(
      env('EMAIL_OWNER'),
      `🔔 Nueva venta — ${fmt(orden.monto_total)} — ${orden.nombre_cliente}`,
      `
      <div style="font-family:system-ui,sans-serif;color:#1E1E1E;max-width:560px">
        <h2 style="color:#2F4A3A">🔔 Nueva venta aprobada</h2>
        <p><b>${orden.nombre_cliente}</b> — ${fmt(orden.monto_total)}</p>
        <ul>${listaHtml}</ul>
        <p><b>Envío:</b> ${orden.metodo_envio} — ${envioTxt}<br>
           <b>WhatsApp:</b> ${orden.whatsapp_cliente}<br>
           <b>Email:</b> ${orden.email_cliente}<br>
           <b>Ref:</b> ${ref}</p>
        <h3 style="color:#2F4A3A">Mensaje listo para WhatsApp</h3>
        <div style="background:#F4F1EA;border-left:3px solid #A87C5A;padding:14px;border-radius:8px;white-space:pre-wrap">${wsp}</div>
        <p style="margin-top:14px">
          <a href="https://wa.me/${String(orden.whatsapp_cliente).replace(/\D/g, '')}?text=${encodeURIComponent(wsp)}"
             style="background:#2F4A3A;color:#F4F1EA;padding:11px 18px;border-radius:10px;text-decoration:none;display:inline-block">
             Abrir WhatsApp con el mensaje
          </a>
        </p>
      </div>`
    );

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('[mp-webhook]', e);
    return new Response('ok', { status: 200 });
  }
};

export const GET: APIRoute = () => new Response('ok', { status: 200 });
