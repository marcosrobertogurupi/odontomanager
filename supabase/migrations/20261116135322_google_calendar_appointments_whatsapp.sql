-- =============================================================================
-- Migration: Google Calendar Agenda, Isolamento por Profissional, Compromissos
-- Pessoais e Lembretes via WhatsApp com Antecedência Configurável
-- =============================================================================

-- 1. Permitir agendamentos pessoais (sem paciente obrigatório)
ALTER TABLE public.appointments
  ALTER COLUMN patient_id DROP NOT NULL;

-- 2. Adicionar novas colunas de Agenda Google Calendar & WhatsApp em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'clinic',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'peacock',
  ADD COLUMN IF NOT EXISTS whatsapp_notify BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS whatsapp_custom_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 3. Constraints de validação de tipo de evento e consistência
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_event_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_event_type_check
  CHECK (event_type IN ('clinic', 'personal'));

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_clinic_or_personal_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_clinic_or_personal_check
  CHECK (
    (event_type = 'clinic' AND patient_id IS NOT NULL)
    OR
    (event_type = 'personal' AND COALESCE(btrim(title), '') <> '')
  );

-- 4. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.trfn_appointments_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_appointments_set_updated_at ON public.appointments;
CREATE TRIGGER tg_appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trfn_appointments_set_updated_at();

-- 5. Índices otimizados para visualização estilo Google Calendar (Dia, Semana, Mês) e Lembretes WhatsApp
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_unit_prof_start
  ON public.appointments (tenant_id, unit_id, professional_id, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_whatsapp_pending
  ON public.appointments (tenant_id, start_time)
  WHERE whatsapp_notify = true
    AND whatsapp_reminder_sent = false
    AND status IN ('scheduled', 'confirmed');

-- 6. Função auxiliar de RLS para garantir que um profissional (dentist) nunca veja compromissos de outro profissional
CREATE OR REPLACE FUNCTION public.can_access_appointment(
  p_tenant_id UUID,
  p_professional_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users_tenants ut
    WHERE ut.user_id = (SELECT auth.uid())
      AND ut.tenant_id = p_tenant_id
      AND (
        ut.role IN ('super_admin', 'clinic_owner', 'admin', 'receptionist')
        OR (ut.role = 'dentist' AND p_professional_id = (SELECT auth.uid()))
      )
  )
  OR (SELECT public.is_super_admin((SELECT auth.uid())));
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_appointment(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_appointment(UUID, UUID) TO authenticated;

-- 7. Atualizar política de RLS na tabela appointments
DROP POLICY IF EXISTS "tenant_isolation_appointments" ON public.appointments;
CREATE POLICY "tenant_isolation_appointments" ON public.appointments
  FOR ALL TO authenticated
  USING ((SELECT public.can_access_appointment(tenant_id, professional_id)))
  WITH CHECK ((SELECT public.can_access_appointment(tenant_id, professional_id)));

-- 8. Habilitar Realtime na tabela appointments para sincronização instantânea
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;
