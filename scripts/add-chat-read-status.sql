-- ============================================================================
-- CENTRAL DAS IAS: STATUS DE VISUALIZAÇÃO DO CHAT (DOIS RISQUINHOS / CHECKMARKS)
-- Execute este script no SQL Editor do Supabase para habilitar a gravação
-- permanente do status de visualização das mensagens e tempo real.
-- ============================================================================

-- 1. Adiciona as colunas is_read e read_at se ainda não existirem
alter table public.chat_messages
  add column if not exists is_read boolean default false,
  add column if not exists read_at timestamp with time zone default null;

-- 2. Índice para consultas rápidas de mensagens não lidas
create index if not exists chat_messages_unread_idx
  on public.chat_messages (chat_id, sender_id)
  where is_read = false or read_at is null;

-- 3. Habilita Realtime para as tabelas de chat
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.order_chats;

-- 4. Permite que os participantes do chat atualizem o status de lida (is_read / read_at)
drop policy if exists "Participantes atualizam status de lido" on public.chat_messages;
create policy "Participantes atualizam status de lido"
  on public.chat_messages for update
  using (
    exists (
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
