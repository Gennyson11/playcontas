-- ====================================================================
-- CENTRAL DAS IAS - NUMERO DO PEDIDO NO CHAT (endereco /chat/01233)
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Rode DEPOIS do setup-chat.sql. Pode rodar mais de uma vez.
-- ====================================================================

create sequence if not exists public.order_chat_number_seq start 1;

alter table public.order_chats
  add column if not exists number bigint default nextval('public.order_chat_number_seq');

update public.order_chats
set number = nextval('public.order_chat_number_seq')
where number is null;

alter table public.order_chats
  alter column number set default nextval('public.order_chat_number_seq');

alter table public.order_chats
  alter column number set not null;

create unique index if not exists order_chats_number_key on public.order_chats (number);

update public.order_chats
set code = lpad(number::text, 5, '0');

drop function if exists public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text);

create function public.create_order_chat(
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
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para finalizar a compra.';
  end if;

  v_qty := greatest(coalesce(p_quantity, 1), 1);
  v_auto := upper(coalesce(p_delivery_type, '')) = 'AUTOMATIC'
            and coalesce(trim(p_delivery_content), '') <> '';
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
