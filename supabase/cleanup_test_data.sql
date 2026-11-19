-- =============================================================================
-- LIMPEZA DOS DADOS DE TESTE (seed) DO ODONTOMANAGER
-- =============================================================================
-- Remove apenas os registros criados por supabase/seed.sql, pelas migrations
-- iniciais e por supabase/qa_validation.sql. Eles são identificados pelos IDs
-- fixos do seed (e, quando necessário, também pelo conteúdo exato), então dados
-- reais cadastrados por você NÃO são afetados.
--
-- COMO USAR (Supabase > SQL Editor):
--   1. Rode a PARTE 1 (somente leitura) e confira o que existe.
--   2. Rode a PARTE 2 inteira de uma vez. Ela termina em ROLLBACK (simulação):
--      leia as mensagens (NOTICE) e a tabela final.
--   3. Se estiver tudo certo, troque o ROLLBACK final por COMMIT e rode de novo.
--
-- PROTEÇÕES:
--   * Pacientes, profissionais e procedimentos de teste só são apagados se NADA
--     real depender deles; caso contrário são mantidos e um aviso é emitido.
--   * As UNIDADES não são apagadas (veja o bloco opcional no fim): apagar uma
--     unidade remove em cascata tudo que pertence a ela.
-- =============================================================================


-- =============================================================================
-- PARTE 1 — PRÉVIA (somente leitura)
-- =============================================================================
SELECT 'units (seed)' AS tabela, count(*) AS qtd FROM public.units
  WHERE id IN ('b1f7313d-7938-417e-85fc-fa9ded098671','b1f7313d-7938-417e-85fc-fa9ded098672')
UNION ALL SELECT 'profiles (seed)', count(*) FROM public.profiles
  WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
               '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004')
UNION ALL SELECT 'procedures (seed)', count(*) FROM public.procedures
  WHERE id IN ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
               'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
               'a0000000-0000-0000-0000-000000000005')
UNION ALL SELECT 'patients (seed)', count(*) FROM public.patients
  WHERE id IN ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
               'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
               'c0000000-0000-0000-0000-000000000005')
UNION ALL SELECT 'appointments (seed)', count(*) FROM public.appointments
  WHERE id IN ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',
               'd0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004',
               'd0000000-0000-0000-0000-000000000005')
UNION ALL SELECT 'clinic_flow (seed)', count(*) FROM public.clinic_flow
  WHERE id IN ('e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002',
               'e0000000-0000-0000-0000-000000000003')
UNION ALL SELECT 'transactions (seed)', count(*) FROM public.transactions
  WHERE id IN ('f0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002',
               'f0000000-0000-0000-0000-000000000003')
UNION ALL SELECT 'insumos (seed/QA, id + nome)', count(*) FROM public.insumos
  WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004',
               '10000000-0000-0000-0000-000000000005')
    AND nome IN ('Luva de Procedimento Látex (Par)','Máscara Descartável Tripla',
                 'Anestésico Mepivacaína 2% (Tubete)','Resina Composta A2 (Seringa)',
                 'Agulha Gengival Descartável','Insumo A','Insumo B')
UNION ALL SELECT 'announcements (seed)', count(*) FROM public.announcements
  WHERE (title, body) IN (
    ('Manutenção de Equipamento', 'O autoclave do Consultório B passará por calibração obrigatória às 14h.'),
    ('Nova Versão ZaiONe', 'O assistente Zai agora avisa via WhatsApp quando o paciente chega na clínica!'),
    ('Férias Dra. Beatriz', 'Lembramos que a Dra. Beatriz estará ausente no período de 01 a 10 de Agosto.'));

-- Quem é dono das unidades de teste? (para você decidir sobre o bloco opcional)
SELECT id, name, tenant_id FROM public.units
WHERE id IN ('b1f7313d-7938-417e-85fc-fa9ded098671','b1f7313d-7938-417e-85fc-fa9ded098672');


-- =============================================================================
-- PARTE 2 — LIMPEZA (termina em ROLLBACK; troque por COMMIT para aplicar)
-- =============================================================================
BEGIN;

-- Função auxiliar (existe só nesta sessão): conta quantas linhas, em QUALQUER
-- tabela com chave estrangeira para p_tabela, ainda apontam para os IDs dados.
CREATE OR REPLACE FUNCTION pg_temp.refs_restantes(p_tabela regclass, p_ids uuid[])
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  n bigint;
  total bigint := 0;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = p_tabela
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = ANY($1)', r.tbl, r.col)
      INTO n USING p_ids;
    IF n > 0 THEN
      RAISE NOTICE '  % ainda tem % linha(s) apontando para %.% (dados reais?)',
        p_tabela, n, r.tbl, r.col;
      total := total + n;
    END IF;
  END LOOP;
  RETURN total;
END;
$$;

-- 1. Financeiro de teste
DELETE FROM public.transactions
WHERE id IN ('f0000000-0000-0000-0000-000000000001',
             'f0000000-0000-0000-0000-000000000002',
             'f0000000-0000-0000-0000-000000000003');

