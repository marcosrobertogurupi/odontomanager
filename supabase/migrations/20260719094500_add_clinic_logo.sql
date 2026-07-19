-- 1. Adicionar coluna logo_url na tabela tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Criar bucket de armazenamento clinic-logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de segurança para o bucket clinic-logos
DROP POLICY IF EXISTS "Allow public read access to clinic-logos" ON storage.objects;
CREATE POLICY "Allow public read access to clinic-logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'clinic-logos');

DROP POLICY IF EXISTS "Allow clinic owners to manage logos" ON storage.objects;
CREATE POLICY "Allow clinic owners to manage logos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'clinic-logos' AND
  split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
  (
    EXISTS (
      SELECT 1 FROM public.users_tenants
      WHERE user_id = auth.uid()
      AND tenant_id = split_part(name, '/', 1)::uuid
      AND role = 'clinic_owner'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
)
WITH CHECK (
  bucket_id = 'clinic-logos' AND
  split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
  (
    EXISTS (
      SELECT 1 FROM public.users_tenants
      WHERE user_id = auth.uid()
      AND tenant_id = split_part(name, '/', 1)::uuid
      AND role = 'clinic_owner'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
);
