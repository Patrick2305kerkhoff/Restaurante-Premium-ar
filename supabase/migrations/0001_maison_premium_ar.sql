-- Maison Premium AR — esquema multi-restaurante com isolamento por RLS.
-- Aplicar em um projeto Supabase novo (SQL Editor ou `supabase db push`).

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table if not exists public.restaurants (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  tagline text not null default '',
  logo_url text,
  cover_url text,
  about text not null default '',
  address text not null default '',
  phone text not null default '',
  hours text not null default '',
  theme jsonb not null,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_members (
  restaurant_id text not null references public.restaurants on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner',
  primary key (restaurant_id, user_id)
);

create table if not exists public.categories (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text not null references public.restaurants on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.dishes (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text not null references public.restaurants on delete cascade,
  category_id text not null references public.categories on delete restrict,
  name text not null,
  description text not null default '',
  ingredients text[] not null default '{}',
  price_cents int not null check (price_cents >= 0),
  available boolean not null default true,
  featured boolean not null default false,
  photo_url text,
  top_photo_url text,
  model_url text,
  usdz_url text,
  shape text not null default 'plate' check (shape in ('plate','bowl','bottle','glass')),
  width_cm numeric not null check (width_cm > 0),
  depth_cm numeric not null check (depth_cm > 0),
  height_cm numeric not null check (height_cm > 0),
  sort_order int not null default 0
);

create table if not exists public.dining_tables (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text not null references public.restaurants on delete cascade,
  label text not null,
  token text not null,
  seats int not null default 4,
  unique (restaurant_id, token)
);

create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text not null references public.restaurants on delete cascade,
  table_id text references public.dining_tables on delete set null,
  table_label text not null,
  items jsonb not null,
  total_cents int not null,
  status text not null default 'novo' check (status in ('novo','preparo','pronto','entregue','cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists public.service_calls (
  id text primary key default gen_random_uuid()::text,
  restaurant_id text not null references public.restaurants on delete cascade,
  table_id text references public.dining_tables on delete set null,
  table_label text not null,
  kind text not null check (kind in ('garcom','conta')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists categories_restaurant on public.categories (restaurant_id);
create index if not exists dishes_restaurant on public.dishes (restaurant_id);
create index if not exists tables_restaurant on public.dining_tables (restaurant_id);
create index if not exists orders_restaurant on public.orders (restaurant_id, created_at desc);
create index if not exists calls_restaurant on public.service_calls (restaurant_id, created_at desc);

-- ------------------------------------------------------------ permissões
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from platform_admins where user_id = auth.uid()) $$;

create or replace function public.can_manage(rid text) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_platform_admin() or exists (select 1 from restaurant_members where restaurant_id = rid and user_id = auth.uid()) $$;

alter table public.platform_admins enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.categories enable row level security;
alter table public.dishes enable row level security;
alter table public.dining_tables enable row level security;
alter table public.orders enable row level security;
alter table public.service_calls enable row level security;

-- Cardápio é público para leitura; escrita só para quem administra o restaurante.
create policy restaurants_read on public.restaurants for select using (true);
create policy restaurants_insert on public.restaurants for insert with check (public.is_platform_admin());
create policy restaurants_update on public.restaurants for update using (public.can_manage(id)) with check (public.can_manage(id));
create policy restaurants_delete on public.restaurants for delete using (public.is_platform_admin());

create policy members_read on public.restaurant_members for select using (user_id = auth.uid() or public.is_platform_admin());
create policy members_write on public.restaurant_members for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy categories_read on public.categories for select using (true);
create policy categories_write on public.categories for all using (public.can_manage(restaurant_id)) with check (public.can_manage(restaurant_id));

create policy dishes_read on public.dishes for select using (true);
create policy dishes_write on public.dishes for all using (public.can_manage(restaurant_id)) with check (public.can_manage(restaurant_id));

-- Mesas, pedidos e chamados nunca são legíveis pelo público: o cliente usa as funções abaixo.
create policy tables_manage on public.dining_tables for all using (public.can_manage(restaurant_id)) with check (public.can_manage(restaurant_id));
create policy orders_manage on public.orders for all using (public.can_manage(restaurant_id)) with check (public.can_manage(restaurant_id));
create policy calls_manage on public.service_calls for all using (public.can_manage(restaurant_id)) with check (public.can_manage(restaurant_id));

-- ------------------------------------------------- funções do cliente (QR)
create or replace function public.table_by_token(p_slug text, p_token text)
returns setof public.dining_tables language sql stable security definer set search_path = public as
$$ select t.* from dining_tables t join restaurants r on r.id = t.restaurant_id where r.slug = p_slug and t.token = p_token $$;

-- O preço é sempre recalculado no servidor a partir do cadastro.
create or replace function public.place_order(p_slug text, p_token text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  t dining_tables; o orders; lines jsonb := '[]'::jsonb; total int := 0; it jsonb; d dishes; q int;
begin
  select * into t from table_by_token(p_slug, p_token);
  if t.id is null then raise exception 'Mesa não identificada. Leia o QR Code da mesa.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 60 then raise exception 'Pedido vazio.'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into d from dishes where id = it->>'dish_id' and restaurant_id = t.restaurant_id and available;
    if d.id is null then raise exception 'Um dos itens não está mais disponível.'; end if;
    q := greatest(1, least(50, coalesce((it->>'qty')::int, 1)));
    lines := lines || jsonb_build_object('dishId', d.id, 'name', d.name, 'qty', q, 'priceCents', d.price_cents, 'note', left(it->>'note', 200));
    total := total + q * d.price_cents;
  end loop;
  insert into orders (restaurant_id, table_id, table_label, items, total_cents) values (t.restaurant_id, t.id, t.label, lines, total) returning * into o;
  return o;
end $$;

create or replace function public.call_service(p_slug text, p_token text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare t dining_tables;
begin
  select * into t from table_by_token(p_slug, p_token);
  if t.id is null then raise exception 'Mesa não identificada. Leia o QR Code da mesa.'; end if;
  -- evita chamados duplicados em aberto para a mesma mesa
  if not exists (select 1 from service_calls where table_id = t.id and kind = p_kind and not resolved) then
    insert into service_calls (restaurant_id, table_id, table_label, kind) values (t.restaurant_id, t.id, t.label, p_kind);
  end if;
end $$;

create or replace function public.order_statuses(p_ids text[])
returns table (id text, status text) language sql stable security definer set search_path = public as
$$ select o.id, o.status from orders o where o.id = any (p_ids[1:50]) $$;

revoke all on function public.place_order, public.call_service, public.table_by_token, public.order_statuses from public;
grant execute on function public.place_order, public.call_service, public.table_by_token, public.order_statuses, public.is_platform_admin, public.can_manage to anon, authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('assets', 'assets', true) on conflict (id) do nothing;
-- Cada restaurante só grava dentro da própria pasta: assets/<restaurant_id>/arquivo
create policy assets_write on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and public.can_manage((storage.foldername(name))[1]));
create policy assets_update on storage.objects for update to authenticated
  using (bucket_id = 'assets' and public.can_manage((storage.foldername(name))[1]));
create policy assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and public.can_manage((storage.foldername(name))[1]));
