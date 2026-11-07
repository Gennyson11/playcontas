-- ====================================================================
-- CENTRAL DAS IAS - EDITAR AVALIACAO
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Rode DEPOIS do setup-reviews.sql. Pode rodar mais de uma vez.
--
-- Efeito: o comprador pode alterar a propria avaliacao (nota e comentario)
-- quando quiser. Continua sendo uma avaliacao por pedido.
-- ====================================================================

alter table public.product_reviews
  add column if not exists updated_at timestamp with time zone;

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
  v_comment text;
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

  v_comment := nullif(left(trim(coalesce(p_comment, '')), 600), '');

  -- Ja avaliou? Entao atualiza a avaliacao existente (editar)
  select id into v_id from public.product_reviews where chat_id = p_chat_id;
  if v_id is not null then
    update public.product_reviews
    set rating = p_rating,
        comment = v_comment,
        updated_at = timezone('utc'::text, now())
    where id = v_id;
    return v_id;
  end if;

  select coalesce(full_name, split_part(email, '@', 1)) into v_name
  from public.profiles where id = auth.uid();

  insert into public.product_reviews
    (chat_id, product_id, product_title, seller_id, seller_name, buyer_id, buyer_name, rating, comment)
  values
    (p_chat_id, coalesce(c.product_id, ''), c.product_title, c.seller_id, c.seller_name,
     auth.uid(), coalesce(v_name, c.buyer_name, 'Cliente'), p_rating, v_comment)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_review(uuid, integer, text) from public;
revoke all on function public.submit_review(uuid, integer, text) from anon;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
