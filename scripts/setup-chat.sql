-- ====================================================================
-- CENTRAL DAS IAS - CHAT DO PEDIDO (COMPRADOR x VENDEDOR) + ENTREGA
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Se aparecer o aviso "Potential issues", clique em "Run and enable RLS".
-- Pode rodar mais de uma vez sem problema.
-- Requer que o script admin-saldo-usuarios.sql ja tenha sido executado (usa public.is_admin()).
-- ====================================================================

create extension if not exists "uuid-ossp";

-- 1) Conversa de cada compra --------------------------------------------
create table if not exists public.order_chats (
  id uuid default uuid_generate_v4() primary key,
  code text not null,
  product_id text,
  product_title text not null,
  product_image text,
  price numeric(10, 2) not null default 0,
  quantity integer not null default 1,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text,
  seller_id uuid references public.profiles(id) on delete set null,
  seller_name text,
  delivery_type text not null default 'AUTOMATIC' check (delivery_type in ('AUTOMATIC', 'MANUAL')),
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  last_message text,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists order_chats_buyer_idx on public.order_chats (buyer_id, last_message_at desc);
create index if not exists order_chats_seller_idx on public.order_chats (seller_id, last_message_at desc);

alter table public.order_chats enable row level security;

drop policy if exists "Participantes veem a conversa" on public.order_chats;
create policy "Participantes veem a conversa"
  on public.order_chats for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

-- 2) Mensagens ------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  chat_id uuid references public.order_chats(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text,
  sender_role text not null default 'buyer' check (sender_role in ('buyer', 'seller', 'system')),
  kind text not null default 'text' check (kind in ('text', 'system', 'delivery')),
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Participantes leem mensagens" on public.chat_messages;
create policy "Participantes leem mensagens"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.order_chats c
      where c.id = chat_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin())
    )
  );

-- Pelo site, so e possivel escrever mensagens de texto nas proprias conversas
drop policy if exists "Participantes enviam mensagens" on public.chat_messages;
create policy "Participantes enviam mensagens"
  on public.chat_messages for insert
  with check (
    kind = 'text'
    and sender_id = auth.uid()
    and exists (
      select 1 from public.order_chats c
      where c.id = chat_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Define o papel (comprador/vendedor) no servidor e atualiza a ultima mensagem da conversa
create or replace function public.chat_message_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.order_chats;
begin
  select * into c from public.order_chats where id = new.chat_id;

  if new.kind = 'text' then
    new.sender_role := case when c.seller_id = auth.uid() then 'seller' else 'buyer' end;
    if new.sender_name is null or new.sender_name = '' then
      select coalesce(full_name, split_part(email, '@', 1)) into new.sender_name
      from public.profiles where id = auth.uid();
    end if;
  end if;

  update public.order_chats
  set last_message = left(new.body, 140),
      last_message_at = timezone('utc'::text, now())
  where id = new.chat_id;

  return new;
end;
$$;

drop trigger if exists chat_message_defaults_trg on public.chat_messages;
create trigger chat_message_defaults_trg
  before insert on public.chat_messages
  for each row execute function public.chat_message_defaults();

-- 3) Cria a conversa de uma compra (e ja envia a entrega automatica) -----
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
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
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  select coalesce(full_name, split_part(email, '@', 1)) into v_buyer_name
  from public.profiles where id = auth.uid();

  insert into public.order_chats
    (code, product_id, product_title, product_image, price, quantity,
     buyer_id, buyer_name, seller_id, seller_name, delivery_type, status)
  values
    (v_code, p_product_id, p_title, p_image, coalesce(p_price, 0), v_qty,
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

  return v_chat_id;
end;
$$;

revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text) from public;
revoke all on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text) from anon;
grant execute on function public.create_order_chat(text, text, text, numeric, integer, uuid, text, text, text) to authenticated;

-- 4) Vendedor envia a entrega manual (marca o pedido como entregue) ------
create or replace function public.seller_deliver(p_chat_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.order_chats;
begin
  select * into c from public.order_chats where id = p_chat_id;
  if not found then
    raise exception 'Conversa nao encontrada.';
  end if;

  if auth.uid() is null or not (c.seller_id = auth.uid() or public.is_admin()) then
    raise exception 'Apenas o vendedor pode enviar a entrega.';
  end if;

  if coalesce(trim(p_body), '') = '' then
    raise exception 'Escreva a entrega antes de enviar.';
  end if;

  insert into public.chat_messages (chat_id, sender_id, sender_role, sender_name, kind, body)
  values (p_chat_id, auth.uid(), 'seller', c.seller_name, 'delivery', p_body);

  update public.order_chats set status = 'delivered' where id = p_chat_id;
end;
$$;

revoke all on function public.seller_deliver(uuid, text) from public;
revoke all on function public.seller_deliver(uuid, text) from anon;
grant execute on function public.seller_deliver(uuid, text) to authenticated;
