-- =============================================================================
-- Migration: Análise de fotos/radiografias por IA (botão "Analisar", só sob demanda)
-- Cada linha é uma análise de uma foto por um modelo. Serve ao mesmo tempo como:
--   * cache (reabrir a foto não gera novo custo);
--   * medidor de uso/custo por clínica (limite mensal);
--   * ficha do piloto (nota e observação do dentista por modelo).
-- Todas as ESCRITAS passam pela Edge Function `analyze-photo` (service role): não há política de
-- INSERT/UPDATE/DELETE, então o navegador só consegue ler as análises da própria clínica.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.photo_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.patient_photos(id) ON DELETE CASCADE,
  -- Modelo usado (ex.: "google/gemini-3.5-flash-lite"). A tela não mostra: no piloto a avaliação é às cegas.
  model TEXT NOT NULL,
  -- "Opção A", "Opção B"... no piloto com vários modelos; NULL quando há um modelo só.
  label TEXT,
  summary TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd NUMERIC(12, 6),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  rating_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photo_ai_analyses_photo
  ON public.photo_ai_analyses (photo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_ai_analyses_tenant_month
  ON public.photo_ai_analyses (tenant_id, created_at);

ALTER TABLE public.photo_ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_read_photo_ai_analyses" ON public.photo_ai_analyses;
CREATE POLICY "tenant_read_photo_ai_analyses" ON public.photo_ai_analyses
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));
