-- =============================================================================
-- Migration: Sincronização Completa entre Código (Frontend/Backend/Edge) e Banco
-- =============================================================================
-- 1. Corrige o erro "duplicate key value violates unique constraint patients_cpf_key":
--    - Remove a constraint global patients_cpf_key
--    - Normaliza CPFs vazios ou preenchidos apenas com zeros (ex: 00000000000) para NULL
--    - Cria trigger de normalização automática de CPF em patients
--    - Cria índice único parcial por clínica (tenant_id, dígitos do CPF)
-- 2. Garante a existência de todas as colunas e tabelas referenciadas pelo código
-- 3. Atualiza handle_new_user() para vincular invited_unit_id e criar unidade padrão
-- 4. Remove overloads legados de RPCs sem tenant_id e sincroniza baixa de estoque + avisos
-- 5. Atualiza views de precificação/rentabilidade para usar fallback em procedures.price
-- =============================================================================

-- =============================================================================
-- 1. PACIENTES: CORREÇÃO DA CONSTRAINT DE CPF E NORMALIZAÇÃO AUTOMÁTICA
-- =============================================================================

-- 1.1. Remover constraint UNIQUE global de CPF
ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_cpf_key;

-- 1.2. Garantir todas as colunas usadas no frontend (Patients.tsx, Papelaria.tsx, PatientBudget.tsx)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'TO',
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS responsible_name TEXT,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS satisfaction_score NUMERIC(3,1) DEFAULT 10.0,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 1.3. Limpar CPFs vazios ou placeholders de zeros (ex: '00000000000', '000.000.000-00', '-')
UPDATE public.patients
SET cpf = NULL
WHERE cpf IS NOT NULL
  AND (
    regexp_replace(cpf, '\D', '', 'g') = ''
    OR regexp_replace(cpf, '\D', '', 'g') ~ '^0+$'
  );

-- 1.4. Caso já existam CPFs duplicados dentro do mesmo tenant, manter o primeiro e anular o CPF duplicado
WITH ranked_cpfs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, regexp_replace(cpf, '\D', '', 'g')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.patients
  WHERE tenant_id IS NOT NULL
    AND cpf IS NOT NULL
    AND regexp_replace(cpf, '\D', '', 'g') <> ''
    AND regexp_replace(cpf, '\D', '', 'g') !~ '^0+$'
)
UPDATE public.patients p
SET cpf = NULL
FROM ranked_cpfs r
WHERE p.id = r.id
  AND r.rn > 1;

-- 1.5. Trigger para normalizar CPF automaticamente antes de INSERT ou UPDATE
CREATE OR REPLACE FUNCTION public.trfn_normalize_patient_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := btrim(NEW.cpf);
    v_digits := regexp_replace(NEW.cpf, '\D', '', 'g');
    IF v_digits = '' OR v_digits ~ '^0+$' THEN
      NEW.cpf := NULL;
    END IF;
  END IF;

  IF NEW.state IS NULL OR btrim(NEW.state) = '' THEN
    NEW.state := 'TO';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_normalize_patient_cpf ON public.patients;
CREATE TRIGGER tg_normalize_patient_cpf
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.trfn_normalize_patient_cpf();

-- 1.6. Índice único parcial por clínica (tenant_id + apenas dígitos do CPF)
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_tenant_cpf
  ON public.patients (tenant_id, regexp_replace(cpf, '\D', '', 'g'))
  WHERE tenant_id IS NOT NULL
    AND cpf IS NOT NULL
    AND regexp_replace(cpf, '\D', '', 'g') <> ''
    AND regexp_replace(cpf, '\D', '', 'g') !~ '^0+$';


-- =============================================================================
-- 2. SINCRONIZAÇÃO DE COLUNAS EM TODAS AS TABELAS DO SISTEMA
-- =============================================================================

-- 2.1. units (Patients.tsx e Papelaria.tsx referenciam selectedUnit.phone)
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2.2. profiles (Papelaria.tsx, PatientBudget.tsx e AdminSettings.tsx)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cro TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT;

-- 2.3. announcements (systemAnnouncements.ts, Dashboard.tsx e AdminSettings.tsx)
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- 2.4. tenants (TenantContext.tsx e AdminSettings.tsx)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefone_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS logradouro TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- 2.5. tenant_integrations (AdminSettings.tsx, PatientBudget.tsx, ZaiONe.tsx e Edge Functions)
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS uazapi_server_url TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_conectado BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_from_number TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
  ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-1.5-flash';

