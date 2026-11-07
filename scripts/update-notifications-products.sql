-- CENTRAL DAS IAS - ATUALIZACAO: PRODUTO NAS NOTIFICACOES + NOTIFICACAO DE VENDA
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.

alter table public.notifications add column if not exists product_title text;
alter table public.notifications add column if not exists product_image text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('question', 'answer', 'sale', 'system'));
