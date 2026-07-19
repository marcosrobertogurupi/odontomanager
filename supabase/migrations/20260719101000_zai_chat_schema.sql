-- Tabela de conversas (paciente, equipe ou assistente de IA)
CREATE TABLE IF NOT EXISTS public.zai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('patient', 'staff', 'zai_assistant')),
  title TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zai_chats_tenant_id ON public.zai_chats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zai_chats_patient_id ON public.zai_chats(patient_id);
CREATE INDEX IF NOT EXISTS idx_zai_chats_created_by ON public.zai_chats(created_by);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.zai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.zai_chats(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id UUID, -- ID do profissional (auth.users) ou paciente
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('staff', 'patient', 'zai_assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zai_messages_chat_id ON public.zai_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_zai_messages_tenant_id ON public.zai_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zai_messages_created_at ON public.zai_messages(created_at);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.zai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zai_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de isolamento por Tenant
DROP POLICY IF EXISTS "tenant_isolation_zai_chats" ON public.zai_chats;
CREATE POLICY "tenant_isolation_zai_chats" ON public.zai_chats
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tenant_isolation_zai_messages" ON public.zai_messages;
CREATE POLICY "tenant_isolation_zai_messages" ON public.zai_messages
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

-- Configuração do Realtime
ALTER TABLE public.zai_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zai_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zai_messages;
  END IF;
END $$;

-- Trigger para atualizar updated_at do chat correspondente quando chega uma mensagem nova
CREATE OR REPLACE FUNCTION public.touch_zai_chat_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.zai_chats 
  SET updated_at = timezone('utc'::text, now()) 
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_zai_chat ON public.zai_messages;
CREATE TRIGGER trg_touch_zai_chat
  AFTER INSERT ON public.zai_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_zai_chat_updated_at();
