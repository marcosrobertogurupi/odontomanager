-- =============================================================================
-- Migration: Optimize Queries, Indexes, Views, and RLS Policies
-- Based on Supabase Postgres Best Practices:
--   1. schema-foreign-key-indexes & query-composite-indexes
--   2. query-partial-indexes & advanced-full-text-search (pg_trgm)
--   3. security-rls-performance ((select auth.uid()) + STABLE helpers)
--   4. data-n-plus-one (eliminate per-row scalar functions in views)
-- =============================================================================

-- 1. EXTENSÕES PARA BUSCA TEXTUAL RÁPIDA (ILIKE '%termo%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 2. FUNÇÕES AUXILIARES DE RLS OTIMIZADAS (STABLE + search_path seguro)
-- =============================================================================
-- Funções marcadas como STABLE permitem que o planejador do Postgres faça cache
-- do resultado por statement (InitPlan) em vez de reexecutar linha a linha.

CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id
  FROM public.users_tenants
  WHERE user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_owner(user_uuid uuid, tenant_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users_tenants
    WHERE user_id = user_uuid
      AND tenant_id = tenant_uuid
      AND role = 'clinic_owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users_tenants
    WHERE user_id = user_uuid
      AND role = 'super_admin'
  );
$$;

-- =============================================================================
-- 3. ÍNDICES DE CHAVE ESTRANGEIRA, COMPOSTOS E PARCIAIS
-- =============================================================================

-- 3.1. users_tenants (Crítico para RLS em todas as tabelas)
CREATE INDEX IF NOT EXISTS idx_users_tenants_user_tenant
  ON public.users_tenants (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_tenants_tenant_id
  ON public.users_tenants (tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_tenants_user_role
  ON public.users_tenants (user_id, role);

-- 3.2. units
CREATE INDEX IF NOT EXISTS idx_units_tenant_id
  ON public.units (tenant_id);

-- 3.3. profiles (Filtros frequentes por tenant_id + role e ordenação por name)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role_name
  ON public.profiles (tenant_id, role, name);

CREATE INDEX IF NOT EXISTS idx_profiles_unit_id
  ON public.profiles (unit_id)
  WHERE unit_id IS NOT NULL;

-- 3.4. patients (Ordenação por nome e busca textual ILIKE no módulo Pacientes, Papelaria e Zai)
CREATE INDEX IF NOT EXISTS idx_patients_tenant_name
  ON public.patients (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
  ON public.patients USING gin (name gin_trgm_ops);

-- 3.5. procedures (Listagem ordenada por nome dentro do tenant)
CREATE INDEX IF NOT EXISTS idx_procedures_tenant_name
  ON public.procedures (tenant_id, name);

-- 3.6. appointments (Consultas por agenda diária da unidade, profissional e joins)
-- Regra query-composite-indexes: colunas de igualdade primeiro (tenant_id, unit_id), range por último (start_time)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_unit_start
  ON public.appointments (tenant_id, unit_id, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_professional_start
  ON public.appointments (professional_id, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
  ON public.appointments (patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_procedure_id
  ON public.appointments (procedure_id)
  WHERE procedure_id IS NOT NULL;

-- 3.7. clinic_flow (Fila de recepção ordenada por checked_in_at e filtro por status)
CREATE INDEX IF NOT EXISTS idx_clinic_flow_tenant_checked_in
  ON public.clinic_flow (tenant_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_flow_active_waiting
  ON public.clinic_flow (tenant_id, status, appointment_id)
  WHERE status IN ('checked_in', 'waiting', 'in_consultation');

-- 3.8. transactions (Fluxo de caixa por unidade ordenado por data e covering index para Dashboard)
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_unit_date
  ON public.transactions (tenant_id, unit_id, date DESC)
  INCLUDE (type, amount);

CREATE INDEX IF NOT EXISTS idx_transactions_patient_id
  ON public.transactions (patient_id)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_appointment_id
  ON public.transactions (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- 3.9. custos_fixos & parametros_custo_unidade
CREATE INDEX IF NOT EXISTS idx_custos_fixos_tenant_unit_nome
  ON public.custos_fixos (tenant_id, unit_id, nome_custo);

-- Índice parcial para cálculo rápido de hora clínica (apenas custos ativos)
CREATE INDEX IF NOT EXISTS idx_custos_fixos_unit_ativo
  ON public.custos_fixos (unit_id)
  INCLUDE (valor_mensal)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_parametros_custo_tenant_unit
  ON public.parametros_custo_unidade (tenant_id, unit_id);

-- 3.10. insumos & unidades_medida
CREATE INDEX IF NOT EXISTS idx_insumos_tenant_nome
  ON public.insumos (tenant_id, nome);

CREATE INDEX IF NOT EXISTS idx_unidades_medida_tenant_nome
  ON public.unidades_medida (tenant_id, nome);

-- 3.11. estoque_unidade, compras_estoque & movimentacoes_estoque
CREATE INDEX IF NOT EXISTS idx_estoque_unidade_tenant_unit
  ON public.estoque_unidade (tenant_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_estoque_unidade_insumo_id
  ON public.estoque_unidade (insumo_id);

CREATE INDEX IF NOT EXISTS idx_compras_estoque_tenant_unit_data
  ON public.compras_estoque (tenant_id, unit_id, data_compra DESC);

CREATE INDEX IF NOT EXISTS idx_compras_estoque_insumo_id
  ON public.compras_estoque (insumo_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_tenant_unit_created
  ON public.movimentacoes_estoque (tenant_id, unit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_insumo_id
  ON public.movimentacoes_estoque (insumo_id);

-- Índice composto para estorno e verificação de baixa por agendamento (trigger tg_baixa_estoque_procedimento)
CREATE INDEX IF NOT EXISTS idx_movimentacoes_referencia
  ON public.movimentacoes_estoque (referencia_tipo, referencia_id)
  WHERE referencia_id IS NOT NULL;

-- 3.12. procedimento_insumos (BOM) & procedimento_custos
CREATE INDEX IF NOT EXISTS idx_procedimento_insumos_tenant_proc
  ON public.procedimento_insumos (tenant_id, procedure_id);

CREATE INDEX IF NOT EXISTS idx_procedimento_insumos_insumo_id
  ON public.procedimento_insumos (insumo_id);

CREATE INDEX IF NOT EXISTS idx_procedimento_custos_tenant_proc
  ON public.procedimento_custos (tenant_id, procedure_id);

-- 3.13. announcements (Avisos ordenados por data e verificação de duplicidade por título)
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_unit_created
  ON public.announcements (tenant_id, unit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant_title
  ON public.announcements (tenant_id, title);

-- 3.14. zai_chats & zai_messages (Substituir buscas separadas por índices compostos de ordenação)
CREATE INDEX IF NOT EXISTS idx_zai_chats_tenant_updated
  ON public.zai_chats (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_zai_messages_chat_created
  ON public.zai_messages (chat_id, created_at ASC);

-- 3.15. generated_documents (Histórico por paciente ordenado por data)
CREATE INDEX IF NOT EXISTS idx_generated_documents_patient_created
  ON public.generated_documents (patient_id, created_at DESC);

-- =============================================================================
-- 4. OTIMIZAÇÃO DE RLS POLICIES (Usando (SELECT auth.uid()) e get_user_tenant_ids())
-- =============================================================================

-- 4.1. tenants
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "Clinic owners can update their own tenant" ON public.tenants;
CREATE POLICY "Clinic owners can update their own tenant" ON public.tenants
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_clinic_owner((SELECT auth.uid()), id)))
  WITH CHECK ((SELECT public.is_clinic_owner((SELECT auth.uid()), id)));

DROP POLICY IF EXISTS "Super admins can view all tenants" ON public.tenants;
CREATE POLICY "Super admins can view all tenants" ON public.tenants
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "Super admins can manage all tenants" ON public.tenants;
CREATE POLICY "Super admins can manage all tenants" ON public.tenants
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_super_admin((SELECT auth.uid()))));

-- 4.2. users_tenants
DROP POLICY IF EXISTS "Users can view their own tenant memberships" ON public.users_tenants;
CREATE POLICY "Users can view their own tenant memberships" ON public.users_tenants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clinic owners can manage members of their tenant" ON public.users_tenants;
CREATE POLICY "Clinic owners can manage members of their tenant" ON public.users_tenants
  FOR ALL TO authenticated
  USING ((SELECT public.is_clinic_owner((SELECT auth.uid()), tenant_id)))
  WITH CHECK ((SELECT public.is_clinic_owner((SELECT auth.uid()), tenant_id)));

DROP POLICY IF EXISTS "Super admins can view all memberships" ON public.users_tenants;
CREATE POLICY "Super admins can view all memberships" ON public.users_tenants
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "Super admins can manage all memberships" ON public.users_tenants;
CREATE POLICY "Super admins can manage all memberships" ON public.users_tenants
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_super_admin((SELECT auth.uid()))));

-- 4.3. subscriptions & tenant_integrations
DROP POLICY IF EXISTS "Users can view subscription of their tenant" ON public.subscriptions;
CREATE POLICY "Users can view subscription of their tenant" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can view integrations of their tenant" ON public.tenant_integrations;
CREATE POLICY "Users can view integrations of their tenant" ON public.tenant_integrations
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "Clinic owners can manage integrations of their tenant" ON public.tenant_integrations;
CREATE POLICY "Clinic owners can manage integrations of their tenant" ON public.tenant_integrations
  FOR ALL TO authenticated
  USING ((SELECT public.is_clinic_owner((SELECT auth.uid()), tenant_id)))
  WITH CHECK ((SELECT public.is_clinic_owner((SELECT auth.uid()), tenant_id)));

-- 4.4. Tabelas Operacionais Multi-Tenant
DROP POLICY IF EXISTS "tenant_isolation_units" ON public.units;
CREATE POLICY "tenant_isolation_units" ON public.units
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_profiles" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (id = (SELECT auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (id = (SELECT auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_patients" ON public.patients;
CREATE POLICY "tenant_isolation_patients" ON public.patients
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_procedures" ON public.procedures;
CREATE POLICY "tenant_isolation_procedures" ON public.procedures
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_appointments" ON public.appointments;
CREATE POLICY "tenant_isolation_appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_clinic_flow" ON public.clinic_flow;
CREATE POLICY "tenant_isolation_clinic_flow" ON public.clinic_flow
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_transactions" ON public.transactions;
CREATE POLICY "tenant_isolation_transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_custos_fixos" ON public.custos_fixos;
CREATE POLICY "tenant_isolation_custos_fixos" ON public.custos_fixos
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_parametros_custo_unidade" ON public.parametros_custo_unidade;
CREATE POLICY "tenant_isolation_parametros_custo_unidade" ON public.parametros_custo_unidade
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_insumos" ON public.insumos;
CREATE POLICY "tenant_isolation_insumos" ON public.insumos
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_estoque_unidade" ON public.estoque_unidade;
CREATE POLICY "tenant_isolation_estoque_unidade" ON public.estoque_unidade
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_compras_estoque" ON public.compras_estoque;
CREATE POLICY "tenant_isolation_compras_estoque" ON public.compras_estoque
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_movimentacoes_estoque" ON public.movimentacoes_estoque;
CREATE POLICY "tenant_isolation_movimentacoes_estoque" ON public.movimentacoes_estoque
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_procedimento_insumos" ON public.procedimento_insumos;
CREATE POLICY "tenant_isolation_procedimento_insumos" ON public.procedimento_insumos
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_procedimento_custos" ON public.procedimento_custos;
CREATE POLICY "tenant_isolation_procedimento_custos" ON public.procedimento_custos
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_unidades_medida" ON public.unidades_medida;
CREATE POLICY "tenant_isolation_unidades_medida" ON public.unidades_medida
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_announcements" ON public.announcements;
CREATE POLICY "tenant_isolation_announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_zai_chats" ON public.zai_chats;
CREATE POLICY "tenant_isolation_zai_chats" ON public.zai_chats
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_isolation_zai_messages" ON public.zai_messages;
CREATE POLICY "tenant_isolation_zai_messages" ON public.zai_messages
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_generated_docs" ON public.generated_documents;
CREATE POLICY "tenant_generated_docs" ON public.generated_documents
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- =============================================================================
-- 5. OTIMIZAÇÃO DE FUNÇÕES E VIEWS DE PRECIFICAÇÃO (Eliminação de N+1 por linha)
-- =============================================================================

-- Marcar funções de cálculo como STABLE e com search_path seguro
CREATE OR REPLACE FUNCTION public.fn_custo_hora_clinica(p_unit_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total_custos NUMERIC := 0.00;
    v_horas_ocupadas NUMERIC := 0.00;
BEGIN
    SELECT COALESCE(SUM(valor_mensal), 0.00) INTO v_total_custos
    FROM public.custos_fixos
    WHERE unit_id = p_unit_id AND ativo = true;

    SELECT COALESCE(horas_ocupadas_mes, 0.00) INTO v_horas_ocupadas
    FROM public.parametros_custo_unidade
    WHERE unit_id = p_unit_id;

    IF v_horas_ocupadas > 0.00 THEN
        RETURN ROUND(v_total_custos / v_horas_ocupadas, 2);
    ELSE
        RETURN 0.00;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_custo_material_procedimento(p_procedure_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_custo_material NUMERIC := 0.00;
BEGIN
    SELECT COALESCE(SUM(
        CASE
            WHEN i.quantidade_rendimento > 0 THEN
                (i.preco_embalagem_atual / i.quantidade_rendimento * pi.quantidade_usada_por_procedimento) * pi.numero_consultas_necessarias
            ELSE 0.00
        END
    ), 0.00) INTO v_custo_material
    FROM public.procedimento_insumos pi
    JOIN public.insumos i ON pi.insumo_id = i.id
    WHERE pi.procedure_id = p_procedure_id;

    RETURN ROUND(v_custo_material, 2);
END;
$$;

-- Reescrever vw_precificacao_procedimento usando agregações em JOIN (Hash/Merge Join)
-- em vez de chamar fn_custo_hora_clinica e fn_custo_material_procedimento 6x por linha!
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
        p.preco_praticado,
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

