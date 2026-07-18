-- 1. TABELAS DE ESTRUTURA SAAS E INFRAESTRUTURA

-- Tabela de Tenants (Clínicas)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_clinica TEXT NOT NULL,
    plano TEXT DEFAULT 'Básico' CHECK (plano IN ('Básico', 'Pro', 'Multi-unidade')) NOT NULL,
    status_assinatura TEXT DEFAULT 'ativo' CHECK (status_assinatura IN ('ativo', 'inadimplente', 'cancelado')) NOT NULL,
    limite_usuarios INT DEFAULT 3 NOT NULL,
    limite_unidades INT DEFAULT 1 NOT NULL,
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Associações Usuários-Tenants (Multi-tenancy & Multi-unidade)
CREATE TABLE IF NOT EXISTS users_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID, -- Opcional: unidade padrão ou específica
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'clinic_owner', 'dentist', 'receptionist', 'finance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, tenant_id)
);

-- Tabela de Assinaturas (Integração Gateway de Pagamento)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    asaas_customer_id TEXT,
    asaas_subscription_id TEXT,
    plano TEXT NOT NULL,
    status TEXT NOT NULL,
    proxima_cobranca DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Integrações do Tenant (WhatsApp, SMS, etc.)
CREATE TABLE IF NOT EXISTS tenant_integrations (
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE PRIMARY KEY,
    uazapi_instance_id TEXT,
    uazapi_token TEXT,
    whatsapp_conectado BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ADICIONAR COLUNA TENANT_ID ÀS TABELAS EXISTENTES E ADICIONAR CONSTRANGIMENTOS

-- Units
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
-- Patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Procedures
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Clinic Flow
ALTER TABLE clinic_flow ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Transactions (Financeiro)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Insumos (Materials)
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Estoque Unidade
ALTER TABLE estoque_unidade ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Compras Estoque
ALTER TABLE compras_estoque ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Movimentações Estoque
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Custos Fixos
ALTER TABLE custos_fixos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Procedimento Insumos (BOM)
ALTER TABLE procedimento_insumos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
-- Consumo Atendimento
ALTER TABLE consumo_atendimento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 3. REMOVER POLÍTICAS ANTIGAS E CONFIGURAR ROW LEVEL SECURITY (RLS)

-- Habilitar RLS em tabelas SaaS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Remover políticas simples anteriores de acesso total
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON units;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON profiles;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON patients;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON procedures;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON appointments;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON clinic_flow;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON transactions;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON insumos;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON estoque_unidade;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON compras_estoque;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON movimentacoes_estoque;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON custos_fixos;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON procedimento_insumos;
DROP POLICY IF EXISTS "Acesso total a usuários autenticados" ON consumo_atendimento;

-- 4. CRIAR POLÍTICAS DE RLS DE ISOLAMENTO POR TENANT (Usando subqueries em users_tenants)

-- tenants
CREATE POLICY "Users can view their own tenant" ON tenants 
    FOR SELECT TO authenticated 
    USING (id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Clinic owners can update their own tenant" ON tenants 
    FOR UPDATE TO authenticated 
    USING (id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid() AND role = 'clinic_owner'))
    WITH CHECK (id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid() AND role = 'clinic_owner'));

-- users_tenants
CREATE POLICY "Users can view their own tenant memberships" ON users_tenants 
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid());

CREATE POLICY "Clinic owners can manage members of their tenant" ON users_tenants 
    FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid() AND role = 'clinic_owner'))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid() AND role = 'clinic_owner'));

-- subscriptions
CREATE POLICY "Users can view subscription of their tenant" ON subscriptions 
    FOR SELECT TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- tenant_integrations
CREATE POLICY "Users can view integrations of their tenant" ON tenant_integrations 
    FOR SELECT TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Clinic owners can manage integrations of their tenant" ON tenant_integrations 
    FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid() AND role = 'clinic_owner'))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid() AND role = 'clinic_owner'));

-- Helper genérico para tabelas de negócio isoladas por tenant_id
-- Toda tabela de negócio agora é protegida para garantir que o usuário pertence ao tenant_id especificado.

