import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  Clock, 
  Sparkles, 
  FileText, 
  Layers, 
  HelpCircle, 
  Sliders, 
  Building2, 
  Printer, 
  ArrowRight, 
  Check, 
  Info,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './PricingSection.module.css';
import { 
  PLANILHA_PROCEDIMENTOS_TEMPLATES, 
  PLANILHA_CUSTOS_FIXOS_PADRAO, 
  type PricingTemplate,
  type PricingTemplateMaterial 
} from '../lib/pricingTemplates';

interface PricingSectionProps {
  selectedUnit: string;
}

interface MaterialRow {
  id?: string;
  insumo_id?: string;
  nome: string;
  quantidade_embalagem: number;
  quantidade_rendimento: number;
  preco_embalagem_atual: number;
  quantidade_usada_por_procedimento: number;
  numero_consultas_necessarias: number;
}

export default function PricingSection({ selectedUnit }: PricingSectionProps) {
  const { activeTenant, role } = useTenant();
  const isAdmin = role === 'clinic_owner' || role === 'admin' || role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'calculadora' | 'custos_clinica' | 'tabela_precos'>('calculadora');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Dados de Custos Fixos e Parâmetros
  const [custosFixos, setCustosFixos] = useState<any[]>([]);
  const [paramId, setParamId] = useState<string | null>(null);
  const [numeroCadeiras, setNumeroCadeiras] = useState(1);
  const [horasFuncionamentoMes, setHorasFuncionamentoMes] = useState(40);
  const [horasOcupadasMes, setHorasOcupadasMes] = useState(32);

  // Mini calculadora de horas da planilha
  const [diasSemanaCalc, setDiasSemanaCalc] = useState(5);
  const [horasDiaCalc, setHorasDiaCalc] = useState(10);
  const [semanasMesCalc, setSemanasMesCalc] = useState(4);
  const [ocupacaoPctCalc, setOcupacaoPctCalc] = useState(80);

  // 2. Procedimentos e Insumos Cadastrados
  const [procedures, setProcedures] = useState<any[]>([]);
  const [insumosCadastrados, setInsumosCadastrados] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');

  // 3. Ficha Técnica e Calculadora do Procedimento Atual
  const [procedureName, setProcedureName] = useState<string>('');
  const [procedureCategory, setProcedureCategory] = useState<string>('Geral');
  const [procedurePricePracticed, setProcedurePricePracticed] = useState<number>(0);

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [tempoConsultaMinutos, setTempoConsultaMinutos] = useState<number>(60);
  const [numeroSessoesTotal, setNumeroSessoesTotal] = useState<number>(1);
  const [custoMaterialEspecial, setCustoMaterialEspecial] = useState<number>(0);
  const [custoTerceirosLaboratorio, setCustoTerceirosLaboratorio] = useState<number>(0);
  const [custoHoraManual, setCustoHoraManual] = useState<number | null>(null);

  // Percentuais de Dedução e Margem
  const [comissaoProfissionalPct, setComissaoProfissionalPct] = useState<number>(0);
  const [taxaCartaoPct, setTaxaCartaoPct] = useState<number>(5.48);
  const [impostosPct, setImpostosPct] = useState<number>(0);
  const [margemLucroDesejadaPct, setMargemLucroDesejadaPct] = useState<number>(40);
  const [outrasDeducoesPct, setOutrasDeducoesPct] = useState<number>(0);

  // Modais
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isNewProcModalOpen, setIsNewProcModalOpen] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcCategory, setNewProcCategory] = useState('Geral');

  // Novo custo fixo form
  const [novoCustoNome, setNovoCustoNome] = useState('');
  const [novoCustoValor, setNovoCustoValor] = useState('');

  // =========================================================================
  // CARREGAMENTO INICIAL
  // =========================================================================

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const loadAllData = async () => {
    if (!activeTenant || !selectedUnit) return;
    setLoading(true);
    try {
      // 1. Custos Fixos
      const { data: cFixos, error: errFixos } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .order('nome_custo');
      if (errFixos) throw errFixos;
      setCustosFixos(cFixos || []);

      // 2. Parâmetros da Unidade
      const { data: pUnid, error: errPUnid } = await supabase
        .from('parametros_custo_unidade')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .maybeSingle();

      if (pUnid) {
        setParamId(pUnid.id);
        setNumeroCadeiras(pUnid.numero_cadeiras || 1);
        setHorasFuncionamentoMes(pUnid.horas_funcionamento_mes || 40);
        setHorasOcupadasMes(pUnid.horas_ocupadas_mes || 32);
      } else {
        setParamId(null);
      }

      // 3. Insumos da Clínica
      const { data: ins, error: errIns } = await supabase
        .from('insumos')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('nome');
      if (errIns) throw errIns;
      setInsumosCadastrados(ins || []);

      // 4. Procedimentos da Clínica
      const { data: procs, error: errProcs } = await supabase
        .from('procedures')
        .select(`
          id, 
          name, 
          price, 
          preco_praticado, 
          categoria_especialidade,
          procedimento_custos (*)
        `)
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (errProcs) throw errProcs;
      setProcedures(procs || []);

      // Se nenhum procedimento selecionado, seleciona o primeiro ou carrega modelo padrão
      if (!selectedProcedureId && procs && procs.length > 0) {
        selectProcedureForPricing(procs[0].id, procs);
      } else if (!selectedProcedureId && (!procs || procs.length === 0)) {
        // Carrega modelo de exemplo da planilha (Endodontia)
        loadTemplateIntoState(PLANILHA_PROCEDIMENTOS_TEMPLATES[0]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de precificação:', err);
      showFeedback('Erro ao carregar dados: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeTenant, selectedUnit]);

  // =========================================================================
  // CÁLCULO DE CUSTO HORA CLÍNICA
  // =========================================================================

  const totalCustosFixosMensal = useMemo(() => {
    return custosFixos
      .filter(c => c.ativo !== false)
      .reduce((acc, curr) => acc + Number(curr.valor_mensal || 0), 0);
  }, [custosFixos]);

  const custoHoraClinicaCalculado = useMemo(() => {
    if (custoHoraManual !== null) return custoHoraManual;
    if (horasOcupadasMes > 0 && totalCustosFixosMensal > 0) {
      return totalCustosFixosMensal / horasOcupadasMes;
    }
    // Valor padrão didático da planilha caso ainda não tenha custos configurados
    return 210.32125;
  }, [totalCustosFixosMensal, horasOcupadasMes, custoHoraManual]);

  // =========================================================================
  // SELEÇÃO E CARREGAMENTO DO PROCEDIMENTO
  // =========================================================================

  const selectProcedureForPricing = async (procId: string, customList?: any[]) => {
    setSelectedProcedureId(procId);
    const procList = customList || procedures;
    const proc = procList.find(p => p.id === procId);
    if (!proc) return;

    setProcedureName(proc.name || '');
    setProcedureCategory(proc.categoria_especialidade || 'Geral');
    setProcedurePricePracticed(Number(proc.preco_praticado ?? proc.price ?? 0));

    // Carrega insumos do procedimento (BOM)
    try {
      const { data: boms, error: bError } = await supabase
        .from('procedimento_insumos')
        .select(`
          id,
          insumo_id,
          quantidade_usada_por_procedimento,
          numero_consultas_necessarias,
          insumo:insumos (
            id,
            nome,
            quantidade_embalagem,
            quantidade_rendimento,
            preco_embalagem_atual
          )
        `)
        .eq('procedure_id', procId);

      if (bError) throw bError;

      if (boms && boms.length > 0) {
        const mappedRows: MaterialRow[] = boms.map((b: any) => {
          const insumoObj = Array.isArray(b.insumo) ? b.insumo[0] : b.insumo;
          return {
            id: b.id,
            insumo_id: b.insumo_id,
            nome: insumoObj?.nome || 'Insumo',
            quantidade_embalagem: Number(insumoObj?.quantidade_embalagem || 1),
            quantidade_rendimento: Number(insumoObj?.quantidade_rendimento || 1),
            preco_embalagem_atual: Number(insumoObj?.preco_embalagem_atual || 0),
            quantidade_usada_por_procedimento: Number(b.quantidade_usada_por_procedimento || 1),
            numero_consultas_necessarias: Number(b.numero_consultas_necessarias || 1)
          };
        });
        setMaterials(mappedRows);
      } else {
        // Se ainda não tiver ficha cadastrada, inicia com linhas vazias ou template
        setMaterials([]);
      }

      // Carrega parâmetros de custos
      const pCost = proc.procedimento_custos && proc.procedimento_custos[0] ? proc.procedimento_custos[0] : null;
      if (pCost) {
        setTempoConsultaMinutos(Number(pCost.tempo_consulta_minutos || 60));
        setNumeroSessoesTotal(Number(pCost.numero_sessoes_total || 1));
        setCustoMaterialEspecial(Number(pCost.custo_material_especial || 0));
        setCustoTerceirosLaboratorio(Number(pCost.custo_terceiros_laboratorio || 0));
        setComissaoProfissionalPct(Number(pCost.comissao_profissional_pct || 0));
        setTaxaCartaoPct(Number(pCost.taxa_cartao_pct ?? 5.48));
        setImpostosPct(Number(pCost.impostos_pct || 0));
        setMargemLucroDesejadaPct(Number(pCost.margem_lucro_desejada_pct ?? 40));
        setOutrasDeducoesPct(Number(pCost.outras_deducoes_pct || 0));
      } else {
        setTempoConsultaMinutos(60);
        setNumeroSessoesTotal(1);
        setCustoMaterialEspecial(0);
        setCustoTerceirosLaboratorio(0);
        setComissaoProfissionalPct(0);
        setTaxaCartaoPct(5.48);
        setImpostosPct(0);
        setMargemLucroDesejadaPct(40);
        setOutrasDeducoesPct(0);
      }
    } catch (err: any) {
      console.error('Erro ao carregar detalhes do procedimento:', err);
    }
  };

  const loadTemplateIntoState = (tmpl: PricingTemplate) => {
    setSelectedProcedureId('');
    setProcedureName(tmpl.nome);
    setProcedureCategory(tmpl.categoria);
    setTempoConsultaMinutos(tmpl.tempo_consulta_minutos);
    setNumeroSessoesTotal(tmpl.numero_sessoes_total);
    setCustoMaterialEspecial(tmpl.custo_material_especial);
    setCustoTerceirosLaboratorio(tmpl.custo_terceiros_laboratorio);
    setComissaoProfissionalPct(tmpl.comissao_profissional_pct);
    setTaxaCartaoPct(tmpl.taxa_cartao_pct);
    setImpostosPct(tmpl.impostos_pct);
    setMargemLucroDesejadaPct(tmpl.margem_lucro_desejada_pct);
    setOutrasDeducoesPct(tmpl.outras_deducoes_pct);

    const rows: MaterialRow[] = tmpl.materiais.map(m => ({
      nome: m.nome,
      quantidade_embalagem: m.quantidade_embalagem,
      quantidade_rendimento: m.quantidade_rendimento,
      preco_embalagem_atual: m.preco_embalagem_atual,
      quantidade_usada_por_procedimento: m.quantidade_usada_por_procedimento,
      numero_consultas_necessarias: m.numero_consultas_necessarias
    }));
    setMaterials(rows);
    setIsTemplateModalOpen(false);
    showFeedback(`Modelo "${tmpl.nome}" carregado com sucesso da Planilha!`, 'success');
  };

  // =========================================================================
  // FÓRMULAS MATEMÁTICAS EXATAS DA PLANILHA
  // =========================================================================

  // 1. Custo Material Geral (Soma de todos os insumos)
  const custoMaterialGeral = useMemo(() => {
    return materials.reduce((acc, row) => {
      const preco = Number(row.preco_embalagem_atual || 0);
      const rend = Number(row.quantidade_rendimento || 1);
      const doseCost = rend > 0 ? (preco / rend) * Number(row.quantidade_usada_por_procedimento || 0) : 0;
      const totalRow = doseCost * Number(row.numero_consultas_necessarias || 1);
      return acc + totalRow;
    }, 0);
  }, [materials]);

  // 2. Custo da Hora Clínica por Consulta
  const custoHoraPorConsulta = useMemo(() => {
    return (tempoConsultaMinutos / 60) * custoHoraClinicaCalculado;
  }, [tempoConsultaMinutos, custoHoraClinicaCalculado]);

  // 3. Custo Total de Hora Clínica no Procedimento
  const custoHoraTotalProcedimento = useMemo(() => {
    return custoHoraPorConsulta * numeroSessoesTotal;
  }, [custoHoraPorConsulta, numeroSessoesTotal]);

  // 4. Custo Direto Total
  const custoTotalProcedimento = useMemo(() => {
    return custoHoraTotalProcedimento + custoMaterialGeral + custoMaterialEspecial + custoTerceirosLaboratorio;
  }, [custoHoraTotalProcedimento, custoMaterialGeral, custoMaterialEspecial, custoTerceirosLaboratorio]);

  // 5. Soma das deduções e margem
  const totalDeducoesPct = useMemo(() => {
    return comissaoProfissionalPct + taxaCartaoPct + impostosPct + margemLucroDesejadaPct + outrasDeducoesPct;
  }, [comissaoProfissionalPct, taxaCartaoPct, impostosPct, margemLucroDesejadaPct, outrasDeducoesPct]);

  // Deduções sem a margem de lucro (para break-even e lucro líquido real)
  const deducoesSemMargemPct = useMemo(() => {
    return comissaoProfissionalPct + taxaCartaoPct + impostosPct + outrasDeducoesPct;
  }, [comissaoProfissionalPct, taxaCartaoPct, impostosPct, outrasDeducoesPct]);

  // 6. Markup Divisor: 1 / (1 - (Soma% / 100))
  const markupDivisor = useMemo(() => {
    if (totalDeducoesPct >= 100) return null;
    return 1 / (1 - (totalDeducoesPct / 100));
  }, [totalDeducoesPct]);

  // 7. VALOR A COBRAR (Preço Sugerido de Venda)
  const valorSugeridoCobranca = useMemo(() => {
    if (!markupDivisor || custoTotalProcedimento <= 0) return 0;
    return custoTotalProcedimento * markupDivisor;
  }, [custoTotalProcedimento, markupDivisor]);

  // 8. Ponto de Equilíbrio (Break-Even)
  const precoMinimoEquilibrio = useMemo(() => {
    if (deducoesSemMargemPct >= 100) return 0;
    return custoTotalProcedimento / (1 - (deducoesSemMargemPct / 100));
  }, [custoTotalProcedimento, deducoesSemMargemPct]);

  // 9. Lucro Líquido Real e Margem Realizada com o Preço Praticado
  const lucroLiquidoReal = useMemo(() => {
    if (procedurePricePracticed <= 0) return 0;
    const deducoesValor = (procedurePricePracticed * deducoesSemMargemPct) / 100;
    return procedurePricePracticed - deducoesValor - custoTotalProcedimento;
  }, [procedurePricePracticed, deducoesSemMargemPct, custoTotalProcedimento]);

  const margemRealizadaPct = useMemo(() => {
    if (procedurePricePracticed <= 0) return 0;
    return (lucroLiquidoReal / procedurePricePracticed) * 100;
  }, [lucroLiquidoReal, procedurePricePracticed]);

  // =========================================================================
  // MANIPULAÇÃO DA FICHA TÉCNICA (BOM)
  // =========================================================================

  const handleAddMaterialRow = () => {
    setMaterials(prev => [
      ...prev,
      {
        nome: '',
        quantidade_embalagem: 1,
        quantidade_rendimento: 1,
        preco_embalagem_atual: 0,
        quantidade_usada_por_procedimento: 1,
        numero_consultas_necessarias: 1
      }
    ]);
  };

  const handleRemoveMaterialRow = (idx: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMaterialChange = (idx: number, field: keyof MaterialRow, val: any) => {
    setMaterials(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };

      // Se o usuário selecionou um insumo existente do banco
      if (field === 'insumo_id') {
        const found = insumosCadastrados.find(i => i.id === val);
        if (found) {
          copy[idx].nome = found.nome;
          copy[idx].quantidade_embalagem = Number(found.quantidade_embalagem || 1);
          copy[idx].quantidade_rendimento = Number(found.quantidade_rendimento || 1);
          copy[idx].preco_embalagem_atual = Number(found.preco_embalagem_atual || 0);
        }
      }
      return copy;
    });
  };

  // =========================================================================
  // SALVAR PRECIFICAÇÃO E PROCEDIMENTO
  // =========================================================================

  const handleSavePricing = async () => {
    if (!activeTenant) return;
    if (!procedureName.trim()) {
      showFeedback('Por favor, defina o nome do procedimento.', 'error');
      return;
    }
    if (totalDeducoesPct >= 100) {
      showFeedback('A soma das deduções e margem não pode ser igual ou superior a 100%!', 'error');
      return;
    }

    setSaving(true);
    try {
      let procId = selectedProcedureId;

      // Se for um novo procedimento (sem ID ainda)
      if (!procId) {
        const { data: newProc, error: errNew } = await supabase
          .from('procedures')
          .insert([{
            tenant_id: activeTenant.id,
            name: procedureName,
            categoria_especialidade: procedureCategory,
            price: procedurePricePracticed || valorSugeridoCobranca || 0,
            preco_praticado: procedurePricePracticed || valorSugeridoCobranca || 0
          }])
          .select()
          .single();

        if (errNew) throw errNew;
        procId = newProc.id;
        setSelectedProcedureId(procId);
      } else {
        // Atualiza procedimento existente
        const { error: errUp } = await supabase
          .from('procedures')
          .update({
            name: procedureName,
            categoria_especialidade: procedureCategory,
            preco_praticado: procedurePricePracticed,
            price: procedurePricePracticed
          })
          .eq('id', procId);

        if (errUp) throw errUp;
      }

      // Upsert dos parâmetros de custos do procedimento
      const { error: errCost } = await supabase
        .from('procedimento_custos')
        .upsert({
          tenant_id: activeTenant.id,
          procedure_id: procId,
          custo_material_especial: custoMaterialEspecial,
          custo_terceiros_laboratorio: custoTerceirosLaboratorio,
          tempo_consulta_minutos: tempoConsultaMinutos,
          numero_sessoes_total: numeroSessoesTotal,
          comissao_profissional_pct: comissaoProfissionalPct,
          taxa_cartao_pct: taxaCartaoPct,
          impostos_pct: impostosPct,
          margem_lucro_desejada_pct: margemLucroDesejadaPct,
          outras_deducoes_pct: outrasDeducoesPct,
          updated_at: new Date().toISOString()
        }, { onConflict: 'procedure_id' });

      if (errCost) throw errCost;

      // Sincronizar Ficha Técnica (BOM)
      // Remove BOM anterior
      await supabase
        .from('procedimento_insumos')
        .delete()
        .eq('procedure_id', procId);

      // Garante que cada insumo exista na tabela insumos
      const bomsToInsert = [];
      for (const item of materials) {
        if (!item.nome.trim()) continue;
        let insumoId = item.insumo_id;

        if (!insumoId) {
          // Procura se já existe insumo com mesmo nome
          const existing = insumosCadastrados.find(
            i => i.nome.trim().toLowerCase() === item.nome.trim().toLowerCase()
          );

          if (existing) {
            insumoId = existing.id;
          } else {
            // Cria o insumo no banco
            const { data: newIns, error: errInsCreate } = await supabase
              .from('insumos')
              .insert([{
                tenant_id: activeTenant.id,
                nome: item.nome,
                categoria: procedureCategory || 'Geral',
                quantidade_embalagem: item.quantidade_embalagem || 1,
                quantidade_rendimento: item.quantidade_rendimento || 1,
                preco_embalagem_atual: item.preco_embalagem_atual || 0,
                ativo: true
              }])
              .select()
              .single();

            if (!errInsCreate && newIns) {
              insumoId = newIns.id;
              setInsumosCadastrados(prev => [...prev, newIns]);
            }
          }
        }

        if (insumoId) {
          bomsToInsert.push({
            tenant_id: activeTenant.id,
            procedure_id: procId,
            insumo_id: insumoId,
            quantidade_usada_por_procedimento: item.quantidade_usada_por_procedimento,
            numero_consultas_necessarias: item.numero_consultas_necessarias
          });
        }
      }

      if (bomsToInsert.length > 0) {
        const { error: errBomInsert } = await supabase
          .from('procedimento_insumos')
          .insert(bomsToInsert);
        if (errBomInsert) throw errBomInsert;
      }

      showFeedback('Precificação e Ficha Técnica salvas com sucesso no sistema!', 'success');
      loadAllData();
    } catch (err: any) {
      console.error('Erro ao salvar precificação:', err);
      showFeedback('Erro ao salvar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // SALVAR CUSTOS FIXOS E PARÂMETROS DA CLÍNICA
  // =========================================================================

  const handleSaveClinicaParams = async () => {
    if (!activeTenant || !selectedUnit) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: activeTenant.id,
        unit_id: selectedUnit,
        numero_cadeiras: numeroCadeiras,
        horas_funcionamento_mes: horasFuncionamentoMes,
        horas_ocupadas_mes: horasOcupadasMes,
        updated_at: new Date().toISOString()
      };

      if (paramId) {
        await supabase.from('parametros_custo_unidade').update(payload).eq('id', paramId);
      } else {
        const { data: newP } = await supabase.from('parametros_custo_unidade').insert([payload]).select().single();
        if (newP) setParamId(newP.id);
      }

      showFeedback('Parâmetros operacionais e horas da clínica atualizados!', 'success');
    } catch (err: any) {
      showFeedback('Erro ao salvar parâmetros: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCarregarCustosPadrao = async () => {
    if (!activeTenant || !selectedUnit) return;
    if (!window.confirm('Deseja carregar a lista de custos fixos padrão da Planilha da Dra. Maria Paula?')) return;

    setSaving(true);
    try {
      const rows = PLANILHA_CUSTOS_FIXOS_PADRAO.map(c => ({
        tenant_id: activeTenant.id,
        unit_id: selectedUnit,
        nome_custo: c.nome_custo,
        valor_mensal: c.valor_mensal,
        ativo: true
      }));

      const { error } = await supabase.from('custos_fixos').insert(rows);
      if (error) throw error;

      showFeedback('Custos fixos da Planilha carregados com sucesso!', 'success');
      loadAllData();
    } catch (err: any) {
      showFeedback('Erro ao carregar custos padrão: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNovoCusto = async () => {
    if (!activeTenant || !selectedUnit || !novoCustoNome.trim()) return;
    try {
      const { error } = await supabase.from('custos_fixos').insert([{
        tenant_id: activeTenant.id,
        unit_id: selectedUnit,
        nome_custo: novoCustoNome.trim(),
        valor_mensal: parseFloat(novoCustoValor) || 0,
        ativo: true
      }]);
      if (error) throw error;
      setNovoCustoNome('');
      setNovoCustoValor('');
      loadAllData();
      showFeedback('Custo fixo adicionado!', 'success');
    } catch (err: any) {
      showFeedback('Erro ao adicionar custo: ' + err.message, 'error');
    }
  };

  const handleDeleteCusto = async (id: string) => {
    try {
      await supabase.from('custos_fixos').delete().eq('id', id);
      setCustosFixos(prev => prev.filter(c => c.id !== id));
      showFeedback('Custo fixo removido.');
    } catch (err: any) {
      showFeedback('Erro ao excluir custo: ' + err.message, 'error');
    }
  };

  const handleToggleCusto = async (id: string, current: boolean) => {
    try {
      await supabase.from('custos_fixos').update({ ativo: !current }).eq('id', id);
      setCustosFixos(prev => prev.map(c => c.id === id ? { ...c, ativo: !current } : c));
    } catch (err: any) {
      showFeedback('Erro ao alterar status: ' + err.message, 'error');
    }
  };

  // =========================================================================
  // RELATÓRIO IMPRESSO / PDF
  // =========================================================================

  const handlePrint = () => {
    window.print();
  };

  // Filtragem de procedimentos para a tabela geral
  const filteredProcedures = useMemo(() => {
    if (selectedCategory === 'Todos') return procedures;
    return procedures.filter(p => p.categoria_especialidade === selectedCategory);
  }, [procedures, selectedCategory]);

  const categoriesList = useMemo(() => {
    const setCats = new Set<string>(['Todos']);
    procedures.forEach(p => {
      if (p.categoria_especialidade) setCats.add(p.categoria_especialidade);
    });
    return Array.from(setCats);
  }, [procedures]);

  return (
    <div className={styles.container}>
      {/* CABEÇALHO */}
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.title}>
            <Calculator size={28} color="hsl(var(--primary))" />
            Precificação Odontológica
          </h1>
          <p className={styles.subtitle}>
            Metodologia científica e formação de preço por Markup Divisor conforme a planilha da Dra. Maria Paula Ferreira.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={styles.badgeDraMariaPaula}>
            <Sparkles size={14} />
            Planilha Oficial Integrada
          </span>
          <button 
            onClick={() => setIsTemplateModalOpen(true)}
            className={styles.secondaryBtn}
            title="Carregar procedimentos da planilha"
          >
            <Layers size={16} />
            Modelos da Planilha ({PLANILHA_PROCEDIMENTOS_TEMPLATES.length})
          </button>
          <button 
            onClick={handlePrint}
            className={styles.secondaryBtn}
            title="Imprimir Ficha Técnica"
          >
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-xs)',
          backgroundColor: feedbackMsg.type === 'success' ? 'hsl(var(--success-light))' : 'hsl(var(--danger-light))',
          color: feedbackMsg.type === 'success' ? 'hsl(var(--success))' : 'hsl(var(--danger))',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {feedbackMsg.text}
        </div>
      )}

      {/* TABS DE NAVEGAÇÃO */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('calculadora')}
          className={`${styles.tabButton} ${activeTab === 'calculadora' ? styles.activeTab : ''}`}
        >
          <Calculator size={16} />
          Calculadora & Ficha Técnica
        </button>
        <button
          onClick={() => setActiveTab('custos_clinica')}
          className={`${styles.tabButton} ${activeTab === 'custos_clinica' ? styles.activeTab : ''}`}
        >
          <Building2 size={16} />
          Custos Fixos & Hora Clínica
        </button>
        <button
          onClick={() => setActiveTab('tabela_precos')}
          className={`${styles.tabButton} ${activeTab === 'tabela_precos' ? styles.activeTab : ''}`}
        >
          <FileText size={16} />
          Tabela Geral de Preços ({procedures.length})
        </button>
      </div>

      {/* =========================================================================
          ABA 1: CALCULADORA & FICHA TÉCNICA DO PROCEDIMENTO
          ========================================================================= */}
      {activeTab === 'calculadora' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SELETOR DE PROCEDIMENTO */}
          <div className={styles.card} style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                  Procedimento:
                </span>
                <select
                  className={styles.select}
                  style={{ flex: 1, fontWeight: 600 }}
                  value={selectedProcedureId}
                  onChange={(e) => {
                    if (e.target.value === 'novo') {
                      setIsNewProcModalOpen(true);
                    } else if (e.target.value) {
                      selectProcedureForPricing(e.target.value);
                    }
                  }}
                >
                  <option value="">Selecione um procedimento cadastrado...</option>
                  {procedures.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.categoria_especialidade ? `(${p.categoria_especialidade})` : ''} - Praticado: R$ {Number(p.preco_praticado ?? p.price ?? 0).toFixed(2)}
                    </option>
                  ))}
                  <option value="novo">+ Criar Novo Procedimento...</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setIsTemplateModalOpen(true)}
                  className={styles.secondaryBtn}
                  style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' }}
                >
                  <Sparkles size={15} />
                  Carregar Exemplo da Planilha
                </button>
              </div>
            </div>
          </div>

          {/* LAYOUT EM 2 COLUNAS: FICHA TÉCNICA (ESQUERDA) VS CALCULADORA/MARKUP (DIREITA) */}
          <div className={styles.pricingSplitLayout}>
            
            {/* COLUNA ESQUERDA: FICHA TÉCNICA (BOM) */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <Layers size={18} color="hsl(var(--primary))" />
                  <span>Ficha Técnica de Materiais do Procedimento</span>
                </div>
                <span className={styles.badgeTemplate}>
                  {materials.length} {materials.length === 1 ? 'material' : 'materiais'}
                </span>
              </div>

              <div className={styles.explanationBox}>
                <strong>Como funciona o cálculo de cada insumo:</strong><br />
                Valor por Consulta = (Preço da Embalagem ÷ Rendimento da Embalagem) × Quantidade Usada por Consulta.<br />
                Valor Total = Valor por Consulta × Número de Consultas Necessárias.
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.materialsTable}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '200px' }}>Insumo / Material</th>
                      <th style={{ width: '95px', minWidth: '90px', textAlign: 'right' }} title="Quantas doses ou consultas rende a embalagem inteira">Rendimento</th>
                      <th style={{ width: '110px', minWidth: '105px', textAlign: 'right' }} title="Preço total pago na compra da embalagem">Preço Emb. (R$)</th>
                      <th style={{ width: '95px', minWidth: '90px', textAlign: 'right' }} title="Quantidade gasta em cada consulta">Qtd. Uso</th>
                      <th style={{ width: '95px', minWidth: '90px', textAlign: 'right' }} title="Custo calculado por consulta">Custo/Cons.</th>
                      <th style={{ width: '80px', minWidth: '75px', textAlign: 'right' }} title="Número de consultas necessárias do procedimento">Sessões</th>
                      <th style={{ width: '105px', minWidth: '100px', textAlign: 'right' }} title="Custo total deste insumo no tratamento">Total (R$)</th>
                      <th style={{ width: '45px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--text-muted))' }}>
                          Nenhum insumo adicionado ainda. Clique no botão abaixo para adicionar ou carregue um modelo da planilha.
                        </td>
                      </tr>
                    ) : (
                      materials.map((m, idx) => {
                        const preco = Number(m.preco_embalagem_atual || 0);
                        const rend = Number(m.quantidade_rendimento || 1);
                        const uso = Number(m.quantidade_usada_por_procedimento || 0);
                        const consultas = Number(m.numero_consultas_necessarias || 1);
                        const vlrConsulta = rend > 0 ? (preco / rend) * uso : 0;
                        const vlrTotal = vlrConsulta * consultas;

                        return (
                          <tr key={idx}>
                            <td>
                              <input 
                                type="text"
                                className={styles.tableInput}
                                placeholder="Nome do material..."
                                value={m.nome}
                                onChange={(e) => handleMaterialChange(idx, 'nome', e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                step="any"
                                min="0.001"
                                className={`${styles.tableInput} ${styles.tableInputNumber}`}
                                title="Quantas doses / usos rende a embalagem"
                                placeholder="1"
                                value={m.quantidade_rendimento}
                                onChange={(e) => handleMaterialChange(idx, 'quantidade_rendimento', parseFloat(e.target.value) || 1)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                step="0.01"
                                min="0"
                                className={`${styles.tableInput} ${styles.tableInputNumber}`}
                                title="Preço total pago na embalagem"
                                placeholder="0.00"
                                value={m.preco_embalagem_atual}
                                onChange={(e) => handleMaterialChange(idx, 'preco_embalagem_atual', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                step="any"
                                min="0"
                                className={`${styles.tableInput} ${styles.tableInputNumber}`}
                                title="Quantidade gasta em cada consulta"
                                placeholder="1"
                                value={m.quantidade_usada_por_procedimento}
                                onChange={(e) => handleMaterialChange(idx, 'quantidade_usada_por_procedimento', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>
                              R$ {vlrConsulta.toFixed(2)}
                            </td>
                            <td>
                              <input 
                                type="number"
                                step="1"
                                min="1"
                                className={`${styles.tableInput} ${styles.tableInputNumber}`}
                                title="Número de consultas necessárias do procedimento"
                                placeholder="1"
                                value={m.numero_consultas_necessarias}
                                onChange={(e) => handleMaterialChange(idx, 'numero_consultas_necessarias', parseFloat(e.target.value) || 1)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'hsl(var(--text-main))', whiteSpace: 'nowrap' }}>
                              R$ {vlrTotal.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                onClick={() => handleRemoveMaterialRow(idx)}
                                className={styles.dangerBtn}
                                title="Remover item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '12px' }}>
                <button onClick={handleAddMaterialRow} className={styles.secondaryBtn}>
                  <Plus size={15} />
                  Adicionar Material
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>Total Materiais Gerais:</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'hsl(var(--primary))' }}>
                    R$ {custoMaterialGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: CALCULADORA DE PROCEDIMENTO & MARKUP DIVISOR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* BLOCO DE VARIÁVEIS OPERACIONAIS */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Clock size={18} color="hsl(var(--secondary))" />
                    <span>Tempo Clínico & Custos Adicionais</span>
                  </div>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tempo por Consulta (minutos)</label>
                    <input 
                      type="number" 
                      className={styles.input}
                      value={tempoConsultaMinutos}
                      onChange={(e) => setTempoConsultaMinutos(Math.max(1, parseFloat(e.target.value) || 1))}
                    />
                    <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                      Ex: 60 min = 1h (planilha)
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nº Total de Sessões</label>
                    <input 
                      type="number" 
                      className={styles.input}
                      value={numeroSessoesTotal}
                      onChange={(e) => setNumeroSessoesTotal(Math.max(1, parseFloat(e.target.value) || 1))}
                    />
                    <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                      Quantas consultas dura o tratamento
                    </span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Material Especial Avulso (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className={styles.input}
                      value={custoMaterialEspecial}
                      onChange={(e) => setCustoMaterialEspecial(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Terceiros / Laboratório (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className={styles.input}
                      value={custoTerceirosLaboratorio}
                      onChange={(e) => setCustoTerceirosLaboratorio(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                <div style={{ background: 'hsl(var(--bg-app))', padding: '12px 14px', borderRadius: 'var(--radius-xs)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span>Custo Hora Clínica da Unidade:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>R$ {custoHoraClinicaCalculado.toFixed(2)} / hora</strong>
                    <button 
                      onClick={() => setActiveTab('custos_clinica')} 
                      className={styles.secondaryBtn} 
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      Ajustar
                    </button>
                  </div>
                </div>
              </div>

              {/* BLOCO DE DEDUÇÕES E MARKUP */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Sliders size={18} color="hsl(var(--primary))" />
                    <span>Deduções sobre Venda e Margem</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: totalDeducoesPct >= 100 ? 'hsl(var(--danger))' : 'hsl(var(--text-muted))' }}>
                    Soma: {totalDeducoesPct.toFixed(2)}%
                  </span>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Margem de Lucro Desejada (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className={styles.input}
                      style={{ fontWeight: 700, borderColor: 'hsl(var(--success))' }}
                      value={margemLucroDesejadaPct}
                      onChange={(e) => setMargemLucroDesejadaPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Taxa de Cartões (%)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className={styles.input}
                      value={taxaCartaoPct}
                      onChange={(e) => setTaxaCartaoPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Comissão Profissional (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className={styles.input}
                      value={comissaoProfissionalPct}
                      onChange={(e) => setComissaoProfissionalPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Impostos / NF (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className={styles.input}
                      value={impostosPct}
                      onChange={(e) => setImpostosPct(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                {/* PAINEL DE RESULTADOS EXATOS DA PLANILHA */}
                <div className={styles.resultBreakdownList}>
                  <div className={styles.resultRow}>
                    <span className={styles.resultRowLabel}>Custo Materiais Gerais:</span>
                    <span className={styles.resultRowValue}>R$ {custoMaterialGeral.toFixed(2)}</span>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.resultRowLabel}>Custo Hora Clínica Procedimento:</span>
                    <span className={styles.resultRowValue}>R$ {custoHoraTotalProcedimento.toFixed(2)}</span>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.resultRowLabel}>Laboratório + Material Especial:</span>
                    <span className={styles.resultRowValue}>R$ {(custoTerceirosLaboratorio + custoMaterialEspecial).toFixed(2)}</span>
                  </div>
                  
                  <div className={styles.divider} />

                  <div className={styles.resultRow}>
                    <strong style={{ color: 'hsl(var(--text-main))' }}>Custo Total do Procedimento:</strong>
                    <strong style={{ fontSize: '15px', color: 'hsl(var(--text-main))' }}>
                      R$ {custoTotalProcedimento.toFixed(2)}
                    </strong>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.resultRowLabel}>Markup Divisor da Planilha:</span>
                    <span className={styles.resultRowValue}>
                      {markupDivisor ? markupDivisor.toFixed(4) : 'Indeterminado (>100%)'}
                    </span>
                  </div>
                </div>

                {/* DESTAQUE: VALOR A COBRAR (PREÇO SUGERIDO) */}
                {totalDeducoesPct >= 100 ? (
                  <div style={{ background: 'hsl(var(--danger-light))', color: 'hsl(var(--danger))', padding: '16px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                    <strong>Atenção:</strong> A soma das porcentagens atingiu {totalDeducoesPct.toFixed(2)}%. Ajuste os percentuais para que sejam menores que 100%.
                  </div>
                ) : (
                  <div className={styles.resultHighlightCard}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                        VALOR A COBRAR SUGERIDO
                      </div>
                      <div className={styles.resultHighlightValue}>
                        R$ {valorSugeridoCobranca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                        Cobre ao menos <strong>R$ {precoMinimoEquilibrio.toFixed(2)}</strong> para não ter prejuízo.
                      </div>
                    </div>

                    <button 
                      onClick={() => setProcedurePricePracticed(parseFloat(valorSugeridoCobranca.toFixed(2)))}
                      className={styles.secondaryBtn}
                      style={{ borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))' }}
                      title="Copiar preço sugerido para o praticado"
                    >
                      <Check size={14} />
                      Usar Sugerido
                    </button>
                  </div>
                )}

                {/* PREÇO PRATICADO & TERMÔMETRO DE LUCRO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.label} style={{ fontSize: '13px', color: 'hsl(var(--text-main))' }}>
                      Preço Praticado na Clínica (R$)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      className={styles.input}
                      style={{ fontSize: '18px', fontWeight: 800, borderColor: 'hsl(var(--primary))' }}
                      value={procedurePricePracticed}
                      onChange={(e) => setProcedurePricePracticed(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  {procedurePricePracticed > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-app))', padding: '12px 14px', borderRadius: 'var(--radius-xs)', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Lucro Líquido Real: </span>
                        <strong style={{ color: lucroLiquidoReal >= 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                          R$ {lucroLiquidoReal.toFixed(2)} ({margemRealizadaPct.toFixed(1)}%)
                        </strong>
                      </div>

                      {margemRealizadaPct >= margemLucroDesejadaPct ? (
                        <span className={styles.healthBadgeSuccess}>
                          <CheckCircle2 size={13} />
                          No Alvo
                        </span>
                      ) : margemRealizadaPct > 0 ? (
                        <span className={styles.healthBadgeWarning}>
                          <AlertTriangle size={13} />
                          Margem Baixa
                        </span>
                      ) : (
                        <span className={styles.healthBadgeDanger}>
                          <TrendingDown size={13} />
                          Prejuízo!
                        </span>
                      )}
                    </div>
                  )}

                  {isAdmin && (
                    <button 
                      onClick={handleSavePricing}
                      disabled={saving}
                      className={styles.primaryBtn}
                      style={{ marginTop: '8px' }}
                    >
                      <Save size={16} />
                      {saving ? 'Salvando no Sistema...' : 'Salvar Precificação & Ficha Técnica'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: CUSTOS FIXOS & HORA CLÍNICA (CONFORME TOPO DA PLANILHA)
          ========================================================================= */}
      {activeTab === 'custos_clinica' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* CARDS DE RESUMO DA HORA CLÍNICA */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span>Total Custos Fixos</span>
                <Building2 size={18} color="hsl(var(--primary))" />
              </div>
              <div className={styles.metricValue}>
                R$ {totalCustosFixosMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={styles.metricSubtext}>
                {custosFixos.filter(c => c.ativo !== false).length} itens ativos no consultório
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span>Horas Ocupadas no Mês</span>
                <Clock size={18} color="hsl(var(--secondary))" />
              </div>
              <div className={styles.metricValue}>
                {horasOcupadasMes} h
              </div>
              <div className={styles.metricSubtext}>
                De {numeroCadeiras * horasFuncionamentoMes}h disponíveis ({((horasOcupadasMes / (Math.max(1, numeroCadeiras * horasFuncionamentoMes))) * 100).toFixed(0)}% ocupação)
              </div>
            </div>

            <div className={styles.metricCard} style={{ borderColor: 'hsl(var(--primary))', background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)' }}>
              <div className={styles.metricHeader}>
                <span style={{ fontWeight: 700, color: 'hsl(var(--primary))' }}>Custo da Hora Clínica</span>
                <Sparkles size={18} color="hsl(var(--primary))" />
              </div>
              <div className={styles.metricValue} style={{ color: 'hsl(var(--primary))' }}>
                R$ {custoHoraClinicaCalculado.toFixed(2)}
              </div>
              <div className={styles.metricSubtext}>
                = Total Custos Fixos ÷ Horas Ocupadas
              </div>
            </div>
          </div>

          {/* PARÂMETROS OPERACIONAIS DA PLANILHA */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <Clock size={18} color="hsl(var(--primary))" />
                <span>Calcular Horas de Atendimento (Instruções da Planilha)</span>
              </div>
            </div>

            <div className={styles.explanationBox}>
              <strong>Exemplo de cálculo da Planilha da Dra. Maria Paula:</strong><br />
              "Atendimento realizado 5 dias na semana (segunda a sexta) de 08:00 às 18:00 = 10 horas por dia por consultório. 
              Multiplica o total de horas x os dias do mês: 5 dias x 4 semanas = 20 dias. 
              10 HORAS × 20 DIAS = 200 horas por consultório."
            </div>

            <div className={styles.formGrid3}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Quantas cadeiras funcionando possui?</label>
                <input 
                  type="number"
                  min="1"
                  className={styles.input}
                  value={numeroCadeiras}
                  onChange={(e) => setNumeroCadeiras(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Horas de Funcionamento / Mês (por consultório)</label>
                <input 
                  type="number"
                  min="1"
                  className={styles.input}
                  value={horasFuncionamentoMes}
                  onChange={(e) => setHorasFuncionamentoMes(Math.max(1, parseFloat(e.target.value) || 1))}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Horas Efetivas Ocupadas no Mês (Ocupação)</label>
                <input 
                  type="number"
                  min="1"
                  className={styles.input}
                  style={{ fontWeight: 700, borderColor: 'hsl(var(--primary))' }}
                  value={horasOcupadasMes}
                  onChange={(e) => setHorasOcupadasMes(Math.max(1, parseFloat(e.target.value) || 1))}
                />
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button 
                  onClick={handleSaveClinicaParams}
                  disabled={saving}
                  className={styles.primaryBtn}
                >
                  <Save size={15} />
                  Salvar Parâmetros Operacionais
                </button>
              </div>
            )}
          </div>

          {/* LISTA DE CUSTOS FIXOS DA CLÍNICA */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <Building2 size={18} color="hsl(var(--primary))" />
                <span>Custos Fixos Mensais do Consultório / Clínica</span>
              </div>

              <button 
                onClick={handleCarregarCustosPadrao}
                className={styles.secondaryBtn}
                style={{ fontSize: '12px' }}
              >
                <Sparkles size={14} />
                Carregar 20 Custos Padrão da Planilha
              </button>
            </div>

            {/* Form de adicionar novo custo */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', background: 'hsl(var(--bg-app))', padding: '14px', borderRadius: 'var(--radius-xs)', flexWrap: 'wrap' }}>
              <div className={styles.formGroup} style={{ flex: '2 1 200px' }}>
                <label className={styles.label}>Nome do Custo (ex: Aluguel, Pro Labore, CRO, Estágio)</label>
                <input 
                  type="text" 
                  placeholder="Ex: CRO, Internet, Salário..."
                  className={styles.input}
                  value={novoCustoNome}
                  onChange={(e) => setNovoCustoNome(e.target.value)}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: '1 1 120px' }}>
                <label className={styles.label}>Valor Mensal (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  className={styles.input}
                  value={novoCustoValor}
                  onChange={(e) => setNovoCustoValor(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddNovoCusto}
                className={styles.primaryBtn}
                style={{ height: '38px', minWidth: '110px' }}
              >
                <Plus size={15} />
                Adicionar
              </button>
            </div>

            {/* Tabela de Custos Fixos */}
            <div className={styles.tableContainer}>
              <table className={styles.materialsTable}>
                <thead>
                  <tr>
                    <th>Item de Custo Fixo</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Valor Mensal (R$)</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Ativo?</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {custosFixos.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>
                        Nenhum custo fixo cadastrado. Clique em "Carregar 20 Custos Padrão da Planilha" para começar!
                      </td>
                    </tr>
                  ) : (
                    custosFixos.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.nome_custo}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          R$ {Number(c.valor_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={c.ativo !== false}
                            onChange={() => handleToggleCusto(c.id, c.ativo !== false)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            onClick={() => handleDeleteCusto(c.id)}
                            className={styles.dangerBtn}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>TOTAL CUSTOS FIXOS:</span>
              <strong style={{ fontSize: '20px', color: 'hsl(var(--primary))' }}>
                R$ {totalCustosFixosMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          ABA 3: TABELA GERAL DE PREÇOS DA CLÍNICA
          ========================================================================= */}
      {activeTab === 'tabela_precos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className={styles.card} style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                  Filtrar por Especialidade:
                </span>
                <select 
                  className={styles.select}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                Exibindo <strong>{filteredProcedures.length}</strong> procedimentos
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.tableContainer}>
              <table className={styles.materialsTable}>
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th>Especialidade</th>
                    <th style={{ textAlign: 'right' }}>Preço Praticado</th>
                    <th style={{ textAlign: 'right' }}>Tempo Cadeira</th>
                    <th style={{ textAlign: 'center', width: '160px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcedures.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>
                        Nenhum procedimento encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredProcedures.map(p => {
                      const preco = Number(p.preco_praticado ?? p.price ?? 0);
                      const pCost = p.procedimento_custos && p.procedimento_custos[0] ? p.procedimento_custos[0] : null;

                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: 'hsl(var(--text-main))' }}>
                            {p.name}
                          </td>
                          <td>
                            <span className={styles.badgeTemplate}>
                              {p.categoria_especialidade || 'Geral'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'hsl(var(--primary))' }}>
                            R$ {preco.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', color: 'hsl(var(--text-muted))' }}>
                            {pCost ? `${pCost.tempo_consulta_minutos} min (${pCost.numero_sessoes_total}x)` : 'Não def.'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                selectProcedureForPricing(p.id);
                                setActiveTab('calculadora');
                              }}
                              className={styles.secondaryBtn}
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              Abrir na Calculadora
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL: MODELOS DA PLANILHA (DRA. MARIA PAULA)
          ========================================================================= */}
      {isTemplateModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsTemplateModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Modelos Prontos da Planilha de Precificação</h3>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                  Escolha um procedimento real da planilha para carregar todos os insumos, rendimentos, tempos e taxas:
                </p>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className={styles.secondaryBtn}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PLANILHA_PROCEDIMENTOS_TEMPLATES.map(tmpl => (
                <div 
                  key={tmpl.id} 
                  className={styles.templateCard}
                  onClick={() => loadTemplateIntoState(tmpl)}
                >
                  <div>
                    <strong style={{ fontSize: '15px', color: 'hsl(var(--text-main))' }}>{tmpl.nome}</strong>
                    <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                      {tmpl.materiais.length} insumos • {tmpl.tempo_consulta_minutos} min por consulta • {tmpl.numero_sessoes_total} sessões
                      {tmpl.custo_terceiros_laboratorio > 0 ? ` • Laboratório: R$ ${tmpl.custo_terceiros_laboratorio}` : ''}
                    </div>
                  </div>

                  <span className={styles.badgeTemplate}>
                    Carregar Modelo →
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NOVO PROCEDIMENTO
          ========================================================================= */}
      {isNewProcModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNewProcModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Criar Novo Procedimento</h3>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Nome do Procedimento</label>
              <input 
                type="text" 
                placeholder="Ex: Faceta de Resina Composta"
                className={styles.input}
                value={newProcName}
                onChange={(e) => setNewProcName(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Especialidade / Categoria</label>
              <select 
                className={styles.select}
                value={newProcCategory}
                onChange={(e) => setNewProcCategory(e.target.value)}
              >
                <option value="Geral">Clínica Geral</option>
                <option value="Dentística">Dentística / Estética</option>
                <option value="Endodontia">Endodontia</option>
                <option value="Periodontia">Periodontia</option>
                <option value="Cirurgia">Cirurgia Oral</option>
                <option value="Prótese">Prótese Dentária</option>
                <option value="Implante">Implantodontia</option>
                <option value="Ortodontia">Ortodontia</option>
                <option value="Harmonização">Harmonização Facial</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setIsNewProcModalOpen(false)} className={styles.secondaryBtn}>Cancelar</button>
              <button 
                onClick={() => {
                  if (!newProcName.trim()) return;
                  setSelectedProcedureId('');
                  setProcedureName(newProcName.trim());
                  setProcedureCategory(newProcCategory);
                  setMaterials([]);
                  setProcedurePricePracticed(0);
                  setIsNewProcModalOpen(false);
                  setNewProcName('');
                  showFeedback('Novo procedimento pronto para precificar!', 'success');
                }}
                className={styles.primaryBtn}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
