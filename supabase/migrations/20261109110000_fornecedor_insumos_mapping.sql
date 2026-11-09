-- =========================================================================
-- MAPEAMENTO DE PRODUTOS DE FORNECEDORES COM INSUMOS DO CATÁLOGO DA CLÍNICA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.fornecedor_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    fornecedor_nome TEXT NOT NULL,
    fornecedor_cnpj TEXT,
    codigo_produto_fornecedor TEXT,
    descricao_fornecedor TEXT NOT NULL,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    fator_conversao NUMERIC(10,2) DEFAULT 1.00,
    modo_entrada TEXT DEFAULT 'unidade' CHECK (modo_entrada IN ('unidade', 'embalagem')),
    unidade_fornecedor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para buscas rápidas ao importar notas fiscais
CREATE INDEX IF NOT EXISTS idx_fornecedor_insumos_tenant_forn 
    ON public.fornecedor_insumos(tenant_id, fornecedor_nome);

CREATE INDEX IF NOT EXISTS idx_fornecedor_insumos_lookup 
    ON public.fornecedor_insumos(tenant_id, fornecedor_nome, codigo_produto_fornecedor);

-- Habilitar RLS
ALTER TABLE public.fornecedor_insumos ENABLE ROW LEVEL SECURITY;

-- Política de isolamento multi-tenant
DROP POLICY IF EXISTS "tenant_isolation_fornecedor_insumos" ON public.fornecedor_insumos;
CREATE POLICY "tenant_isolation_fornecedor_insumos" ON public.fornecedor_insumos
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.users_tenants WHERE user_id = auth.uid()));

-- Função para registrar ou atualizar mapeamento de fornecedor x insumo
CREATE OR REPLACE FUNCTION public.salvar_mapeamento_fornecedor_insumo(
    p_tenant_id UUID,
    p_fornecedor_nome TEXT,
    p_fornecedor_cnpj TEXT,
    p_codigo_produto TEXT,
    p_descricao TEXT,
    p_insumo_id UUID,
    p_fator NUMERIC,
    p_modo_entrada TEXT,
    p_unidade TEXT
) RETURNS VOID AS $$
DECLARE
    v_existente_id UUID;
BEGIN
    -- Busca registro existente por código (se houver código) ou por descrição
    IF p_codigo_produto IS NOT NULL AND p_codigo_produto <> '' THEN
        SELECT id INTO v_existente_id
        FROM public.fornecedor_insumos
        WHERE tenant_id = p_tenant_id 
          AND LOWER(TRIM(fornecedor_nome)) = LOWER(TRIM(p_fornecedor_nome))
          AND codigo_produto_fornecedor = p_codigo_produto
        LIMIT 1;
    END IF;

    IF v_existente_id IS NULL THEN
        SELECT id INTO v_existente_id
        FROM public.fornecedor_insumos
        WHERE tenant_id = p_tenant_id 
          AND LOWER(TRIM(fornecedor_nome)) = LOWER(TRIM(p_fornecedor_nome))
          AND LOWER(TRIM(descricao_fornecedor)) = LOWER(TRIM(p_descricao))
        LIMIT 1;
    END IF;

    IF v_existente_id IS NOT NULL THEN
        UPDATE public.fornecedor_insumos
        SET insumo_id = p_insumo_id,
            fator_conversao = COALESCE(p_fator, 1.00),
            modo_entrada = COALESCE(p_modo_entrada, 'unidade'),
            unidade_fornecedor = p_unidade,
            fornecedor_cnpj = COALESCE(p_fornecedor_cnpj, fornecedor_cnpj),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_existente_id;
    ELSE
        INSERT INTO public.fornecedor_insumos (
            tenant_id, fornecedor_nome, fornecedor_cnpj, codigo_produto_fornecedor,
            descricao_fornecedor, insumo_id, fator_conversao, modo_entrada, unidade_fornecedor
        ) VALUES (
            p_tenant_id, p_fornecedor_nome, p_fornecedor_cnpj, p_codigo_produto,
            p_descricao, p_insumo_id, COALESCE(p_fator, 1.00), COALESCE(p_modo_entrada, 'unidade'), p_unidade
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