-- units
CREATE POLICY "tenant_isolation_units" ON units FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- profiles
CREATE POLICY "tenant_isolation_profiles" ON profiles FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- patients
CREATE POLICY "tenant_isolation_patients" ON patients FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- procedures
CREATE POLICY "tenant_isolation_procedures" ON procedures FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- appointments
CREATE POLICY "tenant_isolation_appointments" ON appointments FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- clinic_flow
CREATE POLICY "tenant_isolation_clinic_flow" ON clinic_flow FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- transactions
CREATE POLICY "tenant_isolation_transactions" ON transactions FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- insumos
CREATE POLICY "tenant_isolation_insumos" ON insumos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- estoque_unidade
CREATE POLICY "tenant_isolation_estoque_unidade" ON estoque_unidade FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- compras_estoque
CREATE POLICY "tenant_isolation_compras_estoque" ON compras_estoque FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- movimentacoes_estoque
CREATE POLICY "tenant_isolation_movimentacoes_estoque" ON movimentacoes_estoque FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- custos_fixos
CREATE POLICY "tenant_isolation_custos_fixos" ON custos_fixos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- procedimento_insumos
CREATE POLICY "tenant_isolation_procedimento_insumos" ON procedimento_insumos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));

-- consumo_atendimento
CREATE POLICY "tenant_isolation_consumo_atendimento" ON consumo_atendimento FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users_tenants WHERE user_id = auth.uid()));


-- 5. ATUALIZAR TRIGGER DE CRIAÇÃO AUTOMÁTICA DE USUÁRIO (com tratamento SaaS)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_tenant_id UUID;
    v_company_name TEXT;
    v_invited_tenant_id UUID;
    v_role TEXT;
BEGIN
    v_company_name := new.raw_user_meta_data->>'company_name';
    v_invited_tenant_id := (new.raw_user_meta_data->>'invited_tenant_id')::UUID;
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'dentist');

    -- Se for um novo proprietário (clinic_owner) registrando uma clínica
    IF v_role = 'clinic_owner' AND v_company_name IS NOT NULL THEN
        -- Criar o tenant (clínica)
        INSERT INTO public.tenants (nome_clinica, plano, status_assinatura)
        VALUES (v_company_name, 'Pro', 'ativo')
        RETURNING id INTO v_tenant_id;
    ELSIF v_invited_tenant_id IS NOT NULL THEN
        -- Se for um usuário convidado para um tenant existente
        v_tenant_id := v_invited_tenant_id;
    END IF;

    -- Criar o perfil do profissional correspondente
    INSERT INTO public.profiles (id, name, role, email, phone, tenant_id)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', 'Novo Profissional'),
        CASE WHEN v_role = 'clinic_owner' THEN 'admin' ELSE v_role END,
        new.email,
        new.raw_user_meta_data->>'phone',
        v_tenant_id
    );

    -- Criar associação de acesso em users_tenants
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO public.users_tenants (user_id, tenant_id, role)
        VALUES (new.id, v_tenant_id, v_role);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. REESCREVER STORED PROCEDURES DE TRANSAÇÕES DE ESTOQUE PARA COMPATIBILIDADE MULTI-TENANT

-- Processar compra e recalcular custo médio
CREATE OR REPLACE FUNCTION public.processar_compra_estoque(
    p_insumo_id UUID,
    p_unit_id UUID,
    p_fornecedor TEXT,
    p_quantidade NUMERIC,
    p_valor_total NUMERIC,
    p_valor_unitario NUMERIC,
    p_nota_fiscal TEXT,
    p_tenant_id UUID
) RETURNS VOID AS $$
DECLARE
    v_qty_atual NUMERIC := 0;
    v_cost_medio NUMERIC := 0;
    v_novo_custo NUMERIC;
