-- =============================================================================
-- Migration: Ciclo de qualidade da análise por IA
-- O modelo de IA NÃO aprende sozinho com o uso. A qualidade melhora por medição:
--   * prompt_version: qual versão das instruções gerou cada análise (comparar v1 x v2...);
--   * revised_summary: texto corrigido pelo dentista. É o melhor sinal de acerto (mais que estrelas):
--     se ele precisou reescrever, a IA errou. A análise original nunca é apagada.
-- Escritas continuam só pela Edge Function `analyze-photo` (não há política de INSERT/UPDATE).
-- =============================================================================

ALTER TABLE public.photo_ai_analyses
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS revised_summary TEXT,
  ADD COLUMN IF NOT EXISTS revised_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS revised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Análises anteriores a esta migração usaram a primeira versão do prompt.
UPDATE public.photo_ai_analyses SET prompt_version = 'v1' WHERE prompt_version IS NULL;

-- Relatório de qualidade por versão do prompt e modelo.
--   nota_media      : média das estrelas dadas pelo dentista (só das analisadas com nota);
--   pct_corrigidas  : % das análises cujo texto o dentista precisou reescrever (menor = melhor);
--   custo_medio_usd : custo médio por análise.
-- security_invoker: quem consulta só enxerga as análises das próprias clínicas (RLS da tabela).
-- No SQL Editor do Supabase (papel de administrador) mostra todas as clínicas juntas.
CREATE OR REPLACE VIEW public.photo_ai_quality_report
WITH (security_invoker = true) AS
SELECT
  prompt_version,
  model,
  COUNT(*)                                                       AS analises,
  COUNT(rating)                                                  AS com_nota,
  ROUND(AVG(rating)::numeric, 2)                                 AS nota_media,
  COUNT(revised_summary)                                         AS corrigidas,
  ROUND(100.0 * COUNT(revised_summary) / COUNT(*), 1)            AS pct_corrigidas,
  ROUND(AVG(cost_usd)::numeric, 5)                               AS custo_medio_usd
FROM public.photo_ai_analyses
GROUP BY prompt_version, model
ORDER BY prompt_version, nota_media DESC NULLS LAST;