-- 2. Fluxo da clínica e agendamentos de teste
DELETE FROM public.clinic_flow
WHERE id IN ('e0000000-0000-0000-0000-000000000001',
             'e0000000-0000-0000-0000-000000000002',
             'e0000000-0000-0000-0000-000000000003');

DELETE FROM public.appointments
WHERE id IN ('d0000000-0000-0000-0000-000000000001',
             'd0000000-0000-0000-0000-000000000002',
             'd0000000-0000-0000-0000-000000000003',
             'd0000000-0000-0000-0000-000000000004',
             'd0000000-0000-0000-0000-000000000005');

-- 3. Comunicados de exemplo (só os de texto idêntico ao seed; avisos automáticos
--    de estoque baixo e os que você criou ficam)
DELETE FROM public.announcements
WHERE (title, body) IN (
  ('Manutenção de Equipamento', 'O autoclave do Consultório B passará por calibração obrigatória às 14h.'),
  ('Nova Versão ZaiONe', 'O assistente Zai agora avisa via WhatsApp quando o paciente chega na clínica!'),
  ('Férias Dra. Beatriz', 'Lembramos que a Dra. Beatriz estará ausente no período de 01 a 10 de Agosto.'));

-- 4. Dados do qa_validation.sql (custos fixos, parâmetros e precificação de teste)
--    Só apaga quando o conteúdo bate exatamente com o script de QA.
DELETE FROM public.custos_fixos cf
WHERE (cf.tenant_id, cf.unit_id) IN (
  SELECT tenant_id, unit_id
  FROM public.custos_fixos
  WHERE (nome_custo, valor_mensal) IN
        (('Aluguel', 2000.00), ('Salários', 3000.00), ('Pro Labore', 4000.00),
         ('Internet', 150.00), ('CRO', 50.00))
  GROUP BY tenant_id, unit_id
  HAVING count(DISTINCT nome_custo) = 5
)
AND (cf.nome_custo, cf.valor_mensal) IN
    (('Aluguel', 2000.00), ('Salários', 3000.00), ('Pro Labore', 4000.00),
     ('Internet', 150.00), ('CRO', 50.00));

DELETE FROM public.parametros_custo_unidade
WHERE unit_id = 'b1f7313d-7938-417e-85fc-fa9ded098671'
  AND numero_cadeiras = 2
  AND horas_funcionamento_mes = 160.00
  AND horas_ocupadas_mes = 120.00;

DELETE FROM public.procedimento_custos
WHERE procedure_id = 'a0000000-0000-0000-0000-000000000001'
  AND custo_material_especial = 5.00
  AND custo_terceiros_laboratorio = 10.00
  AND tempo_consulta_minutos = 30.00
  AND numero_sessoes_total = 1.00
  AND comissao_profissional_pct = 10.00
  AND taxa_cartao_pct = 5.00
  AND impostos_pct = 10.00
  AND margem_lucro_desejada_pct = 20.00
  AND outras_deducoes_pct = 5.00;

DELETE FROM public.procedimento_insumos
WHERE procedure_id = 'a0000000-0000-0000-0000-000000000001'
  AND insumo_id IN ('10000000-0000-0000-0000-000000000001',
                    '10000000-0000-0000-0000-000000000002');

-- 5. Insumos e estoque de teste (id + nome precisam bater com o seed)
DELETE FROM public.estoque_unidade
WHERE (insumo_id, unit_id, custo_medio) IN (
  ('10000000-0000-0000-0000-000000000001','b1f7313d-7938-417e-85fc-fa9ded098671',1.20),
  ('10000000-0000-0000-0000-000000000002','b1f7313d-7938-417e-85fc-fa9ded098671',0.80),
  ('10000000-0000-0000-0000-000000000003','b1f7313d-7938-417e-85fc-fa9ded098671',3.50),
  ('10000000-0000-0000-0000-000000000004','b1f7313d-7938-417e-85fc-fa9ded098671',45.00),
  ('10000000-0000-0000-0000-000000000005','b1f7313d-7938-417e-85fc-fa9ded098671',0.50),
  ('10000000-0000-0000-0000-000000000001','b1f7313d-7938-417e-85fc-fa9ded098672',1.25),
  ('10000000-0000-0000-0000-000000000002','b1f7313d-7938-417e-85fc-fa9ded098672',0.85));

DO $$
DECLARE
  v_ids uuid[];
  v_restantes bigint;
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM public.insumos
  WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004',
               '10000000-0000-0000-0000-000000000005')
    AND nome IN ('Luva de Procedimento Látex (Par)','Máscara Descartável Tripla',
                 'Anestésico Mepivacaína 2% (Tubete)','Resina Composta A2 (Seringa)',
                 'Agulha Gengival Descartável','Insumo A','Insumo B');

  IF v_ids IS NULL THEN
    RAISE NOTICE 'Insumos de teste: nenhum encontrado.';
    RETURN;
  END IF;

  v_restantes := pg_temp.refs_restantes('public.insumos'::regclass, v_ids);
  IF v_restantes = 0 THEN
    DELETE FROM public.insumos WHERE id = ANY(v_ids);
    RAISE NOTICE 'Insumos de teste removidos: %', cardinality(v_ids);
  ELSE
    RAISE WARNING 'Insumos de teste MANTIDOS: ainda há % registro(s) reais ligados a eles.', v_restantes;
  END IF;
