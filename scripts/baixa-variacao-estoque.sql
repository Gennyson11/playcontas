-- ====================================================================
-- CENTRAL DAS IAS - BAIXA DE ESTOQUE POR VARIAÇÃO NO BANCO SUPABASE
-- Cole TUDO no SQL Editor do Supabase e clique em RUN.
-- Mantém 100% as mensagens oficiais do sistema no chat (Avisos da Central Market + Confirmação de Pagamento)
-- ====================================================================

-- 1) Remove versões antigas de create_order_chat para evitar conflito de sobrecarga
drop function if exists public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text);
drop function if exists public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text, text);

-- 2) Cria create_order_chat com suporte a variantes e mensagens oficiais do sistema
create or replace function public.create_order_chat(
  p_product_id text,
  p_title text,
  p_image text,
  p_price numeric,
  p_quantity integer,
  p_seller_id uuid,
  p_seller_name text,
  p_delivery_type text,
  p_delivery_content text,
  p_variant_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_num bigint;
  v_code text;
  v_buyer_name text;
  v_auto boolean;
  v_qty integer;
  v_prod_id uuid;
  v_stock integer;
  v_variant text := nullif(trim(coalesce(p_variant_id, '')), '');
  v_content text := coalesce(p_delivery_content, '');
  v_vault_exists boolean := false;
  v_has_vault_items boolean := false;
  v_ids uuid[];
  v_contents text[];
  v_blocks text := '';
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para finalizar a compra.';
  end if;

  v_qty := greatest(coalesce(p_quantity, 1), 1);

  -- Localiza o produto no banco
  if coalesce(p_product_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v_prod_id from public.products where id = p_product_id::uuid;
  end if;

  if v_prod_id is null and p_seller_id is not null and coalesce(trim(p_title), '') <> '' then
    select id into v_prod_id
    from public.products
    where seller_id = p_seller_id
      and lower(trim(title)) = lower(trim(p_title))
      and coalesce(status, 'active') <> 'deleted'
    order by created_at desc
    limit 1;
  end if;

  -- Se existir cofre configurado com itens disponíveis, consome dele
  select exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'product_stock_items'
  ) into v_vault_exists;

  if v_vault_exists and v_prod_id is not null and upper(coalesce(p_delivery_type, '')) = 'AUTOMATIC' then
    execute 'select exists (select 1 from public.product_stock_items where product_id = $1 and status = ''available'')'
    into v_has_vault_items
    using v_prod_id;
  end if;

  if v_has_vault_items then
    perform 1 from public.products where id = v_prod_id for update;

    execute '
      select array_agg(s.id order by s.created_at, s.id), array_agg(s.content order by s.created_at, s.id)
      from (
        select id, content, created_at
        from public.product_stock_items
        where product_id = $1
          and status = ''available''
          and ($2 is null or variant_id = $2 or variant_id is null)
        order by created_at, id
        limit $3
        for update skip locked
      ) s
    ' into v_ids, v_contents using v_prod_id, v_variant, v_qty;

    if coalesce(cardinality(v_ids), 0) >= v_qty then
      execute '
        update public.product_stock_items
        set status = ''sold'', sold_at = timezone(''utc''::text, now())
        where id = any($1)
      ' using v_ids;

      for i in 1..cardinality(v_contents) loop
        v_blocks := v_blocks
          || case when i > 1 then E'\n\n' else '' end
          || chr(128272) || ' Acesso ' || i || ':' || E'\n' || v_contents[i];
      end loop;

      v_content := chr(9989) || ' Pagamento confirmado! Entrega automática realizada.' || E'\n\n'
        || v_blocks
        || E'\n\n' || chr(9888) || chr(65039) || ' Guarde estas informações em local seguro.'
        || E'\nSe precisar de ajuda, fale com o vendedor aqui no chat.';
    end if;
  end if;

  -- Baixa o estoque no anúncio principal e nas variantes jsonb
  if v_prod_id is not null then
    select coalesce(stock, 0) into v_stock
    from public.products
    where id = v_prod_id
    for update;

    update public.products
    set stock = greatest(0, v_stock - v_qty),
        status = case when greatest(0, v_stock - v_qty) <= 0 then 'paused' else coalesce(status, 'active') end,
        sales_count = coalesce(sales_count, 0) + v_qty,
        variants = case
          when variants is null or jsonb_typeof(variants) <> 'array' or v_variant is null then variants
          else (
            select coalesce(jsonb_agg(
              case
                when (v->>'id' = v_variant or lower(trim(coalesce(v->>'name', ''))) = lower(trim(v_variant)))
                then jsonb_set(v, '{stock}', to_jsonb(greatest(coalesce((v->>'stock')::integer, 0) - v_qty, 0)))
                else v
              end
            ), '[]'::jsonb)
            from jsonb_array_elements(variants) v
          )
        end,
        updated_at = timezone('utc'::text, now())
    where id = v_prod_id;
  end if;

  v_auto := upper(coalesce(p_delivery_type, '')) = 'AUTOMATIC'
            and coalesce(trim(v_content), '') <> '';

  v_num := nextval('public.order_chat_number_seq');
  v_code := lpad(v_num::text, 5, '0');

  select coalesce(full_name, split_part(email, '@', 1)) into v_buyer_name
  from public.profiles where id = auth.uid();

  insert into public.order_chats
    (number, code, product_id, product_title, product_image, price, quantity,
     buyer_id, buyer_name, seller_id, seller_name, delivery_type, status)
  values
    (v_num, v_code, p_product_id, p_title, p_image, coalesce(p_price, 0), v_qty,
     auth.uid(), v_buyer_name, p_seller_id, p_seller_name,
     case when v_auto then 'AUTOMATIC' else 'MANUAL' end,
     case when v_auto then 'delivered' else 'pending' end)
  returning id into v_chat_id;

  if v_has_vault_items and v_ids is not null then
    begin
      execute 'update public.product_stock_items set sold_chat_id = $1 where id = any($2)'
      using v_chat_id, v_ids;
    exception when others then
      null;
    end;
  end if;

  -- 1ª MENSAGEM: Orientações Oficiais da Central Market (renderiza o card completo com Pedido #, Sobre a Central, Garantia e Contato Proibido)
  insert into public.chat_messages (chat_id, sender_role, sender_name, kind, body)
  values (
    v_chat_id,
    'system',
    'Central Market',
    'system',
    'CHAT INICIADO - CENTRAL MARKET' || E'\n\n' ||
    'Pedido #' || v_code || E'\n' ||
    'Use este chat para falar com o vendedor sobre esta compra.' || E'\n' ||
    'Mantenha sempre um dialogo respeitoso e profissional.'
  );

  -- 2ª MENSAGEM: Confirmação de Entrega (se automática entrega os acessos, se manual avisa que vendedor foi notificado)
  if v_auto then
    insert into public.chat_messages (chat_id, sender_id, sender_role, sender_name, kind, body)
    values (v_chat_id, p_seller_id, 'seller', p_seller_name, 'delivery', v_content);
  else
    insert into public.chat_messages (chat_id, sender_role, sender_name, kind, body)
    values (
      v_chat_id,
      'system',
      'Central Market',
      'system',
      'Pagamento confirmado!' || E'\n' ||
      'Este produto tem entrega MANUAL. Aguarde: o vendedor foi avisado e vai enviar a entrega aqui no chat.'
    );
  end if;

  return v_num;
end;
$$;

revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text, text) to authenticated;

-- 3) checkout_with_balance com retorno completo ('balance', 'orders', 'numbers', 'success')
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
  v_seller_uuid uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para finalizar a compra.';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Valor total inválido.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  perform set_config('app.balance_guard_bypass', 'on', true);

  select coalesce(balance, 0) into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    perform set_config('app.balance_guard_bypass', 'off', true);
    raise exception 'Perfil não encontrado.';
  end if;

  if v_balance < p_amount then
    perform set_config('app.balance_guard_bypass', 'off', true);
    raise exception 'Saldo insuficiente (seu saldo: R$ %, total da compra: R$ %).',
      to_char(v_balance, 'FM999G999D00'),
      to_char(p_amount, 'FM999G999D00');
  end if;

  v_new := round(v_balance - p_amount, 2);

  update public.profiles
  set balance = v_new,
      updated_at = timezone('utc'::text, now())
  where id = v_uid;
  perform set_config('app.balance_guard_bypass', 'off', true);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_seller_uuid := null;
    if coalesce(v_item->>'seller_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_seller_uuid := (v_item->>'seller_id')::uuid;
    end if;

    v_num := public.create_order_chat(
      v_item->>'product_id',
      v_item->>'title',
      coalesce(v_item->>'image', ''),
      coalesce((v_item->>'price')::numeric, 0),
      greatest(coalesce((v_item->>'quantity')::integer, 1), 1),
      v_seller_uuid,
      coalesce(v_item->>'seller_name', 'Vendedor'),
      coalesce(v_item->>'delivery_type', 'MANUAL'),
      coalesce(v_item->>'delivery_content', ''),
      nullif(v_item->>'variant_id', '')
    );
    v_numbers := v_numbers || to_jsonb(v_num);
  end loop;

  insert into public.balance_transactions
    (user_id, admin_id, kind, amount, balance_before, balance_after, note)
  values
    (v_uid, null, 'debit', p_amount, v_balance, v_new,
     'Compra no site (pedido ' || coalesce(v_numbers->>0, '') || ')');

  return jsonb_build_object(
    'success', true,
    'balance', v_new,
    'orders', v_numbers,
    'numbers', v_numbers
  );
end;
$$;

revoke all on function public.checkout_with_balance(jsonb, numeric) from public, anon;
grant execute on function public.checkout_with_balance(jsonb, numeric) to authenticated;

-- 4) Permite que vendedores e administradores atualizem produtos no banco
alter table public.products enable row level security;

drop policy if exists "Vendedores e admins atualizam produtos" on public.products;
create policy "Vendedores e admins atualizam produtos"
  on public.products for update
  using (
    auth.uid() = seller_id
    or public.is_admin()
  );
