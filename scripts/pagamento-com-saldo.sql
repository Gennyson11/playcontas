-- ====================================================================
-- CENTRAL DAS IAS - PAGAMENTO COM SALDO DA CARTEIRA
-- Rode DEPOIS de: admin-saldo-usuarios.sql, setup-chat.sql e update-chat-numbers.sql
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem problema.
--
-- O que faz: ao pagar com SALDO, o valor e descontado da carteira e os pedidos
-- (chats) sao criados na MESMA transacao. Se qualquer parte falhar, nada e cobrado.
-- ====================================================================

-- 1) A trava de seguranca passa a aceitar alteracao de saldo feita SOMENTE por
--    funcoes internas autorizadas (que ligam o aviso "app.balance_guard_bypass").
--    Usuarios comuns continuam sem conseguir mexer no proprio saldo.
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and coalesce(current_setting('app.balance_guard_bypass', true), '') <> 'on' then
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

-- 2) Compra com saldo: debita + cria os pedidos de forma atomica
create or replace function public.checkout_with_balance(
  p_items jsonb,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance numeric;
  v_new numeric;
  v_item jsonb;
  v_num bigint;
  v_numbers jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para finalizar a compra.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor da compra invalido.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Seu carrinho esta vazio.';
  end if;

  -- Trava a linha do perfil para evitar duas compras ao mesmo tempo gastando o mesmo saldo
  select coalesce(balance, 0) into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  if v_balance < p_amount then
    raise exception 'Saldo insuficiente (saldo atual: R$ %).', to_char(v_balance, 'FM999999990.00');
  end if;

  v_new := round(v_balance - p_amount, 2);

  perform set_config('app.balance_guard_bypass', 'on', true);
  update public.profiles
  set balance = v_new, updated_at = timezone('utc'::text, now())
  where id = v_uid;
  perform set_config('app.balance_guard_bypass', 'off', true);

  -- Cria um pedido (chat) para cada item do carrinho
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_num := public.create_order_chat(
      v_item->>'product_id',
      v_item->>'title',
      coalesce(v_item->>'image', ''),
      coalesce((v_item->>'price')::numeric, 0),
      greatest(coalesce((v_item->>'quantity')::integer, 1), 1),
      nullif(v_item->>'seller_id', '')::uuid,
      coalesce(v_item->>'seller_name', 'Vendedor'),
      coalesce(v_item->>'delivery_type', 'MANUAL'),
      coalesce(v_item->>'delivery_content', '')
    );
    v_numbers := v_numbers || to_jsonb(v_num);
  end loop;

  -- Historico (aparece para o usuario e para o admin)
  insert into public.balance_transactions
    (user_id, admin_id, kind, amount, balance_before, balance_after, note)
  values
    (v_uid, null, 'debit', p_amount, v_balance, v_new,
     'Compra no site (pedido ' || (v_numbers->>0) || ')');

  return jsonb_build_object('balance', v_new, 'orders', v_numbers);
end;
$$;

revoke all on function public.checkout_with_balance(jsonb, numeric) from public;
revoke all on function public.checkout_with_balance(jsonb, numeric) from anon;
grant execute on function public.checkout_with_balance(jsonb, numeric) to authenticated;