END $$;

-- 6. Pacientes, profissionais e procedimentos de teste (só se nada real depender deles)
DO $$
DECLARE
  v_restantes bigint;
  v_ids uuid[];
BEGIN
  -- Pacientes
  v_ids := ARRAY['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
                 'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
                 'c0000000-0000-0000-0000-000000000005']::uuid[];
  v_restantes := pg_temp.refs_restantes('public.patients'::regclass, v_ids);
  IF v_restantes = 0 THEN
    DELETE FROM public.patients WHERE id = ANY(v_ids);
    RAISE NOTICE 'Pacientes de teste removidos.';
  ELSE
    RAISE WARNING 'Pacientes de teste MANTIDOS: % registro(s) reais dependem deles.', v_restantes;
  END IF;

  -- Procedimentos
  v_ids := ARRAY['a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
                 'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
                 'a0000000-0000-0000-0000-000000000005']::uuid[];
  v_restantes := pg_temp.refs_restantes('public.procedures'::regclass, v_ids);
  IF v_restantes = 0 THEN
    DELETE FROM public.procedures WHERE id = ANY(v_ids);
    RAISE NOTICE 'Procedimentos de teste removidos.';
  ELSE
    RAISE WARNING 'Procedimentos de teste MANTIDOS: % registro(s) reais dependem deles.', v_restantes;
  END IF;

  -- Profissionais (perfis fictícios: Dra. Beatriz, Dr. Thiago, Mariana, Carlos)
  v_ids := ARRAY['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
                 '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004']::uuid[];
  v_restantes := pg_temp.refs_restantes('public.profiles'::regclass, v_ids);
  IF v_restantes = 0 THEN
    DELETE FROM public.profiles WHERE id = ANY(v_ids);
    RAISE NOTICE 'Perfis de teste removidos.';
  ELSE
    RAISE WARNING 'Perfis de teste MANTIDOS: % registro(s) reais dependem deles.', v_restantes;
  END IF;
END $$;

-- 7. Conferência: o que ainda sobrou dos dados de teste (esperado: tudo 0)
SELECT 'patients' AS tabela, count(*) AS restantes FROM public.patients
  WHERE id::text LIKE 'c0000000-0000-0000-0000-00000000000%'
UNION ALL SELECT 'appointments', count(*) FROM public.appointments
  WHERE id::text LIKE 'd0000000-0000-0000-0000-00000000000%'
UNION ALL SELECT 'transactions', count(*) FROM public.transactions
  WHERE id::text LIKE 'f0000000-0000-0000-0000-00000000000%'
UNION ALL SELECT 'procedures', count(*) FROM public.procedures
  WHERE id::text LIKE 'a0000000-0000-0000-0000-00000000000%'
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
  WHERE id::text LIKE '00000000-0000-0000-0000-00000000000%'
UNION ALL SELECT 'insumos', count(*) FROM public.insumos
  WHERE id::text LIKE '10000000-0000-0000-0000-00000000000%';

-- >>> Simulação. Para aplicar de verdade, troque a linha abaixo por COMMIT;
ROLLBACK;


-- =============================================================================
-- OPCIONAL — UNIDADES DE TESTE ("Matriz Centro" e "Filial Jardins")
-- =============================================================================
-- NÃO rode sem conferir. Se a sua "Filial Jardins" é a unidade que você usa de
-- verdade (a PARTE 1 mostra o tenant_id dela), o melhor é só RENOMEÁ-LA em
-- Administração > Unidades, em vez de apagar. Apagar uma unidade remove em
-- cascata agendamentos, financeiro, estoque e custos que pertençam a ela.
--
-- Para apagar só unidades SEM nenhum tenant e SEM dados dependentes:
--
-- BEGIN;
-- DO $$
-- DECLARE v_id uuid;
-- BEGIN
--   FOR v_id IN
--     SELECT id FROM public.units
--     WHERE id IN ('b1f7313d-7938-417e-85fc-fa9ded098671','b1f7313d-7938-417e-85fc-fa9ded098672')
--       AND tenant_id IS NULL
--   LOOP
--     IF pg_temp.refs_restantes('public.units'::regclass, ARRAY[v_id]) = 0 THEN
--       DELETE FROM public.units WHERE id = v_id;
--     END IF;
--   END LOOP;
-- END $$;
-- ROLLBACK; -- troque por COMMIT para aplicar
-- (a função pg_temp.refs_restantes precisa ser criada de novo na mesma sessão)
