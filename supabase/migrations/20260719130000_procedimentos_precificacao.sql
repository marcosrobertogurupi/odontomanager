-- Migration: Procedimentos e Precificação
-- Created at: 2026-07-19T13:00:00

-- =========================================================================
-- 1. LIMPEZA DE ESTRUTURAS ANTERIORES (DEV CLEANUP)
-- =========================================================================

DROP TRIGGER IF EXISTS tg_atualiza_preco_embalagem ON public.compras_estoque CASCADE;
DROP FUNCTION IF EXISTS public.trfn_atualiza_preco_embalagem() CASCADE;

DROP TRIGGER IF EXISTS tg_baixa_estoque_procedimento ON public.clinic_flow CASCADE;
DROP FUNCTION IF EXISTS public.trfn_baixa_estoque_procedimento() CASCADE;

DROP VIEW IF EXISTS public.vw_rentabilidade_procedimento CASCADE;
DROP VIEW IF EXISTS public.vw_precificacao_procedimento CASCADE;

DROP FUNCTION IF EXISTS public.fn_custo_material_procedimento(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.fn_custo_hora_clinica(UUID) CASCADE;

DROP TABLE IF EXISTS public.procedimento_custos CASCADE;
DROP TABLE IF EXISTS public.procedimento_insumos CASCADE;
DROP TABLE IF EXISTS public.consumo_atendimento CASCADE;
DROP TABLE IF EXISTS public.movimentacoes_estoque CASCADE;
DROP TABLE IF EXISTS public.compras_estoque CASCADE;
DROP TABLE IF EXISTS public.estoque_unidade CASCADE;
DROP TABLE IF EXISTS public.insumos CASCADE;
DROP TABLE IF EXISTS public.parametros_custo_unidade CASCADE;
DROP TABLE IF EXISTS public.custos_fixos CASCADE;

-- =========================================================================
-- 2. ALTERAÇÕES NA TABELA EXISTENTE DE PROCEDIMENTOS
-- =========================================================================

ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS categoria_especialidade TEXT;
ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS preco_praticado NUMERIC(12,2) DEFAULT 0.00;

-- =========================================================================
-- 3. CRIAÇÃO DAS TABELAS DO MÓDULO
-- =========================================================================

-- Tabela de custos fixos por unidade
CREATE TABLE public.custos_fixos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    nome_custo TEXT NOT NULL,
    valor_mensal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de parâmetros operacionais por unidade
CREATE TABLE public.parametros_custo_unidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE UNIQUE,
    numero_cadeiras INTEGER NOT NULL DEFAULT 1,
    horas_funcionamento_mes NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    horas_ocupadas_mes NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Catálogo de insumos/materiais
CREATE TABLE public.insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    categoria TEXT,
    unidade_medida TEXT,
    quantidade_embalagem NUMERIC(10,2) NOT NULL,
    quantidade_rendimento NUMERIC(10,2) NOT NULL,
    preco_embalagem_atual NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    estoque_minimo NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Saldos de estoque por unidade clínica
CREATE TABLE public.estoque_unidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    quantidade_atual NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_unit_insumo UNIQUE (unit_id, insumo_id)
);

-- Registro de compras de estoque
CREATE TABLE public.compras_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    quantidade_comprada NUMERIC(10,2) NOT NULL,
    preco_pago_embalagem NUMERIC(12,2) NOT NULL,
    fornecedor TEXT,
    nota_fiscal TEXT,
    data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Movimentações de estoque
CREATE TABLE public.movimentacoes_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
    quantidade NUMERIC(10,2) NOT NULL,
    motivo TEXT NOT NULL,
    referencia_tipo TEXT,
    referencia_id UUID,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ficha técnica / Receita do Procedimento (BOM)
CREATE TABLE public.procedimento_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    quantidade_usada_por_procedimento NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    numero_consultas_necessarias NUMERIC(6,2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_procedure_insumo UNIQUE (procedure_id, insumo_id)
);

