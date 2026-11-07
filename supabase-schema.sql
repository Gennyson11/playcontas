-- ==============================================================================
-- CENTRAL DAS IAS - SCHEMA COMPLETO SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase (https://app.supabase.com)
-- ==============================================================================

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. TABELA DE PERFIS DE USUÁRIOS (PROFILES)
-- Conecta-se automaticamente ao auth.users do Supabase
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text default 'https://api.dicebear.com/7.x/bottts/svg?seed=user',
  role text default 'buyer' check (role in ('admin', 'seller', 'buyer')),
  balance numeric(10, 2) default 0.00,
  phone text,
  is_verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em profiles
alter table public.profiles enable row level security;

-- Políticas de acesso para profiles
create policy "Perfis públicos são visíveis por todos"
  on public.profiles for select
  using (true);

create policy "Usuários podem atualizar seus próprios perfis"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Administradores podem gerenciar todos os perfis"
  on public.profiles for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 3. TRIGGER AUTOMÁTICO PARA CRIAR PROFILE QUANDO O USUÁRIO SE REGISTRAR NO SUPABASE
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'buyer')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Remove trigger antigo se existir e recria
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. TABELA DE PRODUTOS / ANÚNCIOS (PRODUCTS)
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.profiles(id) on delete set null,
  seller_name text default 'Central das IAs',
  title text not null,
  description text,
  category text not null default 'Outros',
  price numeric(10, 2) not null default 0.00,
  original_price numeric(10, 2),
  stock integer default 10,
  sales_count integer default 0,
  image text default 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
  delivery_type text default 'automatic' check (delivery_type in ('automatic', 'manual')),
  delivery_content text, -- Chave de ativação, link ou credenciais que o comprador recebe imediatamente
  status text default 'active' check (status in ('active', 'paused', 'pending_approval', 'deleted')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em products
alter table public.products enable row level security;

create policy "Qualquer pessoa pode visualizar produtos ativos"
  on public.products for select
  using (status = 'active' or auth.uid() = seller_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Vendedores podem criar produtos"
  on public.products for insert
  with check (auth.uid() is not null);

create policy "Vendedores e Admins podem editar seus produtos"
  on public.products for update
  using (
    auth.uid() = seller_id or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Vendedores e Admins podem excluir produtos"
  on public.products for delete
  using (
    auth.uid() = seller_id or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- 5. TABELA DE PEDIDOS E VENDAS (ORDERS)
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_email text not null,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  seller_id uuid references public.profiles(id) on delete set null,
  variant_label text default 'Padrão',
  amount numeric(10, 2) not null,
  status text default 'completed' check (status in ('pending', 'completed', 'cancelled', 'refunded')),
  payment_method text default 'PIX' check (payment_method in ('PIX', 'Cartão', 'Saldo')),
  delivered_data text, -- O que foi entregue automaticamente
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em orders
alter table public.orders enable row level security;

create policy "Compradores podem ver seus próprios pedidos"
  on public.orders for select
  using (
    auth.uid() = buyer_id or auth.uid() = seller_id or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Usuários autenticados podem criar pedidos"
  on public.orders for insert
  with check (auth.uid() is not null);

-- 6. INSERIR DADOS INICIAIS DE TESTE (SEEDS)
insert into public.products (title, description, category, price, original_price, stock, sales_count, image, delivery_type, delivery_content, status)
values
  ('CALL OF DUTY: BLACK OPS 4', 'Acesso completo ao Call of Duty Black Ops 4 com multiplayer e zombies ativados.', 'Games', 19.99, 120.00, 50, 1420, 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80', 'automatic', 'COD-BO4-KEY-9948-2847-XBL', 'active'),
  ('CHATGPT PLUS 4o - CONTA PRIVADA', 'Acesso exclusivo ChatGPT Plus com modelo GPT-4o, geração de imagens DALL-E 3 e canvas.', 'Inteligência Artificial', 34.90, 110.00, 30, 840, 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80', 'automatic', 'login: user_ia_plus@central.com | senha: password123', 'active'),
  ('MIDJOURNEY V6 PRO - CONTA COMPARTILHADA', 'Geração ilimitada de artes hiper-realistas em alta definição sem filas.', 'Design & Imagem', 27.50, 79.90, 15, 620, 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80', 'automatic', 'Acesse o Discord oficial do servidor: https://discord.gg/central-midjourney', 'active'),
  ('SPOTIFY PREMIUM 1 ANO INDIVIDUAL', 'Assinatura Spotify Premium individual válida por 12 meses na sua conta própria.', 'Streaming', 18.03, 119.40, 45, 950, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80', 'automatic', 'Link convite família Spotify: https://spotify.com/invite/984a1bc', 'active')
on conflict do nothing;

-- 7. TABELA DE VERIFICAÇÕES DE IDENTIDADE (VERIFICATIONS)
create table if not exists public.verifications (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null,
  user_avatar text,
  email text not null,
  phone text,
  pix_key text,
  pix_type text,
  full_name text not null,
  cpf text not null,
  birth_date text,
  mother_name text,
  nationality text default 'Brasileira',
  cep text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  address_proof_name text,
  document_type text default 'RG',
  document_number text,
  issuing_agency text,
  doc_front_name text,
  doc_back_name text,
  doc_selfie_name text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  notes text,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em verifications
alter table public.verifications enable row level security;

create policy "Usuários podem ver suas próprias verificações"
  on public.verifications for select
  using (
    auth.uid() = user_id or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Usuários autenticados podem enviar verificação"
  on public.verifications for insert
  with check (auth.uid() is not null);

create policy "Usuários e Admins podem atualizar verificações"
  on public.verifications for update
  using (
    auth.uid() = user_id or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- ==============================================================================
-- DICA: COMO TORNAR UM USUÁRIO ADMINISTRADOR NO SUPABASE
-- Após criar sua conta pelo site ou pelo painel auth do Supabase, execute:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'seu_email@aqui.com';
-- ==============================================================================
