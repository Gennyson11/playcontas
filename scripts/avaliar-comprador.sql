-- ====================================================================
-- CENTRAL DAS IAS - VENDEDOR AVALIA O COMPRADOR
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Rode DEPOIS do setup-chat.sql. Pode rodar mais de uma vez.
--
-- A avaliação do comprador é PRIVADA: só o vendedor que avaliou e os
-- administradores conseguem ler. Não aparece no anúncio nem no perfil público.
-- ====================================================================

create table if not exists public.buyer_reviews (
  id uuid default uuid_generate_v4() primary key,
  chat_id uuid references public.order_chats(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete set null,
  seller_name text,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Uma avaliação por pedido (o vendedor pode editar depois)
create unique index if not exists buyer_reviews_chat_key on public.buyer_reviews (chat_id);
create index if not exists buyer_reviews_buyer_idx on public.buyer_reviews (buyer_id);

alter table public.buyer_reviews enable row level security;

drop policy if exists "Vendedor e admin leem avaliacao do comprador" on public.buyer_reviews;
create policy "Vendedor e admin leem avaliacao do comprador"
  on public.buyer_reviews for select
  using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "Admin apaga avaliacao do comprador" on public.buyer_reviews;
create policy "Admin apaga avaliacao do comprador"
  on public.buyer_reviews for delete
  using (public.is_admin());

-- O vendedor avalia (ou edita a avaliação) do comprador do pedido dele, depois da entrega
create or replace function public.submit_buyer_review(
  p_chat_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.order_chats;
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para avaliar.';
  end if;

  select * into c from public.order_chats where id = p_chat_id;
  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if c.seller_id is distinct from auth.uid() then
    raise exception 'Somente o vendedor deste pedido pode avaliar o comprador.';
  end if;

  if c.status <> 'delivered' then
    raise exception 'Voce pode avaliar o comprador depois de entregar o pedido.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Escolha de 1 a 5 estrelas.';
  end if;

  select coalesce(full_name, split_part(email, '@', 1)) into v_name
  from public.profiles where id = auth.uid();

  insert into public.buyer_reviews
    (chat_id, seller_id, seller_name, buyer_id, buyer_name, rating, comment)
  values
    (p_chat_id, auth.uid(), coalesce(v_name, c.seller_name), c.buyer_id, c.buyer_name, p_rating,
     nullif(left(trim(coalesce(p_comment, '')), 600), ''))
  on conflict (chat_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        updated_at = timezone('utc'::text, now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_buyer_review(uuid, integer, text) from public;
revoke all on function public.submit_buyer_review(uuid, integer, text) from anon;
grant execute on function public.submit_buyer_review(uuid, integer, text) to authenticated;
