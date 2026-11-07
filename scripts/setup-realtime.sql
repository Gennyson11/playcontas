-- CENTRAL DAS IAS - PARTE 2: TEMPO REAL (sininho atualiza sozinho)
-- Rode DEPOIS da parte 1. Se der erro "already member of publication", ignore: significa que ja esta ativo.

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.product_questions;
