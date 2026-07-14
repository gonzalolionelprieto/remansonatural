import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

const configured = Boolean(url && anon && !url.includes('xxxx'));

/**
 * Cliente público (lectura). Es `null` si todavía no configuraste Supabase,
 * de modo que el sitio pueda seguir funcionando con el catálogo local.
 */
export const supabase: SupabaseClient | null = configured
  ? createClient(url!, anon!)
  : null;

export const supabaseConfigured = configured;

/**
 * Cliente admin (service role). SÓLO servidor — nunca importar en cliente.
 * Bypassa RLS para que el panel pueda escribir.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const service =
    (import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined) ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}
