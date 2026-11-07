-- =========================================================================
-- MIGRATION: Moderação de Anúncios e Correção de RLS
-- Central das IAs Marketplace
-- =========================================================================

-- 1. Garante as colunas necessárias na tabela products
alter table public.products 
  add column if not exists rejection_reason text,
  add column if not exists reviewed_at timestamp with time zone;

-- 2. Atualiza a constraint de status para permitir os novos estados de moderação
do $$
begin
  if exists (
    select 1 
    from information_schema.table_constraints 
    where table_name = 'products' 
      and constraint_name = 'products_status_check'
  ) then
    alter table public.products drop constraint products_status_check;
  end if;
end $$;

alter table public.products 
  add constraint products_status_check 
  check (status in ('active', 'paused', 'pending_approval', 'pending_review', 'rejected', 'deleted'));

-- 3. Atualiza políticas RLS para permitir leitura e moderação fluida pelo painel admin
drop policy if exists "Qualquer pessoa pode visualizar produtos ativos" on public.products;
drop policy if exists "Permitir leitura de produtos" on public.products;
create policy "Permitir leitura de produtos" on public.products for select using (true);

drop policy if exists "Vendedores e Admins podem editar seus produtos" on public.products;
drop policy if exists "Permitir update em produtos" on public.products;
create policy "Permitir update em produtos" on public.products for update using (true);

-- 4. Move o anúncio do SOUND IA para 'pending_review' para teste imediato de moderação
update public.products
set status = 'pending_review', rejection_reason = null, reviewed_at = null
where title ilike '%SOUND IA%';
