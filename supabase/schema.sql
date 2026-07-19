-- ============================================================
-- Remanso Natural · Esquema de base de datos (Supabase / Postgres)
-- Corré este archivo en el SQL Editor de tu proyecto Supabase.
-- ============================================================

-- ---- Tabla de productos ----
create table if not exists productos (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  nombre        text not null,
  linea         text not null check (linea in ('alquimia','bach','humos','cristales')),
  tipo          text not null check (tipo in ('extracto','esencia','sahumerio','cristal','kit')),
  objetivos     text[] not null default '{}',        -- calma|sueno|enfoque|ritual
  precio        integer not null check (precio >= 0),
  volumen       text,
  graduacion    text,
  descripcion_corta  text,
  para_que_momento   text,
  ingredientes       text,
  modo_de_uso        text,
  nuestro_proceso    text,
  envio_y_cuidado    text,
  advertencias       text,
  descripcion_larga  text,
  imagenes      text[] not null default '{}',         -- URLs del storage
  destacado     boolean not null default false,
  stock         integer not null default 0,
  orden         integer,
  combina_con   text[] not null default '{}',         -- slugs
  resenas       jsonb  not null default '[]'::jsonb,   -- [{autor,texto,estrellas,fecha,verificada}]
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists productos_activo_orden_idx on productos (activo, orden);

-- ---- Configuración editable del Home (una sola fila) ----
create table if not exists home_config (
  id         integer primary key default 1,
  data       jsonb not null default '{}'::jsonb,       -- hero, bento, franjas, etc.
  updated_at timestamptz not null default now(),
  constraint home_config_singleton check (id = 1)
);

insert into home_config (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- ---- updated_at automático ----
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists productos_updated_at on productos;
create trigger productos_updated_at before update on productos
  for each row execute function set_updated_at();

-- ============================================================
-- RLS: lectura pública, escritura sólo con service_role (el panel
-- escribe desde un endpoint del servidor con la service key).
-- ============================================================
alter table productos   enable row level security;
alter table home_config enable row level security;

drop policy if exists productos_read on productos;
create policy productos_read on productos
  for select using (activo = true);

drop policy if exists home_read on home_config;
create policy home_read on home_config
  for select using (true);

-- (No creamos policies de insert/update/delete para anon: sólo el
--  service_role puede escribir, y bypassa RLS. El panel usa esa clave
--  en el servidor, nunca en el cliente.)

-- ============================================================
-- Storage: bucket público para imágenes de productos y del home.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('remanso', 'remanso', true)
on conflict (id) do nothing;

-- Lectura pública del bucket
drop policy if exists remanso_public_read on storage.objects;
create policy remanso_public_read on storage.objects
  for select using (bucket_id = 'remanso');

-- ---- Tabla de órdenes ----
create table if not exists ordenes (
  id uuid primary key default gen_random_uuid(),
  external_reference text unique not null,
  estado text not null default 'pendiente', -- pendiente|aprobado|rechazado|despachado
  items jsonb not null, -- [{slug, nombre, precio, qty}]
  monto_productos integer not null,
  costo_envio integer not null,
  monto_total integer not null,
  nombre_cliente text not null,
  email_cliente text not null,
  whatsapp_cliente text not null,
  direccion text not null,
  localidad text not null,
  metodo_envio text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ordenes_estado_idx on ordenes (estado);
create index if not exists ordenes_reference_idx on ordenes (external_reference);

drop trigger if exists ordenes_updated_at on ordenes;
create trigger ordenes_updated_at before update on ordenes
  for each row execute function set_updated_at();

alter table ordenes enable row level security;

-- ---- Descuento de stock atómico ----
-- Lo llama el webhook cuando un pago se aprueba. Hacerlo en una sola
-- sentencia evita que dos compras simultáneas lean el mismo stock y
-- terminen vendiendo de más (condición de carrera).
create or replace function descontar_stock(p_slug text, p_qty integer)
returns integer as $$
  update productos
     set stock = greatest(0, stock - p_qty)
   where slug = p_slug
  returning stock;
$$ language sql;

-- Las órdenes no son legibles de forma anónima pública por privacidad.
-- Solo service_role (usado por el panel) puede acceder para lectura y escritura.

-- ============================================================
-- Migración: beneficios (bullets de venta) y precio anterior
-- (para mostrar precio tachado cuando hay una promoción puntual).
-- `add column if not exists` es idempotente: se puede correr de nuevo
-- sin romper nada si ya se aplicó.
-- ============================================================
alter table productos add column if not exists beneficios text[] not null default '{}';
alter table productos add column if not exists precio_anterior integer;

-- ============================================================
-- Migración: suscriptores del newsletter (footer de la Home).
-- El form ya validaba y mostraba "¡Gracias!" pero no guardaba nada en
-- ningún lado — este es el primer paso real: quedan acá, listos para
-- exportar o conectar a un proveedor de email más adelante.
-- ============================================================
create table if not exists newsletter_subscribers (
  id bigint generated always as identity primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table newsletter_subscribers enable row level security;
-- Sólo service_role (usado por el endpoint /api/newsletter) puede leer/escribir.
