-- Criar tabela unidades_medida
CREATE TABLE IF NOT EXISTS public.unidades_medida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (tenant_id, nome)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

-- Política de RLS para isolamento de tenant
CREATE POLICY "tenant_isolation_unidades_medida" ON public.unidades_medida FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

-- Habilitar Realtime para unidades_medida
ALTER TABLE public.unidades_medida REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'unidades_medida'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unidades_medida;
  END IF;
END $$;
