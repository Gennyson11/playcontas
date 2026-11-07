-- ====================================================================
-- CENTRAL DAS IAS - BAIXA DE ESTOQUE E CONTAGEM DE VENDAS NA COMPRA
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Rode DEPOIS do update-chat-numbers.sql. Pode rodar mais de uma vez.
--
-- Efeito: toda compra (pelo saldo ou por qualquer outro pagamento) passa a
--   - diminuir o estoque do anuncio
--   - somar 1 (ou a quantidade) em "vendidos"
-- Tudo na mesma transacao: se faltar estoque, a compra inteira e cancelada.
-- ====================================================================

create or replace function public.create_order_chat(
  p_product_id text,
  p_title text,
  p_image text,
  p_price numeric,
  p_quantity integer,
  p_seller_id uuid,
  p_seller_name text,
  p_delivery_type text,
  p_delivery_content text
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
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para finalizar a compra.';
  end if;

  v_qty := greatest(coalesce(p_quantity, 1), 1);
  v_auto := upper(coalesce(p_delivery_type, '')) = 'AUTOMATIC'
            and coalesce(trim(p_delivery_content), '') <> '';

  -- Baixa o estoque e conta a venda (so para anuncios que existem no banco).
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

  if v_prod_id is not null then
    select coalesce(stock, 0) into v_stock
    from public.products
    where id = v_prod_id
    for update;

    if v_stock < v_qty then
      raise exception 'Estoque insuficiente: restam % unidade(s) deste anuncio.', v_stock;
    end if;

    update public.products
    set stock = v_stock - v_qty,
        sales_count = coalesce(sales_count, 0) + v_qty,
        updated_at = timezone('utc'::text, now())
    where id = v_prod_id;
  end if;

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
    values (v_chat_id, p_seller_id, 'seller', p_seller_name, 'delivery', p_delivery_content);
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

revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text) from public;
revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text) from anon;
grant execute on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text) to authenticated;
