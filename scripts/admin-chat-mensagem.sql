-- =====================================================================
-- Admin conversando no chat de uma compra (sem ser comprador/vendedor)
--
-- Por que existe: pelo site só participantes da compra podem gravar mensagens.
-- O admin não é participante, então a mensagem dele aparecia na tela e SUMIA
-- quando o chat recarregava (o banco recusava em silêncio).
-- Esta função deixa SOMENTE administradores enviarem mensagens de texto em
-- qualquer conversa, com o papel "system" (aparece com o selo de Admin).
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase e execute (Run).
-- É seguro rodar mais de uma vez.
-- =====================================================================

create or replace function public.admin_send_chat_message(
  p_chat_id uuid,
  p_body text,
  p_sender_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem enviar mensagens por esta função.';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Mensagem vazia.';
  end if;

  if not exists (select 1 from public.order_chats where id = p_chat_id) then
    raise exception 'Conversa não encontrada.';
  end if;

  select coalesce(nullif(p_sender_name, ''), full_name, split_part(email, '@', 1))
    into v_name
  from public.profiles
  where id = auth.uid();

  insert into public.chat_messages (chat_id, sender_id, sender_role, sender_name, kind, body)
  values (p_chat_id, auth.uid(), 'buyer', v_name, 'text', trim(p_body))
  returning id into v_id;

  -- O gatilho do chat força o papel "buyer"/"seller" em mensagens de texto na inserção;
  -- corrige para "system" logo depois (o gatilho só roda em INSERT).
  update public.chat_messages set sender_role = 'system' where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_send_chat_message(uuid, text, text) from public;
revoke all on function public.admin_send_chat_message(uuid, text, text) from anon;
grant execute on function public.admin_send_chat_message(uuid, text, text) to authenticated;
