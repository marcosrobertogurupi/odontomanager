-- Migration: Adicionar suporte a avisos do sistema e limpar comunicados mock/teste
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Criar índice para consultas filtrando por avisos do sistema
CREATE INDEX IF NOT EXISTS idx_announcements_is_system ON public.announcements(is_system);

-- Apagar dados fictícios/mock de comunicados anteriores
DELETE FROM public.announcements 
WHERE title IN (
  'Manutenção de Equipamento', 
  'Nova Versão ZaiONe', 
  'Nova Versão ZaiOne', 
  'Férias Dra. Beatriz'
);