-- 2.6. procedures (AdminSettings.tsx, InventoryCosts.tsx, PatientBudget.tsx)
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS categoria_especialidade TEXT,
  ADD COLUMN IF NOT EXISTS preco_praticado NUMERIC(12,2) DEFAULT 0.00;

-- Sincronizar preco_praticado com price quando preco_praticado estiver zerado
UPDATE public.procedures
SET preco_praticado = price
WHERE COALESCE(preco_praticado, 0.00) = 0.00
  AND COALESCE(price, 0.00) > 0.00;


-- =============================================================================
-- 3. TRIGGER DE NOVO USUÁRIO (AuthScreen.tsx -> handle_new_user)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_id UUID;
    v_unit_id UUID;
    v_company_name TEXT;
    v_invited_tenant_id TEXT;
    v_invited_unit_id TEXT;
    v_role TEXT;
BEGIN
    v_company_name := NULLIF(btrim(new.raw_user_meta_data->>'company_name'), '');
    v_invited_tenant_id := NULLIF(btrim(new.raw_user_meta_data->>'invited_tenant_id'), '');
    v_invited_unit_id := NULLIF(btrim(new.raw_user_meta_data->>'invited_unit_id'), '');
    v_role := COALESCE(NULLIF(btrim(new.raw_user_meta_data->>'role'), ''), 'dentist');

    IF v_invited_unit_id IS NOT NULL THEN
        BEGIN
            v_unit_id := v_invited_unit_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_unit_id := NULL;
        END;
    END IF;

    -- Se for um novo proprietário (clinic_owner) registrando uma clínica
    IF v_role = 'clinic_owner' AND v_company_name IS NOT NULL THEN
        INSERT INTO public.tenants (nome_clinica, plano, status_assinatura)
        VALUES (v_company_name, 'Pro', 'ativo')
        RETURNING id INTO v_tenant_id;

        -- Criar unidade inicial padrão para que a clínica já funcione imediatamente
        INSERT INTO public.units (name, address, tenant_id)
        VALUES ('Matriz', 'Endereço Principal', v_tenant_id)
        RETURNING id INTO v_unit_id;
    ELSIF v_invited_tenant_id IS NOT NULL THEN
        BEGIN
            v_tenant_id := v_invited_tenant_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    END IF;

    -- Criar o perfil do profissional correspondente
    INSERT INTO public.profiles (id, name, role, email, phone, tenant_id, unit_id)
    VALUES (
        new.id,
        COALESCE(NULLIF(btrim(new.raw_user_meta_data->>'name'), ''), 'Novo Profissional'),
        CASE WHEN v_role = 'clinic_owner' THEN 'admin' ELSE v_role END,
        new.email,
        NULLIF(btrim(new.raw_user_meta_data->>'phone'), ''),
        v_tenant_id,
        v_unit_id
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        role = EXCLUDED.role,
        email = EXCLUDED.email,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        tenant_id = COALESCE(EXCLUDED.tenant_id, public.profiles.tenant_id),
        unit_id = COALESCE(EXCLUDED.unit_id, public.profiles.unit_id);

    -- Criar associação de acesso em users_tenants
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO public.users_tenants (user_id, tenant_id, unit_id, role)
        VALUES (new.id, v_tenant_id, v_unit_id, v_role)
        ON CONFLICT (user_id, tenant_id) DO UPDATE
        SET unit_id = COALESCE(EXCLUDED.unit_id, public.users_tenants.unit_id),
            role = EXCLUDED.role;
    END IF;

    RETURN new;
END;
$$;


-- =============================================================================
-- 4. LIMPEZA DE OVERLOADS LEGADOS E ATUALIZAÇÃO DE RPCs / TRIGGERS DE ESTOQUE
-- =============================================================================

-- Remover assinaturas antigas sem tenant_id (criadas na migration 20260718200500)
DROP FUNCTION IF EXISTS public.processar_compra_estoque(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.estornar_consumo_atendimento(UUID, UUID);
DROP FUNCTION IF EXISTS public.registrar_consumo_atendimento(UUID, UUID, UUID, JSONB);

-- Atualizar funções com search_path seguro
CREATE OR REPLACE FUNCTION public.touch_zai_chat_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.zai_chats
  SET updated_at = timezone('utc'::text, now())
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deletar_insumo_completo(
    p_insumo_id UUID,
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.insumos WHERE id = p_insumo_id AND tenant_id = p_tenant_id) THEN
        RAISE EXCEPTION 'Insumo não encontrado ou sem permissão para esta clínica.';
    END IF;

    DELETE FROM public.procedimento_insumos WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.movimentacoes_estoque WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.compras_estoque WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.estoque_unidade WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.insumos WHERE id = p_insumo_id AND tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.zerar_estoque_completo(
    p_tenant_id UUID,
    p_mode TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_mode = 'apagar_tudo' THEN
        DELETE FROM public.procedimento_insumos WHERE tenant_id = p_tenant_id;
        DELETE FROM public.movimentacoes_estoque WHERE tenant_id = p_tenant_id;
        DELETE FROM public.compras_estoque WHERE tenant_id = p_tenant_id;
        DELETE FROM public.estoque_unidade WHERE tenant_id = p_tenant_id;
        DELETE FROM public.insumos WHERE tenant_id = p_tenant_id;
    ELSIF p_mode = 'zerar_saldos' THEN
        UPDATE public.estoque_unidade
        SET quantidade_atual = 0.00, updated_at = now()
        WHERE tenant_id = p_tenant_id;

        INSERT INTO public.movimentacoes_estoque (tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, created_at)
        SELECT eu.tenant_id, eu.unit_id, eu.insumo_id, 'ajuste', 0, 'Estoque zerado manualmente pelo usuário', now()
        FROM public.estoque_unidade eu
        WHERE eu.tenant_id = p_tenant_id;
    ELSE
        RAISE EXCEPTION 'Modo inválido. Use ''zerar_saldos'' ou ''apagar_tudo''.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trfn_atualiza_preco_embalagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rendimento NUMERIC;
    v_quantidade_uso NUMERIC;
BEGIN
    SELECT COALESCE(quantidade_rendimento, 1.00) INTO v_rendimento
    FROM public.insumos
    WHERE id = NEW.insumo_id;

    v_quantidade_uso := NEW.quantidade_comprada * v_rendimento;

    UPDATE public.insumos
    SET preco_embalagem_atual = NEW.preco_pago_embalagem,
        updated_at = now()
    WHERE id = NEW.insumo_id AND tenant_id = NEW.tenant_id;

    INSERT INTO public.movimentacoes_estoque (
        tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
    ) VALUES (
        NEW.tenant_id, NEW.unit_id, NEW.insumo_id, 'entrada', v_quantidade_uso, 'compra', 'compra', NEW.id, now()
    );

    INSERT INTO public.estoque_unidade (
        tenant_id, unit_id, insumo_id, quantidade_atual, updated_at
    ) VALUES (
        NEW.tenant_id, NEW.unit_id, NEW.insumo_id, v_quantidade_uso, now()
    )
    ON CONFLICT (unit_id, insumo_id) DO UPDATE
    SET quantidade_atual = public.estoque_unidade.quantidade_atual + EXCLUDED.quantidade_atual,
        updated_at = now();

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trfn_baixa_estoque_procedimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_appointment RECORD;
    v_insumo RECORD;
    v_estoque_atual NUMERIC;
    v_estoque_minimo NUMERIC;
    v_insumo_nome TEXT;
    v_alert_title TEXT;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'checked_out') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'checked_out' AND OLD.status IS DISTINCT FROM 'checked_out') THEN

        SELECT tenant_id, unit_id, procedure_id
        INTO v_appointment
        FROM public.appointments
        WHERE id = NEW.appointment_id;

        IF v_appointment.procedure_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.movimentacoes_estoque
                WHERE referencia_tipo = 'appointment' AND referencia_id = NEW.appointment_id
            ) THEN
                FOR v_insumo IN
                    SELECT insumo_id, quantidade_usada_por_procedimento
                    FROM public.procedimento_insumos
                    WHERE procedure_id = v_appointment.procedure_id
                LOOP
                    INSERT INTO public.estoque_unidade (
                        tenant_id, unit_id, insumo_id, quantidade_atual, updated_at
                    ) VALUES (
                        v_appointment.tenant_id, v_appointment.unit_id, v_insumo.insumo_id, -v_insumo.quantidade_usada_por_procedimento, now()
                    )
                    ON CONFLICT (unit_id, insumo_id) DO UPDATE
                    SET quantidade_atual = public.estoque_unidade.quantidade_atual - v_insumo.quantidade_usada_por_procedimento,
                        updated_at = now()
                    RETURNING quantidade_atual INTO v_estoque_atual;

                    INSERT INTO public.movimentacoes_estoque (
                        tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
                    ) VALUES (
                        v_appointment.tenant_id, v_appointment.unit_id, v_insumo.insumo_id, 'saida', v_insumo.quantidade_usada_por_procedimento, 'uso_procedimento', 'appointment', NEW.appointment_id, now()
                    );

                    SELECT nome, estoque_minimo INTO v_insumo_nome, v_estoque_minimo
                    FROM public.insumos
                    WHERE id = v_insumo.insumo_id;

                    v_alert_title := 'Alerta de Estoque: ' || v_insumo_nome;

                    IF v_estoque_atual <= COALESCE(v_estoque_minimo, 0.00) AND COALESCE(v_estoque_minimo, 0.00) > 0 THEN
                        IF NOT EXISTS (
                            SELECT 1 FROM public.announcements
                            WHERE tenant_id = v_appointment.tenant_id
                              AND title = v_alert_title
                        ) THEN
                            INSERT INTO public.announcements (
                                tenant_id, unit_id, tag, tag_type, title, body, is_system, created_at
                            ) VALUES (
                                v_appointment.tenant_id,
                                v_appointment.unit_id,
                                'Estoque Baixo',
                                'urgent',
                                v_alert_title,
                                'O estoque de "' || v_insumo_nome || '" está em ' || v_estoque_atual || ', abaixo do mínimo ideal (' || v_estoque_minimo || '). Realize uma nova compra.',
                                true,
                                now()
                            );
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        END IF;

    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'checked_out' AND NEW.status IS DISTINCT FROM 'checked_out') THEN

        SELECT tenant_id, unit_id, procedure_id
        INTO v_appointment
        FROM public.appointments
        WHERE id = NEW.appointment_id;

        IF v_appointment.procedure_id IS NOT NULL THEN
            FOR v_insumo IN
                SELECT insumo_id, quantidade
                FROM public.movimentacoes_estoque
                WHERE referencia_tipo = 'appointment' AND referencia_id = NEW.appointment_id AND tipo = 'saida'
            LOOP
                UPDATE public.estoque_unidade
                SET quantidade_atual = quantidade_atual + v_insumo.quantidade,
                    updated_at = now()
                WHERE unit_id = v_appointment.unit_id AND insumo_id = v_insumo.insumo_id;

                INSERT INTO public.movimentacoes_estoque (
                    tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
                ) VALUES (
                    v_appointment.tenant_id, v_appointment.unit_id, v_insumo.insumo_id, 'entrada', v_insumo.quantidade, 'ajuste_manual', 'appointment_reverted', NEW.appointment_id, now()
                );
            END LOOP;

            DELETE FROM public.movimentacoes_estoque
            WHERE referencia_tipo = 'appointment' AND referencia_id = NEW.appointment_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_compra_estoque(
    p_insumo_id UUID,
    p_unit_id UUID,
    p_fornecedor TEXT,
    p_quantidade NUMERIC,
    p_valor_total NUMERIC,
    p_valor_unitario NUMERIC,
    p_nota_fiscal TEXT,
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.compras_estoque (
        tenant_id, unit_id, insumo_id, quantidade_comprada, preco_pago_embalagem, fornecedor, nota_fiscal, data_compra, created_at
    ) VALUES (
        p_tenant_id, p_unit_id, p_insumo_id, p_quantidade, p_valor_unitario, p_fornecedor, p_nota_fiscal, CURRENT_DATE, now()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_consumo_atendimento(
    p_appointment_id UUID,
    p_unit_id UUID,
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_row RECORD;
BEGIN
    FOR v_row IN
        SELECT insumo_id, quantidade
        FROM public.movimentacoes_estoque
        WHERE referencia_tipo = 'appointment' AND referencia_id = p_appointment_id AND tenant_id = p_tenant_id AND tipo = 'saida'
    LOOP
        UPDATE public.estoque_unidade
        SET quantidade_atual = quantidade_atual + v_row.quantidade,
            updated_at = now()
        WHERE insumo_id = v_row.insumo_id AND unit_id = p_unit_id AND tenant_id = p_tenant_id;

        INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, tenant_id)
        VALUES (v_row.insumo_id, p_unit_id, 'entrada', v_row.quantidade, 'ajuste_manual', 'appointment_reverted', p_appointment_id, p_tenant_id);
    END LOOP;

    DELETE FROM public.movimentacoes_estoque
    WHERE referencia_tipo = 'appointment' AND referencia_id = p_appointment_id AND tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_consumo_atendimento(
    p_appointment_id UUID,
    p_procedimento_id UUID,
    p_unit_id UUID,
    p_tenant_id UUID,
    p_consumos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_item JSONB;
    v_insumo_id UUID;
    v_qty_usada NUMERIC;
    v_estoque_atual NUMERIC;
    v_estoque_minimo NUMERIC;
    v_insumo_nome TEXT;
    v_alert_title TEXT;
BEGIN
    PERFORM public.estornar_consumo_atendimento(p_appointment_id, p_unit_id, p_tenant_id);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_consumos)
    LOOP
        v_insumo_id := (v_item->>'insumo_id')::UUID;
        v_qty_usada := (v_item->>'quantidade_usada')::NUMERIC;

        IF v_qty_usada > 0 THEN
            INSERT INTO public.estoque_unidade (insumo_id, unit_id, quantidade_atual, tenant_id, updated_at)
            VALUES (v_insumo_id, p_unit_id, -v_qty_usada, p_tenant_id, now())
            ON CONFLICT (unit_id, insumo_id) DO UPDATE
            SET quantidade_atual = public.estoque_unidade.quantidade_atual - v_qty_usada,
                updated_at = now()
            RETURNING quantidade_atual INTO v_estoque_atual;

            INSERT INTO public.movimentacoes_estoque (
                tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
            ) VALUES (
                p_tenant_id, p_unit_id, v_insumo_id, 'saida', v_qty_usada, 'uso_procedimento', 'appointment', p_appointment_id, now()
            );

            SELECT nome, estoque_minimo INTO v_insumo_nome, v_estoque_minimo
            FROM public.insumos
            WHERE id = v_insumo_id;

            v_alert_title := 'Alerta de Estoque: ' || v_insumo_nome;

            IF v_estoque_atual <= COALESCE(v_estoque_minimo, 0.00) AND COALESCE(v_estoque_minimo, 0.00) > 0 THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.announcements
                    WHERE tenant_id = p_tenant_id
                      AND title = v_alert_title
                ) THEN
                    INSERT INTO public.announcements (
                        tenant_id, unit_id, tag, tag_type, title, body, is_system, created_at
                    ) VALUES (
                        p_tenant_id,
                        p_unit_id,
                        'Estoque Baixo',
                        'urgent',
                        v_alert_title,
                        'O estoque de "' || v_insumo_nome || '" está em ' || v_estoque_atual || ', abaixo do mínimo ideal (' || v_estoque_minimo || '). Realize uma nova compra.',
                        true,
                        now()
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- =============================================================================
-- 5. ATUALIZAR VIEWS DE PRECIFICAÇÃO COM FALLBACK PARA procedures.price
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_precificacao_procedimento
WITH (security_invoker = true)
AS
WITH unit_hourly_cost AS (
    SELECT
        u.id AS unit_id,
        u.tenant_id,
        CASE
            WHEN COALESCE(pcu.horas_ocupadas_mes, 0.00) > 0.00 THEN
                ROUND(COALESCE(cf.total_custos, 0.00) / pcu.horas_ocupadas_mes, 2)
            ELSE 0.00
        END AS custo_hora_clinica
    FROM public.units u
    LEFT JOIN public.parametros_custo_unidade pcu
        ON pcu.unit_id = u.id
    LEFT JOIN (
        SELECT unit_id, SUM(valor_mensal) AS total_custos
        FROM public.custos_fixos
        WHERE ativo = true
        GROUP BY unit_id
    ) cf ON cf.unit_id = u.id
),
proc_material_cost AS (
    SELECT
        pi.procedure_id,
        ROUND(COALESCE(SUM(
            CASE
                WHEN i.quantidade_rendimento > 0 THEN
                    (i.preco_embalagem_atual / i.quantidade_rendimento * pi.quantidade_usada_por_procedimento) * pi.numero_consultas_necessarias
                ELSE 0.00
            END
        ), 0.00), 2) AS custo_material_geral
    FROM public.procedimento_insumos pi
    JOIN public.insumos i ON pi.insumo_id = i.id
    GROUP BY pi.procedure_id
),
base_calc AS (
    SELECT
        p.id AS procedure_id,
        p.tenant_id,
        uhc.unit_id,
        p.name AS procedure_name,
        p.categoria_especialidade,
        COALESCE(NULLIF(p.preco_praticado, 0.00), p.price, 0.00)::NUMERIC(12,2) AS preco_praticado,
        COALESCE(pc.custo_material_especial, 0.00) AS custo_material_especial,
        COALESCE(pc.custo_terceiros_laboratorio, 0.00) AS custo_terceiros_laboratorio,
        COALESCE(pc.tempo_consulta_minutos, 0.00) AS tempo_consulta_minutos,
        COALESCE(pc.numero_sessoes_total, 1.00) AS numero_sessoes_total,
        COALESCE(pc.comissao_profissional_pct, 0.00) AS comissao_profissional_pct,
        COALESCE(pc.taxa_cartao_pct, 0.00) AS taxa_cartao_pct,
        COALESCE(pc.impostos_pct, 0.00) AS impostos_pct,
        COALESCE(pc.margem_lucro_desejada_pct, 0.00) AS margem_lucro_desejada_pct,
        COALESCE(pc.outras_deducoes_pct, 0.00) AS outras_deducoes_pct,
        COALESCE(uhc.custo_hora_clinica, 0.00) AS custo_hora_clinica,
        COALESCE(pmc.custo_material_geral, 0.00) AS custo_material_geral,
        ROUND(
            (((COALESCE(pc.tempo_consulta_minutos, 0.00) / 60.0) * COALESCE(uhc.custo_hora_clinica, 0.00) * COALESCE(pc.numero_sessoes_total, 1.00))
            + COALESCE(pmc.custo_material_geral, 0.00)
            + COALESCE(pc.custo_material_especial, 0.00)
            + COALESCE(pc.custo_terceiros_laboratorio, 0.00)), 2
        ) AS custo_total,
        (
            COALESCE(pc.comissao_profissional_pct, 0.00) +
            COALESCE(pc.taxa_cartao_pct, 0.00) +
            COALESCE(pc.impostos_pct, 0.00) +
            COALESCE(pc.margem_lucro_desejada_pct, 0.00) +
            COALESCE(pc.outras_deducoes_pct, 0.00)
        ) AS total_pct
    FROM public.procedures p
    JOIN unit_hourly_cost uhc ON p.tenant_id = uhc.tenant_id
    LEFT JOIN public.procedimento_custos pc ON p.id = pc.procedure_id
    LEFT JOIN proc_material_cost pmc ON p.id = pmc.procedure_id
)
SELECT
    procedure_id,
    tenant_id,
    unit_id,
    procedure_name,
    categoria_especialidade,
    preco_praticado,
    custo_material_especial,
    custo_terceiros_laboratorio,
    tempo_consulta_minutos,
    numero_sessoes_total,
    comissao_profissional_pct,
    taxa_cartao_pct,
    impostos_pct,
    margem_lucro_desejada_pct,
    outras_deducoes_pct,
    custo_hora_clinica,
    custo_material_geral,
    custo_total,
    CASE
        WHEN total_pct < 100.00 THEN ROUND(1.00 / (1.00 - (total_pct / 100.00)), 4)
        ELSE NULL
    END AS markup_divisor,
    CASE
        WHEN total_pct < 100.00 THEN ROUND(custo_total * (1.00 / (1.00 - (total_pct / 100.00))), 2)
        ELSE NULL
    END AS valor_sugerido_cobranca
FROM base_calc;

CREATE OR REPLACE VIEW public.vw_rentabilidade_procedimento
WITH (security_invoker = true)
AS
SELECT
    procedure_id,
    tenant_id,
    unit_id,
    procedure_name,
    preco_praticado,
    custo_total,
    ROUND(COALESCE(preco_praticado, 0.00) - custo_total, 2) AS margem_realizada_valor,
    CASE
        WHEN COALESCE(preco_praticado, 0.00) > 0.00 THEN
            ROUND(((COALESCE(preco_praticado, 0.00) - custo_total) / preco_praticado) * 100.00, 2)
        ELSE 0.00
    END AS margem_realizada_pct
FROM public.vw_precificacao_procedimento;