BEGIN
    -- Registrar a compra
    INSERT INTO public.compras_estoque (insumo_id, unit_id, fornecedor, quantidade, valor_total, valor_unitario, nota_fiscal, tenant_id)
    VALUES (p_insumo_id, p_unit_id, p_fornecedor, p_quantidade, p_valor_total, p_valor_unitario, p_nota_fiscal, p_tenant_id);

    -- Obter e travar estoque atual
    SELECT quantidade_atual, custo_medio INTO v_qty_atual, v_cost_medio
    FROM public.estoque_unidade
    WHERE insumo_id = p_insumo_id AND unit_id = p_unit_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Primeira entrada
        INSERT INTO public.estoque_unidade (insumo_id, unit_id, quantidade_atual, custo_medio, tenant_id)
        VALUES (p_insumo_id, p_unit_id, p_quantidade, p_valor_unitario, p_tenant_id);
    ELSE
        -- Recalcular média ponderada
        IF v_qty_atual <= 0 THEN
            v_novo_custo := p_valor_unitario;
        ELSE
            v_novo_custo := ((v_qty_atual * v_cost_medio) + (p_quantidade * p_valor_unitario)) / (v_qty_atual + p_quantidade);
        END IF;

        UPDATE public.estoque_unidade
        SET quantidade_atual = quantidade_atual + p_quantidade,
            custo_medio = v_novo_custo
        WHERE insumo_id = p_insumo_id AND unit_id = p_unit_id AND tenant_id = p_tenant_id;
    END IF;

    -- Registrar movimentação de entrada
    INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, origem, tenant_id)
    VALUES (p_insumo_id, p_unit_id, 'entrada', p_quantidade, 'compra', p_tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Estornar consumos de um atendimento
CREATE OR REPLACE FUNCTION public.estornar_consumo_atendimento(
    p_appointment_id UUID,
    p_unit_id UUID,
    p_tenant_id UUID
) RETURNS VOID AS $$
DECLARE
    v_row RECORD;
BEGIN
    -- Para cada consumo desse appointment
    FOR v_row IN 
        SELECT insumo_id, quantidade_usada 
        FROM public.consumo_atendimento 
        WHERE appointment_id = p_appointment_id AND tenant_id = p_tenant_id
    LOOP
        -- Devolver quantidade ao estoque
        UPDATE public.estoque_unidade
        SET quantidade_atual = quantidade_atual + v_row.quantidade_usada
        WHERE insumo_id = v_row.insumo_id AND unit_id = p_unit_id AND tenant_id = p_tenant_id;

        -- Registrar movimentação de estorno
        INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, origem, tenant_id)
        VALUES (v_row.insumo_id, p_unit_id, 'estorno', v_row.quantidade_usada, 'procedimento', p_tenant_id);
    END LOOP;

    -- Deletar registros de consumo
    DELETE FROM public.consumo_atendimento WHERE appointment_id = p_appointment_id AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Registrar consumo e debitar estoque na mesma transação
CREATE OR REPLACE FUNCTION public.registrar_consumo_atendimento(
    p_appointment_id UUID,
    p_procedimento_id UUID,
    p_unit_id UUID,
    p_tenant_id UUID,
    p_consumos JSONB -- Array de { insumo_id: "...", quantidade_usada: 123 }
) RETURNS VOID AS $$
DECLARE
    v_item JSONB;
    v_insumo_id UUID;
    v_qty_usada NUMERIC;
    v_custo_medio NUMERIC;
BEGIN
    -- Primeiro, garantir que não existam consumos antigos duplicados para este appointment
    PERFORM public.estornar_consumo_atendimento(p_appointment_id, p_unit_id, p_tenant_id);

    -- Loop pelos itens de consumo
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_consumos)
    LOOP
        v_insumo_id := (v_item->>'insumo_id')::UUID;
        v_qty_usada := (v_item->>'quantidade_usada')::NUMERIC;

        -- Obter custo médio do momento (travar linha)
        SELECT custo_medio INTO v_custo_medio
        FROM public.estoque_unidade
        WHERE insumo_id = v_insumo_id AND unit_id = p_unit_id AND tenant_id = p_tenant_id
        FOR UPDATE;

        IF v_custo_medio IS NULL THEN
            v_custo_medio := 0;
        END IF;

        -- Gravar consumo
        INSERT INTO public.consumo_atendimento (appointment_id, procedimento_id, insumo_id, quantidade_usada, custo_unitario_no_momento, custo_total, tenant_id)
        VALUES (p_appointment_id, p_procedimento_id, v_insumo_id, v_qty_usada, v_custo_medio, v_qty_usada * v_custo_medio, p_tenant_id);

        -- Debitar estoque
        INSERT INTO public.estoque_unidade (insumo_id, unit_id, quantidade_atual, custo_medio, tenant_id)
        VALUES (v_insumo_id, p_unit_id, -v_qty_usada, 0, p_tenant_id)
        ON CONFLICT (insumo_id, unit_id) DO UPDATE
        SET quantidade_atual = public.estoque_unidade.quantidade_atual - v_qty_usada;

        -- Gravar movimentação de saída
        INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, origem, tenant_id)
        VALUES (v_insumo_id, p_unit_id, 'saida', v_qty_usada, 'procedimento', p_tenant_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
