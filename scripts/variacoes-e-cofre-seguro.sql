-- ====================================================================
-- CENTRAL DAS IAS - VARIACOES NO BANCO + COFRE SEGURO DE CREDENCIAIS
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Rode DEPOIS dos scripts anteriores (setup-chat, update-chat-numbers,
-- baixa-estoque-compra, pagamento-com-saldo). Pode rodar mais de uma vez.
--
-- O que muda:
--  1) Anuncios com variacoes passam a existir no banco (aparecem em todas as contas).
--  2) As contas/senhas (credenciais) NAO ficam mais na tabela publica de anuncios.
--     Ficam numa tabela protegida (product_stock_items) que SO o dono do anuncio
--     e os administradores conseguem ler. Compradores nunca leem as credenciais.
--  3) Na compra, o PROPRIO BANCO sorteia as credenciais do estoque, marca como
--     vendidas e entrega no chat. Cada conta e entregue uma unica vez.
-- ====================================================================

-- 1) Colunas das variacoes (sem credenciais) -----------------------------
alter table public.products add column if not exists listing_type text;
alter table public.products add column if not exists has_variations boolean default false;
alter table public.products add column if not exists variants jsonb;

-- 2) Cofre de credenciais ------------------------------------------------
create table if not exists public.product_stock_items (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id text,
  content text not null,
  status text not null default 'available' check (status in ('available', 'sold')),
  sold_chat_id uuid,
  sold_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists product_stock_items_lookup_idx
  on public.product_stock_items (product_id, variant_id, status, created_at);

alter table public.product_stock_items enable row level security;

-- Somente o dono do anuncio e administradores leem. NAO existe politica de
-- insert/update/delete: toda escrita passa pelas funcoes abaixo.
drop policy if exists "Dono e admin leem o estoque" on public.product_stock_items;
create policy "Dono e admin leem o estoque"
  on public.product_stock_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_stock_items.product_id and p.seller_id = auth.uid()
    )
  );

