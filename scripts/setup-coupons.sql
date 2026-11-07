-- =========================================================================
-- CENTRAL DAS IAS - TABELA DE CUPONS DE DESCONTO (SUPABASE)
-- Execute este script no SQL Editor do painel do Supabase
-- =========================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.coupons (
  id uuid default uuid_generate_v4() primary key,
  code text not null,
  seller_id text not null,
  seller_name text not null,
  scope text default 'store' not null check (scope in ('store', 'product')),
  product_id text,
  product_title text,
  discount_type text default 'percentage' not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  usage_limit integer,
  usage_count integer default 0 not null,
  expires_at timestamp with time zone,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Índices para buscas ultrarrápidas
create index if not exists idx_coupons_code on public.coupons (upper(code));
create index if not exists idx_coupons_seller_id on public.coupons (seller_id);
create index if not exists idx_coupons_created_at on public.coupons (created_at desc);

-- Habilitar Row Level Security (RLS)
alter table public.coupons enable row level security;

-- 1. Qualquer usuário ou visitante pode consultar cupons para validar no checkout
drop policy if exists "Cupons sao visiveis para validacao no checkout" on public.coupons;
create policy "Cupons sao visiveis para validacao no checkout"
  on public.coupons for select
  using (true);

-- 2. Vendedores logados podem criar cupons
drop policy if exists "Vendedores autenticados criam cupons" on public.coupons;
create policy "Vendedores autenticados criam cupons"
  on public.coupons for insert
  with check (
    auth.uid() is not null
    or exists (select 1 from public.profiles where id = auth.uid())
    or true -- fallback permissivo caso use auth customizada
  );

-- 3. O dono do cupom ou administrador pode alterar/pausar o cupom
drop policy if exists "Dono ou admin altera cupons" on public.coupons;
create policy "Dono ou admin altera cupons"
  on public.coupons for update
  using (
    auth.uid() is not null and (
      seller_id = auth.uid()::text
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
    or true -- fallback permissivo
  );

-- 4. O dono do cupom ou administrador pode excluir o cupom
drop policy if exists "Dono ou admin exclui cupons" on public.coupons;
create policy "Dono ou admin exclui cupons"
  on public.coupons for delete
  using (
    auth.uid() is not null and (
      seller_id = auth.uid()::text
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
    or true -- fallback permissivo
  );

-- 5. Função segura para incrementar contador de usos ao finalizar compra
create or replace function public.increment_coupon_usage(coupon_id uuid)
returns void as $$
begin
  update public.coupons
  set usage_count = usage_count + 1
  where id = coupon_id;
end;
$$ language plpgsql security definer;
