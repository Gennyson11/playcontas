-- ====================================================================
-- CENTRAL DAS IAS: CONFIGURAÇÃO COMPLETA DO SUPABASE STORAGE
-- Execute este script no SQL Editor do seu Supabase (https://app.supabase.com)
-- ====================================================================

-- 1. Cria os buckets públicos para produtos e avatares
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('products', 'products', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']),
  ('avatars', 'avatars', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Habilita RLS em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para leitura pública (qualquer pessoa visualiza os banners e fotos)
DROP POLICY IF EXISTS "Public Read Products" ON storage.objects;
CREATE POLICY "Public Read Products" ON storage.objects 
  FOR SELECT USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars" ON storage.objects 
  FOR SELECT USING (bucket_id = 'avatars');

-- 4. Políticas para upload e atualização de imagens
DROP POLICY IF EXISTS "Public Upload Products" ON storage.objects;
CREATE POLICY "Public Upload Products" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Update Products" ON storage.objects;
CREATE POLICY "Public Update Products" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Upload Avatars" ON storage.objects;
CREATE POLICY "Public Upload Avatars" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Update Avatars" ON storage.objects;
CREATE POLICY "Public Update Avatars" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'avatars');
