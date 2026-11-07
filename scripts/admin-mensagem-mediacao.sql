-- =====================================================================
-- Mensagem oficial de mediação no chat (enviada pelo ADMIN)
--
-- Por que existe: pelo site só é permitido escrever mensagens "text" nas
-- próprias conversas, e o admin não é participante da compra. Por isso o
-- parecer da mediação (saldo liberado / reembolso) nunca chegava ao vendedor.
-- Esta função deixa SOMENTE administradores postarem uma mensagem de sistema
-- em qualquer conversa.
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase e execute (Run).
-- É seguro rodar mais de uma vez.
-- =====================================================================

create or replace function public.admin_post_chat_message(
  p_chat_id uuid,
  p_body text,
  p_sender_name text default 'Central de Mediação Oficial'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem enviar mensagens de mediação.';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Mensagem vazia.';
  end if;

  if not exists (select 1 from public.order_chats where id = p_chat_id) then
    raise exception 'Conversa não encontrada.';
  end if;

  insert into public.chat_messages (chat_id, sender_id, sender_role, sender_name, kind, body)
  values (
    p_chat_id,
    auth.uid(),
    'system',
    coalesce(nullif(p_sender_name, ''), 'Central de Mediação Oficial'),
    'system',
    p_body
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_post_chat_message(uuid, text, text) from public;
revoke all on function public.admin_post_chat_message(uuid, text, text) from anon;
grant execute on function public.admin_post_chat_message(uuid, text, text) to authenticated;
