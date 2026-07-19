-- Teste de Validação dos Cálculos
BEGIN;

-- 1. Inserir parâmetros de custo da unidade
INSERT INTO public.parametros_custo_unidade (tenant_id, unit_id, numero_cadeiras, horas_funcionamento_mes, horas_ocupadas_mes)
VALUES ('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'b1f7313d-7938-417e-85fc-fa9ded098671', 2, 160.00, 120.00)
ON CONFLICT (unit_id) DO UPDATE 
SET numero_cadeiras = 2, horas_funcionamento_mes = 160.00, horas_ocupadas_mes = 120.00;

-- 2. Inserir despesas fixas de teste
DELETE FROM public.custos_fixos WHERE tenant_id = '92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83' AND unit_id = 'b1f7313d-7938-417e-85fc-fa9ded098671';
INSERT INTO public.custos_fixos (tenant_id, unit_id, nome_custo, valor_mensal, ativo) VALUES
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'Aluguel', 2000.00, true),
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'Salários', 3000.00, true),
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'Pro Labore', 4000.00, true),
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'Internet', 150.00, true),
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'CRO', 50.00, true);

-- 3. Inserir Insumos no catálogo
DELETE FROM public.insumos WHERE tenant_id = '92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83';
INSERT INTO public.insumos (id, tenant_id, nome, categoria, unidade_medida, quantidade_embalagem, quantidade_rendimento, preco_embalagem_atual, estoque_minimo, ativo) VALUES
('10000000-0000-0000-0000-000000000001', '92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'Insumo A', 'Dentística', 'unidade', 1.00, 50.00, 100.00, 10.00, true),
('10000000-0000-0000-0000-000000000002', '92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'Insumo B', 'Dentística', 'unidade', 1.00, 100.00, 80.00, 10.00, true);

-- 4. Inserir BOM do procedimento
DELETE FROM public.procedimento_insumos WHERE tenant_id = '92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83';
INSERT INTO public.procedimento_insumos (tenant_id, procedure_id, insumo_id, quantidade_usada_por_procedimento, numero_consultas_necessarias) VALUES
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1.00, 1.00),
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 2.00, 1.00);

-- 5. Inserir custos e margens da precificação
DELETE FROM public.procedimento_custos WHERE tenant_id = '92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83';
INSERT INTO public.procedimento_custos (tenant_id, procedure_id, custo_material_especial, custo_terceiros_laboratorio, tempo_consulta_minutos, numero_sessoes_total, comissao_profissional_pct, taxa_cartao_pct, impostos_pct, margem_lucro_desejada_pct, outras_deducoes_pct) VALUES
('92b2e94d-cc71-45e0-9ae1-9cd5e6cb5f83', 'a0000000-0000-0000-0000-000000000001', 5.00, 10.00, 30.00, 1.00, 10.00, 5.00, 10.00, 20.00, 5.00);

-- 6. Selecionar resultados da View de Precificação
SELECT 
    procedure_name,
    custo_hora_clinica,
    custo_material_geral,
    custo_total,
    markup_divisor,
    valor_sugerido_cobranca
FROM public.vw_precificacao_procedimento
WHERE procedure_id = 'a0000000-0000-0000-0000-000000000001' AND unit_id = 'b1f7313d-7938-417e-85fc-fa9ded098671';

COMMIT;