-- 3) Recalcula o estoque exibido (total e por variacao) ------------------
create or replace function public.recalc_product_stock(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_total integer;
begin
  select lower(coalesce(delivery_type, 'automatic')) into v_type
  from public.products where id = p_product_id;
  if not found or v_type <> 'automatic' then
    return;
  end if;

  if not exists (select 1 from public.product_stock_items where product_id = p_product_id) then
    return;
  end if;

  select count(*) into v_total
  from public.product_stock_items
  where product_id = p_product_id and status = 'available';

  update public.products p
  set stock = v_total,
      status = case when v_total <= 0 then 'paused' else 'active' end,
      variants = case
        when p.variants is null or jsonb_typeof(p.variants) <> 'array' then p.variants
        else (
          select coalesce(jsonb_agg(
            jsonb_set(
              v, '{stock}',
              to_jsonb((
                select count(*)::integer
                from public.product_stock_items i
                where i.product_id = p.id
                  and i.variant_id = v->>'id'
                  and i.status = 'available'
              ))
            )
          ), '[]'::jsonb)
          from jsonb_array_elements(p.variants) v
        )
      end,
      updated_at = timezone('utc'::text, now())
  where p.id = p_product_id;
end;
$$;

revoke all on function public.recalc_product_stock(uuid) from public;
revoke all on function public.recalc_product_stock(uuid) from anon;
revoke all on function public.recalc_product_stock(uuid) from authenticated;

-- 4) O dono define o estoque (substitui o que esta DISPONIVEL naquele grupo) ----
--    p_variant_id vazio/nulo = anuncio unico. Contas ja vendidas nunca sao apagadas.
create or replace function public.set_product_stock(
  p_product_id uuid,
  p_variant_id text,
  p_items text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_clean text[];
  v_variant text := nullif(trim(coalesce(p_variant_id, '')), '');
begin
  select seller_id into v_owner from public.products where id = p_product_id;
  if not found then
    raise exception 'Anuncio nao encontrado.';
  end if;

  if auth.uid() is null or (v_owner is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'Somente o dono do anuncio pode alterar o estoque.';
  end if;

  v_clean := array(
    select trim(x) from unnest(coalesce(p_items, '{}'::text[])) as x
    where length(trim(x)) > 0
  );

  if coalesce(cardinality(v_clean), 0) > 5000 then
    raise exception 'Limite de 5000 contas por variacao.';
  end if;

  delete from public.product_stock_items
  where product_id = p_product_id
    and status = 'available'
    and variant_id is not distinct from v_variant;

  insert into public.product_stock_items (product_id, variant_id, content)
  select p_product_id, v_variant, x from unnest(v_clean) as x;

  perform public.recalc_product_stock(p_product_id);
  return coalesce(cardinality(v_clean), 0);
end;
$$;

revoke all on function public.set_product_stock(uuid, text, text[]) from public;
revoke all on function public.set_product_stock(uuid, text, text[]) from anon;
grant execute on function public.set_product_stock(uuid, text, text[]) to authenticated;

-- 5) Compra: o banco entrega as credenciais (ignora o que o navegador mandar) ----
--    A funcao antiga (9 parametros) e removida para nao haver duas versoes.
drop function if exists public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text);

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
  v_vault boolean := false;
  v_variant text := nullif(trim(coalesce(p_variant_id, '')), '');
  v_ids uuid[];
  v_contents text[];
  v_content text := p_delivery_content;
  v_blocks text := '';
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para finalizar a compra.';
  end if;

  v_qty := greatest(coalesce(p_quantity, 1), 1);

  -- 1) procura pelo id; 2) se o id do navegador for diferente, procura pelo mesmo vendedor + mesmo titulo
  if p_product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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

  -- Usa o cofre quando o anuncio e automatico e tem credenciais cadastradas
  if v_prod_id is not null and upper(coalesce(p_delivery_type, '')) = 'AUTOMATIC' then
    v_vault := exists (select 1 from public.product_stock_items where product_id = v_prod_id);
  end if;

  if v_vault then
    -- A variacao escolhida so vale se ela tiver estoque cadastrado; senao usa o grupo do anuncio unico
    if v_variant is not null
       and not exists (
         select 1 from public.product_stock_items
         where product_id = v_prod_id and variant_id = v_variant
       ) then
      v_variant := null;
    end if;

    -- Trava o anuncio para duas compras simultaneas nao pegarem a mesma conta
    perform 1 from public.products where id = v_prod_id for update;

    select array_agg(s.id order by s.created_at, s.id), array_agg(s.content order by s.created_at, s.id)
      into v_ids, v_contents
    from (
      select id, content, created_at
      from public.product_stock_items
      where product_id = v_prod_id
        and status = 'available'
        and variant_id is not distinct from v_variant
      order by created_at, id
      limit v_qty
      for update skip locked
    ) s;

    if coalesce(cardinality(v_ids), 0) < v_qty then
      raise exception 'Estoque insuficiente: restam % unidade(s) deste anuncio.', coalesce(cardinality(v_ids), 0);
    end if;

    update public.product_stock_items
    set status = 'sold', sold_at = timezone('utc'::text, now())
    where id = any(v_ids);

    update public.products
    set sales_count = coalesce(sales_count, 0) + v_qty
    where id = v_prod_id;

    perform public.recalc_product_stock(v_prod_id);

    -- Monta a mensagem de entrega (mesmo formato que o site sempre usou)
    if v_qty = 1 then
      v_blocks := chr(128272) || ' Seus dados de acesso:' || E'\n' || v_contents[1];
    else
      for i in 1 .. v_qty loop
        v_blocks := v_blocks
          || case when i > 1 then E'\n\n' else '' end
          || chr(128272) || ' Acesso ' || i || ':' || E'\n' || v_contents[i];
      end loop;
    end if;

    v_content := chr(9989) || ' Pagamento confirmado! Entrega automática realizada.' || E'\n\n'
      || v_blocks
      || E'\n\n' || chr(9888) || chr(65039) || ' Guarde estas informações em local seguro.'
      || E'\nSe precisar de ajuda, fale com o vendedor aqui no chat.';

  elsif v_prod_id is not null then
    -- Anuncio sem cofre (manual ou antigo): baixa o estoque numerico como sempre
    select coalesce(stock, 0) into v_stock
    from public.products
    where id = v_prod_id
    for update;

    if v_stock < v_qty then
      raise exception 'Estoque insuficiente: restam % unidade(s) deste anuncio.', v_stock;
    end if;

    update public.products
    set stock = v_stock - v_qty,
        status = case when (v_stock - v_qty) <= 0 then 'paused' else 'active' end,
        sales_count = coalesce(sales_count, 0) + v_qty,
        variants = case
          when variants is null or jsonb_typeof(variants) <> 'array' or v_variant is null then variants
          else (
            select coalesce(jsonb_agg(
              case when v->>'id' = v_variant
                then jsonb_set(v, '{stock}', to_jsonb(greatest(coalesce((v->>'stock')::integer, 0) - v_qty, 0)))
                else v end
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

  if v_vault then
    update public.product_stock_items set sold_chat_id = v_chat_id where id = any(v_ids);
  end if;

  insert into public.chat_messages (chat_id, sender_role, sender_name, kind, body)
  values (
    v_chat_id, 'system', 'Central Market', 'system',
    'CHAT INICIADO - CENTRAL MARKET' || E'\n\n' ||
    'Pedido #' || v_code || E'\n' ||
    'Use este chat para falar com o vendedor sobre esta compra.' || E'\n' ||
    'Mantenha sempre um dialogo respeitoso e profissional.'
  );

  if v_auto then
    insert into public.chat_messages (chat_id, sender_id, sender_role, sender_name, kind, body)
    values (v_chat_id, p_seller_id, 'seller', p_seller_name, 'delivery', v_content);
  else
    insert into public.chat_messages (chat_id, sender_role, sender_name, kind, body)
    values (
      v_chat_id, 'system', 'Central Market', 'system',
      'Pagamento confirmado!' || E'\n' ||
      'Este produto tem entrega MANUAL. Aguarde: o vendedor foi avisado e vai enviar a entrega aqui no chat.'
    );
  end if;

  return v_num;
end;
$$;

revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text, text) from public;
revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text, text) from anon;
grant execute on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text, text) to authenticated;

-- 6) Compra com saldo: passa a variacao escolhida para o pedido ----------
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
      coalesce(v_item->>'delivery_content', ''),
      nullif(v_item->>'variant_id', '')
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
