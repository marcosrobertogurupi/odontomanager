-- Criar tabela de comunicados e avisos
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('urgent', 'new', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant_id ON public.announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_unit_id ON public.announcements(unit_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por Tenant
DROP POLICY IF EXISTS "tenant_isolation_announcements" ON public.announcements;
CREATE POLICY "tenant_isolation_announcements" ON public.announcements
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

-- Inserir comunicados padrão para todos os tenants existentes
INSERT INTO public.announcements (tenant_id, tag, tag_type, title, body, created_at)
SELECT 
  id, 
  'Urgente', 
  'urgent', 
  'Manutenção de Equipamento', 
  'O autoclave do Consultório B passará por calibração obrigatória às 14h.',
  timezone('utc'::text, now())
FROM public.tenants;

INSERT INTO public.announcements (tenant_id, tag, tag_type, title, body, created_at)
SELECT 
  id, 
  'Novidade', 
  'new', 
  'Nova Versão ZaiONe', 
  'O assistente Zai agora avisa via WhatsApp quando o paciente chega na clínica!',
  timezone('utc'::text, now()) - INTERVAL '1 day'
FROM public.tenants;

INSERT INTO public.announcements (tenant_id, tag, tag_type, title, body, created_at)
SELECT 
  id, 
  'Geral', 
  'general', 
  'Férias Dra. Beatriz', 
  'Lembramos que a Dra. Beatriz estará ausente no período de 01 a 10 de Agosto.',
  timezone('utc'::text, now()) - INTERVAL '4 days'
FROM public.tenants;