-- Parâmetros de custos e precificação do procedimento
CREATE TABLE public.procedimento_custos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE UNIQUE,
    custo_material_especial NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    custo_terceiros_laboratorio NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tempo_consulta_minutos NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    numero_sessoes_total NUMERIC(6,2) NOT NULL DEFAULT 1.00,
    comissao_profissional_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    taxa_cartao_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    impostos_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    margem_lucro_desejada_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    outras_deducoes_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_total_percentuais CHECK (
        (comissao_profissional_pct + taxa_cartao_pct + impostos_pct + margem_lucro_desejada_pct + outras_deducoes_pct) < 100.0
    )
);

-- =========================================================================
-- 4. CONFIGURAÇÃO DE RLS (ROW LEVEL SECURITY)
-- =========================================================================

ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_custo_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimento_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimento_custos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS de isolamento por tenant_id

CREATE POLICY "tenant_isolation_custos_fixos" ON public.custos_fixos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_parametros_custo_unidade" ON public.parametros_custo_unidade FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_insumos" ON public.insumos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_estoque_unidade" ON public.estoque_unidade FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_compras_estoque" ON public.compras_estoque FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_movimentacoes_estoque" ON public.movimentacoes_estoque FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_procedimento_insumos" ON public.procedimento_insumos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_isolation_procedimento_custos" ON public.procedimento_custos FOR ALL TO authenticated 
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

-- =========================================================================
-- 5. FUNÇÕES DE CÁLCULO
-- =========================================================================

