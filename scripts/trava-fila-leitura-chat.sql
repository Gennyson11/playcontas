-- ====================================================================
-- CENTRAL DAS IAS - TRAVA CONTRA FILA DE "MENSAGEM VISTA" NO CHAT
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez.
--
-- Efeito: o banco passa a ignorar atualizacoes em mensagens que JA estao lidas.
-- Assim, mesmo uma aba antiga do site (codigo velho) nao consegue mais travar o banco.
-- ====================================================================

drop policy if exists "Participantes atualizam status de lido" on public.chat_messages;
create policy "Participantes atualizam status de lido"
  on public.chat_messages for update
  using (
    coalesce(chat_messages.is_read, false) = false
    and exists (
      select 1 from public.order_chats c
      where c.id = chat_messages.chat_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.order_chats c
      where c.id = chat_messages.chat_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin())
    )
  );

-- Encerra agora as atualizacoes de leitura que estao na fila
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = current_database()
  and state <> 'idle'
  and pid <> pg_backend_pid()
  and query like '%chat_messages%is_read%';
