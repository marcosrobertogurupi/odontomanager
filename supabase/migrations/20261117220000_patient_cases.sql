-- =============================================================================
-- Migration: Casos clínicos do paciente (organiza as fotos por tratamento)
-- Paciente -> Casos -> Fotos. Um caso é um tratamento com começo, meio e fim
-- (ex.: "Implantes 11 e 21", "Canal dente 36"). Fotos sem caso continuam valendo:
-- aparecem em "Sem caso" e podem ser movidas depois.
-- Também acrescenta a categoria de foto "durante" (etapas do meio do tratamento).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.patient_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  tooth TEXT CHECK (tooth IS NULL OR char_length(tooth) <= 60),
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido')),
  opened_on DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_on DATE,
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_cases_patient
  ON public.patient_cases (tenant_id, patient_id, opened_on DESC, created_at DESC);

ALTER TABLE public.patient_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_patient_cases" ON public.patient_cases;
CREATE POLICY "tenant_isolation_patient_cases" ON public.patient_cases
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_id AND p.tenant_id = patient_cases.tenant_id
    )
  );

-- Foto -> caso. Apagar o caso NÃO apaga as fotos: elas voltam para "Sem caso".
ALTER TABLE public.patient_photos
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.patient_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_photos_case ON public.patient_photos (case_id);

-- A foto só pode apontar para um caso do MESMO paciente e da MESMA clínica.
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
    AND (
      case_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.patient_cases c
        WHERE c.id = case_id
          AND c.patient_id = patient_photos.patient_id
          AND c.tenant_id = patient_photos.tenant_id
      )
    )
  );

-- Categoria "durante": troca o CHECK da coluna (o nome do constraint foi gerado automaticamente).
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.patient_photos'::regclass
      AND con.contype = 'c'
      AND att.attname = 'category'
  LOOP
    EXECUTE format('ALTER TABLE public.patient_photos DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.patient_photos
  ADD CONSTRAINT patient_photos_category_check
  CHECK (category IN ('radiografia', 'antes', 'durante', 'depois', 'outra'));