-- Função para calcular o custo da hora clínica da unidade
CREATE OR REPLACE FUNCTION public.fn_custo_hora_clinica(p_unit_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_custos NUMERIC := 0.00;
    v_horas_ocupadas NUMERIC := 0.00;
BEGIN
    -- Soma custos ativos
    SELECT COALESCE(SUM(valor_mensal), 0.00) INTO v_total_custos
    FROM public.custos_fixos
    WHERE unit_id = p_unit_id AND ativo = true;

    -- Busca horas ocupadas
    SELECT COALESCE(horas_ocupadas_mes, 0.00) INTO v_horas_ocupadas
    FROM public.parametros_custo_unidade
    WHERE unit_id = p_unit_id;

    -- Aplica a regra: total_custos / horas_ocupadas se horas > 0
    IF v_horas_ocupadas > 0.00 THEN
        RETURN ROUND(v_total_custos / v_horas_ocupadas, 2);
    ELSE
        RETURN 0.00;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular o custo total de material vinculado ao procedimento (BOM)
CREATE OR REPLACE FUNCTION public.fn_custo_material_procedimento(p_procedure_id UUID)
RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 6. VISÕES (VIEWS)
-- =========================================================================

-- View para consolidar os cálculos de precificação de cada procedimento por unidade
CREATE OR REPLACE VIEW public.vw_precificacao_procedimento AS
SELECT 
    p.id AS procedure_id,
    p.tenant_id,
    u.id AS unit_id,
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
    public.fn_custo_hora_clinica(u.id) AS custo_hora_clinica,
    public.fn_custo_material_procedimento(p.id) AS custo_material_geral,
    -- Custo total do procedimento
    -- formula: ((tempo_minutos / 60) * custo_hora_clinica * sessoes) + material_geral + especial + laboratório
    ROUND(
        (((COALESCE(pc.tempo_consulta_minutos, 0.00) / 60.0) * public.fn_custo_hora_clinica(u.id) * COALESCE(pc.numero_sessoes_total, 1.00))
        + public.fn_custo_material_procedimento(p.id)
        + COALESCE(pc.custo_material_especial, 0.00)
        + COALESCE(pc.custo_terceiros_laboratorio, 0.00)), 2
    ) AS custo_total,
    -- Markup Divisor (Se a soma dos percentuais for < 100)
    CASE 
        WHEN (
            COALESCE(pc.comissao_profissional_pct, 0.00) + 
            COALESCE(pc.taxa_cartao_pct, 0.00) + 
            COALESCE(pc.impostos_pct, 0.00) + 
            COALESCE(pc.margem_lucro_desejada_pct, 0.00) + 
            COALESCE(pc.outras_deducoes_pct, 0.00)
        ) < 100.00 THEN
            ROUND(1.00 / (1.00 - (
                COALESCE(pc.comissao_profissional_pct, 0.00) + 
                COALESCE(pc.taxa_cartao_pct, 0.00) + 
                COALESCE(pc.impostos_pct, 0.00) + 
                COALESCE(pc.margem_lucro_desejada_pct, 0.00) + 
                COALESCE(pc.outras_deducoes_pct, 0.00)
            ) / 100.00), 4)
        ELSE NULL
    END AS markup_divisor,
    -- Valor Sugerido de Cobrança (Custo Total * Markup Divisor)
    CASE 
        WHEN (
            COALESCE(pc.comissao_profissional_pct, 0.00) + 
            COALESCE(pc.taxa_cartao_pct, 0.00) + 
            COALESCE(pc.impostos_pct, 0.00) + 
            COALESCE(pc.margem_lucro_desejada_pct, 0.00) + 
            COALESCE(pc.outras_deducoes_pct, 0.00)
        ) < 100.00 THEN
            ROUND(
                (((COALESCE(pc.tempo_consulta_minutos, 0.00) / 60.0) * public.fn_custo_hora_clinica(u.id) * COALESCE(pc.numero_sessoes_total, 1.00))
                + public.fn_custo_material_procedimento(p.id)
                + COALESCE(pc.custo_material_especial, 0.00)
                + COALESCE(pc.custo_terceiros_laboratorio, 0.00))
                * (1.00 / (1.00 - (
                    COALESCE(pc.comissao_profissional_pct, 0.00) + 
                    COALESCE(pc.taxa_cartao_pct, 0.00) + 
                    COALESCE(pc.impostos_pct, 0.00) + 
                    COALESCE(pc.margem_lucro_desejada_pct, 0.00) + 
                    COALESCE(pc.outras_deducoes_pct, 0.00)
                ) / 100.00)), 2
            )
        ELSE NULL
    END AS valor_sugerido_cobranca
FROM public.procedures p
CROSS JOIN public.units u
LEFT JOIN public.procedimento_custos pc ON p.id = pc.procedure_id
WHERE p.tenant_id = u.tenant_id;

-- View para calcular lucratividade comparando o preço praticado com o custo total
CREATE OR REPLACE VIEW public.vw_rentabilidade_procedimento AS
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

-- =========================================================================
-- 7. TRIGGERS DO BANCO DE DADOS
-- =========================================================================

-- Trigger 1: Atualização automática de preço de insumo e entradas de estoque
CREATE OR REPLACE FUNCTION public.trfn_atualiza_preco_embalagem()
RETURNS TRIGGER AS $$
DECLARE
    v_rendimento NUMERIC;
    v_quantidade_uso NUMERIC;
BEGIN
    -- Busca o rendimento do insumo
    SELECT COALESCE(quantidade_rendimento, 1.00) INTO v_rendimento
    FROM public.insumos
    WHERE id = NEW.insumo_id;

    -- Calcula a quantidade adicionada em unidades de uso
    v_quantidade_uso := NEW.quantidade_comprada * v_rendimento;

    -- 1. Atualizar preco_embalagem_atual na tabela de insumos
    UPDATE public.insumos
    SET preco_embalagem_atual = NEW.preco_pago_embalagem,
        updated_at = now()
    WHERE id = NEW.insumo_id AND tenant_id = NEW.tenant_id;

    -- 2. Criar registro em movimentacoes_estoque (unidade de uso)
    INSERT INTO public.movimentacoes_estoque (
        tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
    ) VALUES (
        NEW.tenant_id, NEW.unit_id, NEW.insumo_id, 'entrada', v_quantidade_uso, 'compra', 'compra', NEW.id, now()
    );

    -- 3. Somar quantidade na tabela estoque_unidade (criando se não existir)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tg_atualiza_preco_embalagem
  AFTER INSERT ON public.compras_estoque
  FOR EACH ROW EXECUTE FUNCTION public.trfn_atualiza_preco_embalagem();


-- Trigger 2: Baixa automática de estoque ao concluir consultas (Checked Out) e reversões
CREATE OR REPLACE FUNCTION public.trfn_baixa_estoque_procedimento()
RETURNS TRIGGER AS $$
DECLARE
    v_appointment RECORD;
    v_insumo RECORD;
    v_estoque_atual NUMERIC;
    v_estoque_minimo NUMERIC;
    v_insumo_nome TEXT;
BEGIN
    -- CENÁRIO A: Atendimento concluído (checked_out)
    IF (TG_OP = 'INSERT' AND NEW.status = 'checked_out') OR 
       (TG_OP = 'UPDATE' AND NEW.status = 'checked_out' AND OLD.status IS DISTINCT FROM 'checked_out') THEN
       
        -- Detalhes do agendamento
        SELECT tenant_id, unit_id, procedure_id
        INTO v_appointment
        FROM public.appointments
        WHERE id = NEW.appointment_id;

        IF v_appointment.procedure_id IS NOT NULL THEN
            -- Se já foi processada alguma saída para este appointment, ignora para evitar duplicidade
            IF NOT EXISTS (
                SELECT 1 
                FROM public.movimentacoes_estoque 
                WHERE referencia_tipo = 'appointment' AND referencia_id = NEW.appointment_id
            ) THEN
                -- Loop pelos insumos da ficha técnica (BOM)
                FOR v_insumo IN 
                    SELECT insumo_id, quantidade_usada_por_procedimento
                    FROM public.procedimento_insumos
                    WHERE procedure_id = v_appointment.procedure_id
                LOOP
                    -- 1. Decrementar da tabela estoque_unidade
                    INSERT INTO public.estoque_unidade (
                        tenant_id, unit_id, insumo_id, quantidade_atual, updated_at
                    ) VALUES (
                        v_appointment.tenant_id, v_appointment.unit_id, v_insumo.insumo_id, -v_insumo.quantidade_usada_por_procedimento, now()
                    )
                    ON CONFLICT (unit_id, insumo_id) DO UPDATE
                    SET quantidade_atual = public.estoque_unidade.quantidade_atual - v_insumo.quantidade_usada_por_procedimento,
                        updated_at = now()
                    RETURNING quantidade_atual INTO v_estoque_atual;

                    -- 2. Criar registro em movimentacoes_estoque
                    INSERT INTO public.movimentacoes_estoque (
                        tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
                    ) VALUES (
                        v_appointment.tenant_id, v_appointment.unit_id, v_insumo.insumo_id, 'saida', v_insumo.quantidade_usada_por_procedimento, 'uso_procedimento', 'appointment', NEW.appointment_id, now()
                    );

                    -- 3. Gerar alerta caso o estoque atual fique abaixo do estoque mínimo
                    SELECT nome, estoque_minimo INTO v_insumo_nome, v_estoque_minimo
                    FROM public.insumos
                    WHERE id = v_insumo.insumo_id;

                    IF v_estoque_atual < COALESCE(v_estoque_minimo, 0.00) THEN
                        INSERT INTO public.announcements (
                            tenant_id, unit_id, tag, tag_type, title, body, created_at
                        ) VALUES (
                            v_appointment.tenant_id,
                            v_appointment.unit_id,
                            'Estoque Baixo',
                            'urgent',
                            'Alerta de Estoque: ' || v_insumo_nome,
                            'O estoque de "' || v_insumo_nome || '" está em ' || v_estoque_atual || ', abaixo do mínimo ideal (' || v_estoque_minimo || '). Realize uma nova compra.',
                            now()
                        );
                    END IF;
                END LOOP;
            END IF;
        END IF;

    -- CENÁRIO B: Reversão de status (estorno de checked_out para outro status)
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'checked_out' AND NEW.status IS DISTINCT FROM 'checked_out') THEN
        
        -- Detalhes do agendamento
        SELECT tenant_id, unit_id, procedure_id
        INTO v_appointment
        FROM public.appointments
        WHERE id = NEW.appointment_id;

        IF v_appointment.procedure_id IS NOT NULL THEN
            -- Se há registros de movimentação para este appointment, faz o estorno
            FOR v_insumo IN 
                SELECT insumo_id, quantidade
                FROM public.movimentacoes_estoque 
                WHERE referencia_tipo = 'appointment' AND referencia_id = NEW.appointment_id AND tipo = 'saida'
            LOOP
                -- 1. Devolver saldo ao estoque
                UPDATE public.estoque_unidade
                SET quantidade_atual = quantidade_atual + v_insumo.quantidade,
                    updated_at = now()
                WHERE unit_id = v_appointment.unit_id AND insumo_id = v_insumo.insumo_id;

                -- 2. Registrar movimentação de estorno/ajuste
                INSERT INTO public.movimentacoes_estoque (
                    tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
                ) VALUES (
                    v_appointment.tenant_id, v_appointment.unit_id, v_insumo.insumo_id, 'entrada', v_insumo.quantidade, 'ajuste_manual', 'appointment_reverted', NEW.appointment_id, now()
                );
            END LOOP;

            -- Remove os movimentos antigos de saída para limpar o histórico
            DELETE FROM public.movimentacoes_estoque 
            WHERE referencia_tipo = 'appointment' AND referencia_id = NEW.appointment_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tg_baixa_estoque_procedimento
  AFTER INSERT OR UPDATE ON public.clinic_flow
  FOR EACH ROW EXECUTE FUNCTION public.trfn_baixa_estoque_procedimento();

