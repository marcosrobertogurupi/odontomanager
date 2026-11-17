-- =============================================================================
-- Migration: Fotos dos pacientes (radiografias, antes e depois)
-- Os arquivos ficam no Cloudflare R2 (NÃO no Supabase Storage). Aqui fica só o
-- registro: de qual clínica/paciente é a foto e onde ela está no R2.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.patient_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Prefixo da chave no R2 (sem o sufixo do tamanho): <path>-grande.<ext>, -media, -mini
  path TEXT NOT NULL,
  ext TEXT NOT NULL CHECK (ext IN ('webp', 'jpg', 'png')),
  category TEXT NOT NULL DEFAULT 'outra'
    CHECK (category IN ('radiografia', 'antes', 'depois', 'outra')),
  caption TEXT,
  taken_on DATE NOT NULL DEFAULT CURRENT_DATE,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_photos_patient
  ON public.patient_photos (tenant_id, patient_id, taken_on DESC, created_at DESC);

ALTER TABLE public.patient_photos ENABLE ROW LEVEL SECURITY;

-- Mesmo isolamento por clínica das demais tabelas (usa get_user_tenant_ids()).
DROP POLICY IF EXISTS "tenant_isolation_patient_photos" ON public.patient_photos;
CREATE POLICY "tenant_isolation_patient_photos" ON public.patient_photos
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id AND p.tenant_id = patient_photos.tenant_id
    )
  );
