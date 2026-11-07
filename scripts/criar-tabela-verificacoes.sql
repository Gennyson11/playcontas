-- ====================================================================
-- PLAYCONTAS / CENTRAL DAS IAS: TABELA DE VERIFICAÇÕES DE VENDEDORES
-- Cole este script no SQL Editor do Supabase e clique em RUN.
-- ====================================================================

-- 1. Cria a tabela seller_verifications se não existir
CREATE TABLE IF NOT EXISTS public.seller_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text,
  email text UNIQUE,
  phone text,
  pix_key text,
  pix_type text,
  full_name text,
  cpf text,
  birth_date text,
  mother_name text,
  nationality text DEFAULT 'Brasileira',
  cep text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  document_type text DEFAULT 'RG',
  document_number text,
  issuing_agency text,
  doc_front_url text,
  doc_back_url text,
  doc_selfie_url text,
  address_proof_url text,
  status text DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone
);

-- 2. Habilita RLS e cria políticas abertas para submissão e moderação
ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um pode enviar verificacao" ON public.seller_verifications;
CREATE POLICY "Qualquer um pode enviar verificacao"
  ON public.seller_verifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Garante que qualquer administrador pode alterar a role de qualquer usuário em profiles
DROP POLICY IF EXISTS "Permitir update em profiles" ON public.profiles;
CREATE POLICY "Permitir update em profiles"
  ON public.profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Função auxiliar para aprovar ou rejeitar vendedores
CREATE OR REPLACE FUNCTION public.admin_set_role(target_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET role = new_role,
      is_verified = (CASE WHEN new_role IN ('seller', 'admin') THEN true ELSE false END)
  WHERE id = target_id;
END;
$$;

-- 5. Promove o Kevem imediatamente para Vendedor Verificado
UPDATE public.profiles
SET role = 'seller', is_verified = true
WHERE lower(email) = 'fensmolder@gmail.com';
