-- CENTRAL DAS IAS - CHAT: TEMPO REAL (rode DEPOIS do setup-chat.sql)
-- Se aparecer 'already member of publication', ignore: significa que ja esta ativo.

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.order_chats;
