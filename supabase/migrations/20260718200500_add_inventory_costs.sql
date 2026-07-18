-- Adicionar procedure_id na tabela appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS procedure_id UUID REFERENCES procedures(id) ON DELETE SET NULL;

-- 1. TABELA DE INSUMOS
CREATE TABLE IF NOT EXISTS insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    unidade_medida TEXT NOT NULL, -- ml, unidade, caixa, mg, etc.
    estoque_minimo NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    categoria TEXT,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE ESTOQUE POR UNIDADE
CREATE TABLE IF NOT EXISTS estoque_unidade (
    insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    quantidade_atual NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    custo_medio NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    PRIMARY KEY (insumo_id, unit_id)
);

-- 3. TABELA DE COMPRAS DE ESTOQUE
CREATE TABLE IF NOT EXISTS compras_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    fornecedor TEXT NOT NULL,
    quantidade NUMERIC(10,2) NOT NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    valor_unitario NUMERIC(10,2) NOT NULL,
    data_compra DATE DEFAULT CURRENT_DATE NOT NULL,
    nota_fiscal TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA DE MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'estorno')),
    quantidade NUMERIC(10,2) NOT NULL,
    origem TEXT NOT NULL CHECK (origem IN ('compra', 'procedimento', 'perda', 'ajuste_manual')),
    data TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 5. TABELA DE CUSTOS FIXOS
CREATE TABLE IF NOT EXISTS custos_fixos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('fixo_mensal', 'variavel', 'recorrente')),
    valor NUMERIC(10,2) NOT NULL,
    competencia TEXT NOT NULL, -- formato MM/YYYY
    unidade_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABELA DE BOM (PROCEDIMENTO INSUMO)
CREATE TABLE IF NOT EXISTS procedimento_insumos (
    procedimento_id UUID REFERENCES procedures(id) ON DELETE CASCADE NOT NULL,
    insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE NOT NULL,
    quantidade_padrao NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (procedimento_id, insumo_id)
);

-- 7. TABELA DE CONSUMO NO ATENDIMENTO
CREATE TABLE IF NOT EXISTS consumo_atendimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
    procedimento_id UUID REFERENCES procedures(id) ON DELETE CASCADE NOT NULL,
    insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE NOT NULL,
    quantidade_usada NUMERIC(10,2) NOT NULL,
    custo_unitario_no_momento NUMERIC(10,2) NOT NULL,
    custo_total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR RLS (Row Level Security)
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimento_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumo_atendimento ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS simples
CREATE POLICY "Acesso total a usuários autenticados" ON insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON estoque_unidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON compras_estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON movimentacoes_estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON custos_fixos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON procedimento_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON consumo_atendimento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================================
-- STORED PROCEDURES (TRANSACTION SAFETY)
-- =========================================================================

-- 1. PROCESSAR COMPRA E RECALCULAR CUSTO MÉDIO
CREATE OR REPLACE FUNCTION public.processar_compra_estoque(
    p_insumo_id UUID,
    p_unit_id UUID,
    p_fornecedor TEXT,
    p_quantidade NUMERIC,
    p_valor_total NUMERIC,
    p_valor_unitario NUMERIC,
    p_nota_fiscal TEXT
) RETURNS VOID AS $$
DECLARE
    v_qty_atual NUMERIC := 0;
    v_cost_medio NUMERIC := 0;
    v_novo_custo NUMERIC;
BEGIN
    -- Registrar a compra
    INSERT INTO public.compras_estoque (insumo_id, unit_id, fornecedor, quantidade, valor_total, valor_unitario, nota_fiscal)
    VALUES (p_insumo_id, p_unit_id, p_fornecedor, p_quantidade, p_valor_total, p_valor_unitario, p_nota_fiscal);

    -- Obter e travar estoque atual
    SELECT quantidade_atual, custo_medio INTO v_qty_atual, v_cost_medio
    FROM public.estoque_unidade
    WHERE insumo_id = p_insumo_id AND unit_id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Primeira entrada
        INSERT INTO public.estoque_unidade (insumo_id, unit_id, quantidade_atual, custo_medio)
        VALUES (p_insumo_id, p_unit_id, p_quantidade, p_valor_unitario);
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
        WHERE insumo_id = p_insumo_id AND unit_id = p_unit_id;
    END IF;

    -- Registrar movimentação de entrada
    INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, origem)
    VALUES (p_insumo_id, p_unit_id, 'entrada', p_quantidade, 'compra');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. ESTORNAR CONSUMOS DE UM ATENDIMENTO
CREATE OR REPLACE FUNCTION public.estornar_consumo_atendimento(
    p_appointment_id UUID,
    p_unit_id UUID
) RETURNS VOID AS $$
DECLARE
    v_row RECORD;
