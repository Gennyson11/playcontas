-- CENTRAL DAS IAS - PERGUNTAS DOS ANUNCIOS + NOTIFICACOES (PARTE 1: TABELAS)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.

create extension if not exists "uuid-ossp";

create table if not exists public.product_questions (
  id uuid default uuid_generate_v4() primary key,
  product_id text not null,
  product_title text,
  seller_id text,
  seller_name text,
  asker_id uuid references public.profiles(id) on delete set null,
  asker_name text not null,
  asker_avatar text,
  question text not null,
  answer text,
  answered_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists product_questions_product_idx on public.product_questions (product_id, created_at desc);

alter table public.product_questions enable row level security;

drop policy if exists "Perguntas sao publicas" on public.product_questions;
create policy "Perguntas sao publicas"
  on public.product_questions for select
  using (true);

drop policy if exists "Usuarios logados podem perguntar" on public.product_questions;
create policy "Usuarios logados podem perguntar"
  on public.product_questions for insert
  with check (auth.uid() is not null and asker_id = auth.uid());

drop policy if exists "Vendedor ou admin respondem perguntas" on public.product_questions;
create policy "Vendedor ou admin respondem perguntas"
  on public.product_questions for update
  using (
    auth.uid() is not null and (
      seller_id = auth.uid()::text
      or seller_name ilike (select full_name from public.profiles where id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

drop policy if exists "Autor vendedor ou admin excluem perguntas" on public.product_questions;
create policy "Autor vendedor ou admin excluem perguntas"
  on public.product_questions for delete
  using (
    auth.uid() is not null and (
      asker_id = auth.uid()
      or seller_id = auth.uid()::text
      or seller_name ilike (select full_name from public.profiles where id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  kind text not null default 'question' check (kind in ('question', 'answer', 'system')),
  title text not null,
  body text,
  link text,
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Ver minhas notificacoes" on public.notifications;
create policy "Ver minhas notificacoes"
  on public.notifications for select
  using (recipient_id = auth.uid());

drop policy if exists "Marcar minhas notificacoes como lidas" on public.notifications;
create policy "Marcar minhas notificacoes como lidas"
  on public.notifications for update
  using (recipient_id = auth.uid());

drop policy if exists "Apagar minhas notificacoes" on public.notifications;
create policy "Apagar minhas notificacoes"
  on public.notifications for delete
  using (recipient_id = auth.uid());

drop policy if exists "Usuarios logados criam notificacoes" on public.notifications;
create policy "Usuarios logados criam notificacoes"
  on public.notifications for insert
  with check (auth.uid() is not null);