-- =========================================================================
-- 8. COMPATIBILIDADE RPC COM FRONTEND EXISTENTE
-- =========================================================================

-- Recriar RPC processar_compra_estoque
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
BEGIN
    -- O insert em compras_estoque dispara automaticamente o trigger tg_atualiza_preco_embalagem,
    -- que executa todos os cálculos e atualiza tabelas de estoque e logs.
    INSERT INTO public.compras_estoque (
        tenant_id, unit_id, insumo_id, quantidade_comprada, preco_pago_embalagem, fornecedor, nota_fiscal, data_compra, created_at
    ) VALUES (
        p_tenant_id, p_unit_id, p_insumo_id, p_quantidade, p_valor_unitario, p_fornecedor, p_nota_fiscal, CURRENT_DATE, now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Estornar consumo de atendimento manual (mantido para compatibilidade caso a tela force manualmente)
CREATE OR REPLACE FUNCTION public.estornar_consumo_atendimento(
    p_appointment_id UUID,
    p_unit_id UUID,
    p_tenant_id UUID
) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Registrar consumo de atendimento manual
CREATE OR REPLACE FUNCTION public.registrar_consumo_atendimento(
    p_appointment_id UUID,
    p_procedimento_id UUID,
    p_unit_id UUID,
    p_tenant_id UUID,
    p_consumos JSONB
) RETURNS VOID AS $$
DECLARE
    v_item JSONB;
    v_insumo_id UUID;
    v_qty_usada NUMERIC;
BEGIN
    -- Primeiro, desfaz qualquer consumo anterior para esta consulta
    PERFORM public.estornar_consumo_atendimento(p_appointment_id, p_unit_id, p_tenant_id);

    -- Registra os novos consumos passados pelo formulário manual
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_consumos)
    LOOP
        v_insumo_id := (v_item->>'insumo_id')::UUID;
        v_qty_usada := (v_item->>'quantidade_usada')::NUMERIC;

        IF v_qty_usada > 0 THEN
            -- Decrementa o estoque
            INSERT INTO public.estoque_unidade (insumo_id, unit_id, quantidade_atual, tenant_id, updated_at)
            VALUES (v_insumo_id, p_unit_id, -v_qty_usada, p_tenant_id, now())
            ON CONFLICT (unit_id, insumo_id) DO UPDATE
            SET quantidade_atual = public.estoque_unidade.quantidade_atual - v_qty_usada,
                updated_at = now();

            -- Registra a movimentação de saída
            INSERT INTO public.movimentacoes_estoque (
                tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
            ) VALUES (
                p_tenant_id, p_unit_id, v_insumo_id, 'saida', v_qty_usada, 'uso_procedimento', 'appointment', p_appointment_id, now()
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
