-- Migration para permitir exclusão segura de insumos e zeramento/reinício do estoque

-- 1. RPC para deletar um único insumo com limpeza completa de histórico
CREATE OR REPLACE FUNCTION public.deletar_insumo_completo(
    p_insumo_id UUID,
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar se o insumo pertence ao tenant
    IF NOT EXISTS (SELECT 1 FROM public.insumos WHERE id = p_insumo_id AND tenant_id = p_tenant_id) THEN
        RAISE EXCEPTION 'Insumo não encontrado ou sem permissão para esta clínica.';
    END IF;

    -- Deletar registros vinculados
    DELETE FROM public.procedimento_insumos WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.movimentacoes_estoque WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.compras_estoque WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    DELETE FROM public.estoque_unidade WHERE insumo_id = p_insumo_id AND tenant_id = p_tenant_id;
    
    -- Deletar o insumo principal
    DELETE FROM public.insumos WHERE id = p_insumo_id AND tenant_id = p_tenant_id;
END;
$$;

-- 2. RPC para zerar saldos ou limpar todo o estoque do tenant para começar do zero
CREATE OR REPLACE FUNCTION public.zerar_estoque_completo(
    p_tenant_id UUID,
    p_mode TEXT -- 'zerar_saldos' ou 'apagar_tudo'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_mode = 'apagar_tudo' THEN
        -- Limpa todos os insumos e históricos da clínica para começar do zero
        DELETE FROM public.procedimento_insumos WHERE tenant_id = p_tenant_id;
        DELETE FROM public.movimentacoes_estoque WHERE tenant_id = p_tenant_id;
        DELETE FROM public.compras_estoque WHERE tenant_id = p_tenant_id;
        DELETE FROM public.estoque_unidade WHERE tenant_id = p_tenant_id;
        DELETE FROM public.insumos WHERE tenant_id = p_tenant_id;
    ELSIF p_mode = 'zerar_saldos' THEN
        -- Apenas zera as quantidades em estoque de todos os materiais
        UPDATE public.estoque_unidade 
        SET quantidade_atual = 0.00, updated_at = now()
        WHERE tenant_id = p_tenant_id;

        -- Registra a movimentação de ajuste
        INSERT INTO public.movimentacoes_estoque (tenant_id, unit_id, insumo_id, tipo, quantidade, motivo, created_at)
        SELECT eu.tenant_id, eu.unit_id, eu.insumo_id, 'ajuste', 0, 'Estoque zerado manualmente pelo usuário', now()
        FROM public.estoque_unidade eu
        WHERE eu.tenant_id = p_tenant_id;
    ELSE
        RAISE EXCEPTION 'Modo inválido. Use ''zerar_saldos'' ou ''apagar_tudo''.';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deletar_insumo_completo TO authenticated;
GRANT EXECUTE ON FUNCTION public.zerar_estoque_completo TO authenticated;
