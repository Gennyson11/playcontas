-- ====================================================================
-- CENTRAL DAS IAS - SALDO DOS USUARIOS (PAINEL ADMIN) + SEGURANCA
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Se aparecer o aviso "Potential issues", clique em "Run and enable RLS".
-- Pode rodar mais de uma vez sem problema.
-- ====================================================================

create extension if not exists "uuid-ossp";

-- 1) Funcao que diz se quem esta logado e admin (evita recursao nas politicas)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2) Garante que a conta do dono do site e admin no banco
update public.profiles
set role = 'admin'
where lower(email) = 'gennysonmarinhodemacedo@gmail.com';

-- 3) Politica de admin usando a funcao (a versao antiga consultava a propria tabela)
drop policy if exists "Administradores podem gerenciar todos os perfis" on public.profiles;
create policy "Administradores podem gerenciar todos os perfis"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- 4) Trava de seguranca: so admin consegue mudar SALDO e TIPO DE CONTA.
--    Qualquer outro usuario que tentar alterar esses campos nos proprios dados e ignorado.
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.balance := old.balance;
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_sensitive on public.profiles;
create trigger protect_profile_sensitive
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_columns();

-- 5) Novas contas sempre nascem como cliente (o tipo enviado pelo navegador e ignorado)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'buyer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 6) Historico de movimentacoes de saldo (auditoria)
create table if not exists public.balance_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  admin_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('credit', 'debit', 'set')),
  amount numeric(10, 2) not null,
  balance_before numeric(10, 2) not null,
  balance_after numeric(10, 2) not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists balance_transactions_user_idx
  on public.balance_transactions (user_id, created_at desc);

alter table public.balance_transactions enable row level security;

-- Admin ve tudo; cada usuario ve so o proprio historico. Ninguem escreve direto (so pela funcao abaixo).
drop policy if exists "Ver historico de saldo" on public.balance_transactions;
create policy "Ver historico de saldo"
  on public.balance_transactions for select
  using (user_id = auth.uid() or public.is_admin());

-- 7) Funcao que ajusta o saldo (so admin autenticado consegue executar)
create or replace function public.admin_adjust_balance(
  target_user uuid,
  adjust_mode text,
  adjust_amount numeric,
  adjust_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  old_balance numeric;
  new_balance numeric;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores podem ajustar saldo.';
  end if;

  if adjust_mode not in ('credit', 'debit', 'set') then
    raise exception 'Operacao invalida.';
  end if;

  if adjust_amount is null or adjust_amount < 0 then
    raise exception 'Valor invalido.';
  end if;

  if adjust_mode <> 'set' and adjust_amount = 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  select balance into old_balance
  from public.profiles
  where id = target_user
  for update;

  if not found then
    raise exception 'Usuario nao encontrado.';
  end if;

  old_balance := coalesce(old_balance, 0);

  if adjust_mode = 'credit' then
    new_balance := old_balance + adjust_amount;
  elsif adjust_mode = 'debit' then
    new_balance := old_balance - adjust_amount;
  else
    new_balance := adjust_amount;
  end if;

  if new_balance < 0 then
    raise exception 'O saldo nao pode ficar negativo (saldo atual: R$ %).', old_balance;
  end if;

  update public.profiles
  set balance = new_balance, updated_at = timezone('utc'::text, now())
  where id = target_user;

  insert into public.balance_transactions
    (user_id, admin_id, kind, amount, balance_before, balance_after, note)
  values
    (target_user, auth.uid(), adjust_mode, adjust_amount, old_balance, new_balance, nullif(trim(adjust_note), ''));

  return new_balance;
end;
$$;

revoke all on function public.admin_adjust_balance(uuid, text, numeric, text) from public;
revoke all on function public.admin_adjust_balance(uuid, text, numeric, text) from anon;
grant execute on function public.admin_adjust_balance(uuid, text, numeric, text) to authenticated;
