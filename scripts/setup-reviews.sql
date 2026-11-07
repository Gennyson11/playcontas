-- ====================================================================
-- CENTRAL DAS IAS - AVALIACOES REAIS DOS CLIENTES
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Rode DEPOIS do setup-chat.sql e do update-chat-numbers.sql. Pode rodar mais de uma vez.
-- ====================================================================

create table if not exists public.product_reviews (
  id uuid default uuid_generate_v4() primary key,
  chat_id uuid references public.order_chats(id) on delete set null,
  product_id text not null,
  product_title text,
  seller_id uuid references public.profiles(id) on delete set null,
  seller_name text,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Uma avaliacao por pedido
create unique index if not exists product_reviews_chat_key on public.product_reviews (chat_id);
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, created_at desc);
create index if not exists product_reviews_seller_idx on public.product_reviews (seller_id);

alter table public.product_reviews enable row level security;

-- Avaliacoes sao publicas (aparecem no anuncio e no perfil do vendedor)
drop policy if exists "Avaliacoes sao publicas" on public.product_reviews;
create policy "Avaliacoes sao publicas"
  on public.product_reviews for select
  using (true);

-- Apenas o admin pode apagar uma avaliacao (ex.: abuso). Criar so pela funcao abaixo.
drop policy if exists "Admin apaga avaliacoes" on public.product_reviews;
create policy "Admin apaga avaliacoes"
  on public.product_reviews for delete
  using (public.is_admin());

-- O comprador avalia o pedido dele, depois que o vendedor entregou
create or replace function public.submit_review(
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

  if c.buyer_id is distinct from auth.uid() then
    raise exception 'Somente quem comprou pode avaliar este pedido.';
  end if;

  if c.status <> 'delivered' then
    raise exception 'Voce pode avaliar depois que o vendedor entregar o pedido.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Escolha de 1 a 5 estrelas.';
  end if;

  if exists (select 1 from public.product_reviews where chat_id = p_chat_id) then
    raise exception 'Voce ja avaliou este pedido.';
  end if;

  select coalesce(full_name, split_part(email, '@', 1)) into v_name
  from public.profiles where id = auth.uid();

  insert into public.product_reviews
    (chat_id, product_id, product_title, seller_id, seller_name, buyer_id, buyer_name, rating, comment)
  values
    (p_chat_id, coalesce(c.product_id, ''), c.product_title, c.seller_id, c.seller_name,
     auth.uid(), coalesce(v_name, c.buyer_name, 'Cliente'), p_rating,
     nullif(left(trim(coalesce(p_comment, '')), 600), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_review(uuid, integer, text) from public;
revoke all on function public.submit_review(uuid, integer, text) from anon;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
