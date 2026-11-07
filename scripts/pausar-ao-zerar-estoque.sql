-- ====================================================================
-- CENTRAL DAS IAS - PAUSAR ANUNCIO AUTOMATICAMENTE AO ZERAR ESTOQUE
-- Execute no SQL Editor do Supabase.
-- ====================================================================

-- 1) Atualiza recalc_product_stock para pausar ao zerar e reativar ao abastecer
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

-- 2) Atualiza create_order_chat para pausar anuncio padrao unico se zerar estoque
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

  if v_prod_id is not null and upper(coalesce(p_delivery_type, '')) = 'AUTOMATIC' then
    v_vault := exists (select 1 from public.product_stock_items where product_id = v_prod_id);
  end if;

  if v_vault then
    if v_variant is not null
       and not exists (
         select 1 from public.product_stock_items
         where product_id = v_prod_id and variant_id = v_variant
       ) then
      v_variant := null;
    end if;

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