BEGIN
    -- Para cada consumo desse appointment
    FOR v_row IN 
        SELECT insumo_id, quantidade_usada 
        FROM public.consumo_atendimento 
        WHERE appointment_id = p_appointment_id
    LOOP
        -- Devolver quantidade ao estoque
        UPDATE public.estoque_unidade
        SET quantidade_atual = quantidade_atual + v_row.quantidade_usada
        WHERE insumo_id = v_row.insumo_id AND unit_id = p_unit_id;

        -- Registrar movimentação de estorno
        INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, origem)
        VALUES (v_row.insumo_id, p_unit_id, 'estorno', v_row.quantidade_usada, 'procedimento');
    END LOOP;

    -- Deletar registros de consumo
    DELETE FROM public.consumo_atendimento WHERE appointment_id = p_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. REGISTRAR CONSUMO E DEBITAR ESTOQUE (NA MESMA TRANSAÇÃO)
CREATE OR REPLACE FUNCTION public.registrar_consumo_atendimento(
    p_appointment_id UUID,
    p_procedimento_id UUID,
    p_unit_id UUID,
    p_consumos JSONB -- Array de { insumo_id: "...", quantidade_usada: 123 }
) RETURNS VOID AS $$
DECLARE
    v_item JSONB;
    v_insumo_id UUID;
    v_qty_usada NUMERIC;
    v_custo_medio NUMERIC;
BEGIN
    -- Primeiro, garantir que não existam consumos antigos duplicados para este appointment
    PERFORM public.estornar_consumo_atendimento(p_appointment_id, p_unit_id);

    -- Loop pelos itens de consumo
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_consumos)
    LOOP
        v_insumo_id := (v_item->>'insumo_id')::UUID;
        v_qty_usada := (v_item->>'quantidade_usada')::NUMERIC;

        -- Obter custo médio do momento (travar linha)
        SELECT custo_medio INTO v_custo_medio
        FROM public.estoque_unidade
        WHERE insumo_id = v_insumo_id AND unit_id = p_unit_id
        FOR UPDATE;

        IF v_custo_medio IS NULL THEN
            v_custo_medio := 0;
        END IF;

        -- Gravar consumo
        INSERT INTO public.consumo_atendimento (appointment_id, procedimento_id, insumo_id, quantidade_usada, custo_unitario_no_momento, custo_total)
        VALUES (p_appointment_id, p_procedimento_id, v_insumo_id, v_qty_usada, v_custo_medio, v_qty_usada * v_custo_medio);

        -- Debitar estoque
        INSERT INTO public.estoque_unidade (insumo_id, unit_id, quantidade_atual, custo_medio)
        VALUES (v_insumo_id, p_unit_id, -v_qty_usada, 0)
        ON CONFLICT (insumo_id, unit_id) DO UPDATE
        SET quantidade_atual = public.estoque_unidade.quantidade_atual - v_qty_usada;

        -- Gravar movimentação de saída
        INSERT INTO public.movimentacoes_estoque (insumo_id, unit_id, tipo, quantidade, origem)
        VALUES (v_insumo_id, p_unit_id, 'saida', v_qty_usada, 'procedimento');
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- SEED DATA DE TESTE PARA INSUMOS
-- =========================================================================

INSERT INTO insumos (id, nome, unidade_medida, estoque_minimo, categoria, status) VALUES
('10000000-0000-0000-0000-000000000001', 'Luva de Procedimento Látex (Par)', 'unidade', 100, 'Descartáveis', 'ativo'),
('10000000-0000-0000-0000-000000000002', 'Máscara Descartável Tripla', 'unidade', 50, 'Descartáveis', 'ativo'),
('10000000-0000-0000-0000-000000000003', 'Anestésico Mepivacaína 2% (Tubete)', 'unidade', 30, 'Anestésicos', 'ativo'),
('10000000-0000-0000-0000-000000000004', 'Resina Composta A2 (Seringa)', 'unidade', 5, 'Dentística', 'ativo'),
('10000000-0000-0000-0000-000000000005', 'Agulha Gengival Descartável', 'unidade', 40, 'Descartáveis', 'ativo')
ON CONFLICT (id) DO NOTHING;

-- Seed estoque inicial para Matriz Centro
INSERT INTO estoque_unidade (insumo_id, unit_id, quantidade_atual, custo_medio) VALUES
('10000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', 150.00, 1.20),
('10000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', 80.00, 0.80),
('10000000-0000-0000-0000-000000000003', 'b1f7313d-7938-417e-85fc-fa9ded098671', 45.00, 3.50),
('10000000-0000-0000-0000-000000000004', 'b1f7313d-7938-417e-85fc-fa9ded098671', 8.00, 45.00),
('10000000-0000-0000-0000-000000000005', 'b1f7313d-7938-417e-85fc-fa9ded098671', 60.00, 0.50)
ON CONFLICT DO NOTHING;

-- Seed estoque inicial para Filial Jardins
INSERT INTO estoque_unidade (insumo_id, unit_id, quantidade_atual, custo_medio) VALUES
('10000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098672', 120.00, 1.25),
('10000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098672', 60.00, 0.85)
ON CONFLICT DO NOTHING;
