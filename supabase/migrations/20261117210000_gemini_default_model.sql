-- =============================================================================
-- Migration: troca o modelo padrão do Gemini (o gemini-1.5-flash foi desligado pelo Google)
-- Só mexe em quem ainda tem um modelo já desligado (famílias 1.5 e 2.0) salvo; escolhas
-- personalizadas e modelos atuais (ex.: gemini-3.5-flash) ficam como estão.
-- =============================================================================

ALTER TABLE public.tenant_integrations
  ALTER COLUMN gemini_model SET DEFAULT 'gemini-3.8-flash';

UPDATE public.tenant_integrations
SET gemini_model = 'gemini-3.8-flash'
WHERE gemini_model ~* '^(models/)?gemini-(1\.[0-9]|2\.0)';
