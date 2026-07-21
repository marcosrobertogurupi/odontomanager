import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Boxes, 
  History, 
  DollarSign, 
  LineChart, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  RefreshCw, 
  SlidersHorizontal,
  Info,
  Edit2,
  Trash,
  Calculator,
  Save,
  Check,
  TrendingDown,
  TrendingUp,
  Sliders,
  DollarSign as MoneyIcon,
  X,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './InventoryCosts.module.css';

interface InventoryCostsProps {
  selectedUnit: string;
}

export default function InventoryCosts({ selectedUnit }: InventoryCostsProps) {
  const { activeTenant, role } = useTenant();
  const [activeTab, setActiveTab] = useState<'custos' | 'insumos' | 'estoque' | 'precificacao' | 'rentabilidade'>('estoque');
  const [loading, setLoading] = useState(false);

  // =========================================================================
  // ESTADOS DOS DADOS
  // =========================================================================

  // 1. Custos Fixos & Parâmetros
  const [custosFixos, setCustosFixos] = useState<any[]>([]);
  const [paramId, setParamId] = useState<string | null>(null);
  const [numeroCadeiras, setNumeroCadeiras] = useState(1);
  const [horasFuncionamentoMes, setHorasFuncionamentoMes] = useState(160);
  const [horasOcupadasMes, setHorasOcupadasMes] = useState(120);

  // 2. Insumos
  const [insumos, setInsumos] = useState<any[]>([]);

  // 3. Estoque & Movimentações
  const [estoqueUnidade, setEstoqueUnidade] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);

  // 4. Precificação
  const [procedures, setProcedures] = useState<any[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [bomItems, setBomItems] = useState<any[]>([]);
  
  // Parâmetros do Procedimento Selecionado
  const [custoMaterialEspecial, setCustoMaterialEspecial] = useState(0);
  const [custoTerceirosLaboratorio, setCustoTerceirosLaboratorio] = useState(0);
  const [tempoConsultaMinutos, setTempoConsultaMinutos] = useState(30);
  const [numeroSessoesTotal, setNumeroSessoesTotal] = useState(1);
  const [comissaoProfissionalPct, setComissaoProfissionalPct] = useState(0);
  const [taxaCartaoPct, setTaxaCartaoPct] = useState(0);
  const [impostosPct, setImpostosPct] = useState(0);
  const [margemLucroDesejadaPct, setMargemLucroDesejadaPct] = useState(0);
  const [outrasDeducoesPct, setOutrasDeducoesPct] = useState(0);
  const [precoPraticado, setPrecoPraticado] = useState(0);

  // 5. Rentabilidade
  const [rentabilidadeData, setRentabilidadeData] = useState<any[]>([]);

  // Drawers e Modais
  const [isNewInsumoOpen, setIsNewInsumoOpen] = useState(false);
  const [isEditInsumoOpen, setIsEditInsumoOpen] = useState(false);
  const [selectedInsumoForEdit, setSelectedInsumoForEdit] = useState<any>(null);
  
  const [isNewCompraOpen, setIsNewCompraOpen] = useState(false);
  const [isNewCustoOpen, setIsNewCustoOpen] = useState(false);
  const [isAjusteManualOpen, setIsAjusteManualOpen] = useState(false);

  // Modal Zerar/Reiniciar Estoque
  const [isZerarEstoqueOpen, setIsZerarEstoqueOpen] = useState(false);
  const [zerarMode, setZerarMode] = useState<'zerar_saldos' | 'apagar_tudo'>('apagar_tudo');
  const [zerarConfirmInput, setZerarConfirmInput] = useState('');
  const [isZerando, setIsZerando] = useState(false);

  // Unidades de Medida
  const [unidadesMedida, setUnidadesMedida] = useState<any[]>([]);
  const [isUnidadesMedidaOpen, setIsUnidadesMedidaOpen] = useState(false);
  const [unitInput, setUnitInput] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  // Formulários
  const [formInsumo, setFormInsumo] = useState({
    nome: '',
    categoria: 'Descartáveis',
    unidade_medida: '',
    quantidade_embalagem: '',
    quantidade_rendimento: '',
    preco_embalagem_atual: '',
    estoque_minimo: '',
    ativo: true
  });

  const [formCompra, setFormCompra] = useState({
    insumo_id: '',
    fornecedor: '',
    quantidade_comprada: '',
    preco_pago_embalagem: '',
    nota_fiscal: ''
  });

  const [formCusto, setFormCusto] = useState({
    nome_custo: '',
    valor_mensal: '',
    ativo: true
  });

  const [formAjuste, setFormAjuste] = useState({
    insumo_id: '',
    quantidade: '',
    tipo: 'saida', // 'entrada' | 'saida' | 'ajuste'
    motivo: 'perda'
  });

  const isAdmin = role === 'admin' || role === 'clinic_owner' || role === 'super_admin';

  // =========================================================================
  // CONSULTAS DE DADOS
  // =========================================================================

  const fetchAll = async () => {
    if (!activeTenant || !selectedUnit) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchParametersAndCosts(),
        fetchInsumosAndEstoque(),
        fetchMovements(),
        fetchProcedures(),
        fetchRentabilidade(),
        fetchUnidadesMedida()
      ]);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [activeTenant, selectedUnit]);

  // 1. Assinatura Realtime para Custos Fixos
  useEffect(() => {
    if (!activeTenant || !selectedUnit) return;

    const channel = supabase
      .channel('realtime_custos_fixos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custos_fixos',
          filter: `tenant_id=eq.${activeTenant.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          if (eventType === 'INSERT') {
            const newItem = newRecord as any;
            if (newItem.unit_id === selectedUnit) {
              setCustosFixos((prev) => {
                if (prev.some(c => c.id === newItem.id)) return prev;
                return [...prev, newItem].sort((a, b) => a.nome_custo.localeCompare(b.nome_custo));
              });
            }
          } else if (eventType === 'UPDATE') {
            const updatedItem = newRecord as any;
            if (updatedItem.unit_id === selectedUnit) {
              setCustosFixos((prev) =>
                prev.map(c => c.id === updatedItem.id ? updatedItem : c)
                  .sort((a, b) => a.nome_custo.localeCompare(b.nome_custo))
              );
            } else {
              setCustosFixos((prev) => prev.filter(c => c.id !== updatedItem.id));
            }
          } else if (eventType === 'DELETE') {
            const deletedItem = oldRecord as any;
            setCustosFixos((prev) => prev.filter(c => c.id !== deletedItem.id));
          }
          
          fetchRentabilidade();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant, selectedUnit]);

  // 2. Assinatura Realtime para Parâmetros da Unidade
  useEffect(() => {
    if (!activeTenant || !selectedUnit) return;

    const channel = supabase
      .channel('realtime_parametros_custo')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parametros_custo_unidade',
          filter: `unit_id=eq.${selectedUnit}`,
        },
        (payload) => {
          const { eventType, new: newRecord } = payload;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const p = newRecord as any;
            setParamId(p.id);
            setNumeroCadeiras(p.numero_cadeiras);
            setHorasFuncionamentoMes(Number(p.horas_funcionamento_mes));
            setHorasOcupadasMes(Number(p.horas_ocupadas_mes));
          } else if (eventType === 'DELETE') {
            setParamId(null);
            setNumeroCadeiras(1);
            setHorasFuncionamentoMes(160);
            setHorasOcupadasMes(120);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant, selectedUnit]);

  // 3. Assinatura Realtime para Insumos
  useEffect(() => {
    if (!activeTenant) return;

    const channel = supabase
      .channel('realtime_insumos_cost')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'insumos',
          filter: `tenant_id=eq.${activeTenant.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          if (eventType === 'INSERT') {
            const newItem = newRecord as any;
            setInsumos((prev) => {
              if (prev.some(i => i.id === newItem.id)) return prev;
              return [...prev, newItem].sort((a, b) => a.nome.localeCompare(b.nome));
            });
          } else if (eventType === 'UPDATE') {
            const updatedItem = newRecord as any;
            setInsumos((prev) =>
              prev.map(i => i.id === updatedItem.id ? updatedItem : i)
                .sort((a, b) => a.nome.localeCompare(b.nome))
            );
          } else if (eventType === 'DELETE') {
            const deletedItem = oldRecord as any;
            setInsumos((prev) => prev.filter(i => i.id !== deletedItem.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant]);

  // 4. Assinatura Realtime para Estoque da Unidade
  useEffect(() => {
    if (!activeTenant || !selectedUnit) return;

    const channel = supabase
      .channel('realtime_estoque_cost')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_unidade',
          filter: `unit_id=eq.${selectedUnit}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          if (eventType === 'INSERT') {
            const newItem = newRecord as any;
            setEstoqueUnidade((prev) => {
              if (prev.some(e => e.id === newItem.id)) return prev;
              return [...prev, newItem];
            });
          } else if (eventType === 'UPDATE') {
            const updatedItem = newRecord as any;
            setEstoqueUnidade((prev) =>
              prev.map(e => e.id === updatedItem.id ? updatedItem : e)
            );
          } else if (eventType === 'DELETE') {
            const deletedItem = oldRecord as any;
            setEstoqueUnidade((prev) => prev.filter(e => e.id !== deletedItem.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant, selectedUnit]);

  // 5. Assinatura Realtime para Movimentações de Estoque
  useEffect(() => {
    if (!activeTenant || !selectedUnit) return;

    const channel = supabase
      .channel('realtime_movimentacoes_cost')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'movimentacoes_estoque',
          filter: `unit_id=eq.${selectedUnit}`,
        },
        (payload) => {
          const newItem = payload.new as any;
          setMovements((prev) => {
            if (prev.some(m => m.id === newItem.id)) return prev;
            const insumo = insumos.find(i => i.id === newItem.insumo_id);
            const fullItem = {
              ...newItem,
              insumo: insumo ? { nome: insumo.nome, unidade_medida: insumo.unidade_medida } : null
            };
            return [fullItem, ...prev].slice(0, 100);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant, selectedUnit, insumos]);

  // 6. Assinatura Realtime para Unidades de Medida
  useEffect(() => {
    if (!activeTenant) return;

    const channel = supabase
      .channel('realtime_unidades_medida')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unidades_medida',
          filter: `tenant_id=eq.${activeTenant.id}`,
        },
        () => {
          fetchUnidadesMedida();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenant]);

  // 1. Buscar parâmetros e custos fixos
  const fetchParametersAndCosts = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      // Custos fixos
      const { data: costs, error: costsErr } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .order('nome_custo');
      if (costsErr) throw costsErr;
      setCustosFixos(costs || []);

      // Parâmetros da unidade
      const { data: params, error: paramsErr } = await supabase
        .from('parametros_custo_unidade')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .maybeSingle();

      if (paramsErr) throw paramsErr;

      if (params) {
        setParamId(params.id);
        setNumeroCadeiras(params.numero_cadeiras);
        setHorasFuncionamentoMes(Number(params.horas_funcionamento_mes));
        setHorasOcupadasMes(Number(params.horas_ocupadas_mes));
      } else {
        setParamId(null);
        setNumeroCadeiras(1);
        setHorasFuncionamentoMes(160);
        setHorasOcupadasMes(120);
      }
    } catch (err) {
      console.error('Erro ao buscar custos/parâmetros:', err);
    }
  };

  // 2. Buscar insumos e saldos de estoque da unidade
  const fetchInsumosAndEstoque = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const { data: insumosData, error: insumosErr } = await supabase
        .from('insumos')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('nome');
      if (insumosErr) throw insumosErr;
      setInsumos(insumosData || []);

      const { data: estoqueData, error: estoqueErr } = await supabase
        .from('estoque_unidade')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit);
      if (estoqueErr) throw estoqueErr;
      setEstoqueUnidade(estoqueData || []);
    } catch (err) {
      console.error('Erro ao buscar insumos/estoque:', err);
    }
  };

  // 3. Buscar histórico de movimentações
  const fetchMovements = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*, insumo:insumos(nome, unidade_medida)')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error('Erro ao buscar movimentações:', err);
    }
  };

  // 4. Buscar procedimentos
  const fetchProcedures = async () => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (error) throw error;
      setProcedures(data || []);
    } catch (err) {
      console.error('Erro ao buscar procedimentos:', err);
    }
  };

  // 5. Buscar dados de rentabilidade da view
  const fetchRentabilidade = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const { data, error } = await supabase
        .from('vw_rentabilidade_procedimento')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .order('margem_realizada_pct', { ascending: false });
      if (error) throw error;
      setRentabilidadeData(data || []);
    } catch (err) {
      console.error('Erro ao buscar rentabilidade:', err);
    }
  };

  // 5.5. Buscar unidades de medida
  const fetchUnidadesMedida = async () => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('unidades_medida')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('nome');
      if (error) throw error;

      if (!data || data.length === 0) {
        // Se não houver unidades de medida cadastradas, insere as padrão
        const defaults = ['unidade', 'ml', 'grama', 'tubete', 'caixa'];
        const insertData = defaults.map(name => ({
          tenant_id: activeTenant.id,
          nome: name
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from('unidades_medida')
          .insert(insertData)
          .select();

        if (insertErr) throw insertErr;
        setUnidadesMedida(inserted || []);
        
        if (inserted && inserted.length > 0 && !formInsumo.unidade_medida) {
          setFormInsumo(prev => ({ ...prev, unidade_medida: inserted[0].nome }));
        }
      } else {
        setUnidadesMedida(data);
        if (data.length > 0 && !formInsumo.unidade_medida) {
          setFormInsumo(prev => ({ ...prev, unidade_medida: data[0].nome }));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar unidades de medida:', err);
    }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitInput.trim() || !activeTenant) return;

    const newName = unitInput.trim().toLowerCase();

    // Validar duplicado localmente antes de enviar
    const isDuplicate = unidadesMedida.some(u => u.nome === newName && u.id !== editingUnitId);
    if (isDuplicate) {
      alert('Esta unidade de medida já está cadastrada.');
      return;
    }

    try {
      if (editingUnitId) {
        const oldUnit = unidadesMedida.find(u => u.id === editingUnitId);

        const { error: updateErr } = await supabase
          .from('unidades_medida')
          .update({ nome: newName })
          .eq('id', editingUnitId);

        if (updateErr) throw updateErr;

        if (oldUnit && oldUnit.nome !== newName) {
          const { error: insumoErr } = await supabase
            .from('insumos')
            .update({ unidade_medida: newName })
            .eq('tenant_id', activeTenant.id)
            .eq('unidade_medida', oldUnit.nome);
          if (insumoErr) {
            console.error('Erro ao atualizar insumos com o novo nome da unidade:', insumoErr);
          }
        }

        setEditingUnitId(null);
      } else {
        const { error: insertErr } = await supabase
          .from('unidades_medida')
          .insert({ tenant_id: activeTenant.id, nome: newName });

        if (insertErr) throw insertErr;
      }
      setUnitInput('');
      fetchUnidadesMedida();
      fetchInsumosAndEstoque();
    } catch (err: any) {
      console.error('Erro ao salvar unidade de medida:', err);
      alert('Erro ao salvar unidade de medida: ' + (err.message || err));
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (!activeTenant) return;

    if (name === 'unidade') {
      alert('A unidade padrão "unidade" não pode ser excluída.');
      return;
    }

    const count = insumos.filter(i => i.unidade_medida === name).length;
    let confirmMsg = `Tem certeza que deseja excluir a unidade "${name}"?`;
    if (count > 0) {
      confirmMsg = `A unidade "${name}" está associada a ${count} insumo(s). Se você a excluir, esses insumos serão atualizados para a unidade padrão ("unidade"). Deseja continuar?`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      if (count > 0) {
        const { error: insumoErr } = await supabase
          .from('insumos')
          .update({ unidade_medida: 'unidade' })
          .eq('tenant_id', activeTenant.id)
          .eq('unidade_medida', name);
        if (insumoErr) throw insumoErr;
      }

      const { error: deleteErr } = await supabase
        .from('unidades_medida')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      fetchUnidadesMedida();
      fetchInsumosAndEstoque();
    } catch (err: any) {
      console.error('Erro ao excluir unidade de medida:', err);
      alert('Erro ao excluir unidade de medida: ' + (err.message || err));
    }
  };

  // 6. Carregar ficha técnica (BOM) e calculadora do procedimento selecionado
  const loadProcedurePricingDetails = async (procId: string) => {
    if (!procId || !activeTenant) {
      setBomItems([]);
      resetCalculatorParams();
      return;
    }

    try {
      // BOM
      const { data: bom, error: bomErr } = await supabase
        .from('procedimento_insumos')
        .select('*, insumo:insumos(*)')
        .eq('procedure_id', procId)
        .eq('tenant_id', activeTenant.id);
      if (bomErr) console.warn('Erro ao carregar BOM:', bomErr);

      setBomItems((bom || []).map(b => ({
        id: b.id,
        insumo_id: b.insumo_id,
        quantidade_usada_por_procedimento: Number(b.quantidade_usada_por_procedimento || 0),
        numero_consultas_necessarias: Number(b.numero_consultas_necessarias || 1),
        insumo: b.insumo
      })));

      // Parâmetros de custos
      const { data: calc, error: calcErr } = await supabase
        .from('procedimento_custos')
        .select('*')
        .eq('procedure_id', procId)
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();
      if (calcErr) console.warn('Erro ao carregar custos do procedimento:', calcErr);

      // Preço praticado atual do procedimento
      const { data: proc, error: procErr } = await supabase
        .from('procedures')
        .select('preco_praticado, price')
        .eq('id', procId)
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();
      if (procErr) console.warn('Erro ao carregar preço praticado do procedimento:', procErr);
      setPrecoPraticado(Number(proc?.preco_praticado ?? proc?.price ?? 0));

      if (calc) {
        setCustoMaterialEspecial(Number(calc.custo_material_especial || 0));
        setCustoTerceirosLaboratorio(Number(calc.custo_terceiros_laboratorio || 0));
        setTempoConsultaMinutos(Number(calc.tempo_consulta_minutos || 30));
        setNumeroSessoesTotal(Number(calc.numero_sessoes_total || 1));
        setComissaoProfissionalPct(Number(calc.comissao_profissional_pct ?? calc.comissao_professional_pct ?? 0));
        setTaxaCartaoPct(Number(calc.taxa_cartao_pct || 0));
        setImpostosPct(Number(calc.impostos_pct || 0));
        setMargemLucroDesejadaPct(Number(calc.margem_lucro_desejada_pct || 0));
        setOutrasDeducoesPct(Number(calc.outras_deducoes_pct || 0));
      } else {
        resetCalculatorParams();
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes da precificação:', err);
    }
  };

  const resetCalculatorParams = () => {
    setCustoMaterialEspecial(0);
    setCustoTerceirosLaboratorio(0);
    setTempoConsultaMinutos(30);
    setNumeroSessoesTotal(1);
    setComissaoProfissionalPct(0);
    setTaxaCartaoPct(0);
    setImpostosPct(0);
    setMargemLucroDesejadaPct(0);
    setOutrasDeducoesPct(0);
  };

  // =========================================================================
  // OPERAÇÕES DO BANCO DE DADOS (MUTATIONS)
  // =========================================================================

  // 1. Custos Fixos & Parâmetros
  const handleSaveParameters = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const payload = {
        tenant_id: activeTenant.id,
        unit_id: selectedUnit,
        numero_cadeiras: numeroCadeiras,
        horas_funcionamento_mes: horasFuncionamentoMes,
        horas_ocupadas_mes: horasOcupadasMes,
        updated_at: new Date().toISOString()
      };

      let error;
      if (paramId) {
        const { error: err } = await supabase
          .from('parametros_custo_unidade')
          .update(payload)
          .eq('id', paramId);
        error = err;
      } else {
        const { data, error: err } = await supabase
          .from('parametros_custo_unidade')
          .insert([payload])
          .select()
          .single();
        error = err;
        if (data) setParamId(data.id);
      }

      if (error) throw error;
      alert('Parâmetros salvos com sucesso!');
      fetchParametersAndCosts();
      fetchRentabilidade();
    } catch (err: any) {
      alert('Erro ao salvar parâmetros: ' + err.message);
    }
  };

  const handleAddCustoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    try {
      const { error } = await supabase
        .from('custos_fixos')
        .insert([{
          tenant_id: activeTenant.id,
          unit_id: selectedUnit,
          nome_custo: formCusto.nome_custo,
          valor_mensal: Number(formCusto.valor_mensal),
          ativo: formCusto.ativo
        }]);

      if (error) throw error;
      setIsNewCustoOpen(false);
      setFormCusto({ nome_custo: '', valor_mensal: '', ativo: true });
      fetchParametersAndCosts();
      fetchRentabilidade();
    } catch (err: any) {
      alert('Erro ao lançar custo: ' + err.message);
    }
  };

  const toggleCustoAtivo = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('custos_fixos')
        .update({ ativo: !current, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchParametersAndCosts();
      fetchRentabilidade();
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleDeleteCusto = async (id: string) => {
    if (!confirm('Deseja excluir este item de custo fixo?')) return;
    try {
      const { error } = await supabase
        .from('custos_fixos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchParametersAndCosts();
      fetchRentabilidade();
    } catch (err: any) {
      alert('Erro ao excluir custo: ' + err.message);
    }
  };

  // 2. Insumos (CRUD)
  const handleAddInsumoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    try {
      const { error } = await supabase
        .from('insumos')
        .insert([{
          tenant_id: activeTenant.id,
          nome: formInsumo.nome,
          categoria: formInsumo.categoria,
          unidade_medida: formInsumo.unidade_medida,
          quantidade_embalagem: Number(formInsumo.quantidade_embalagem),
          quantidade_rendimento: Number(formInsumo.quantidade_rendimento),
          preco_embalagem_atual: Number(formInsumo.preco_embalagem_atual),
          estoque_minimo: Number(formInsumo.estoque_minimo),
          ativo: formInsumo.ativo
        }]);

      if (error) throw error;
      setIsNewInsumoOpen(false);
      resetInsumoForm();
      fetchInsumosAndEstoque();
    } catch (err: any) {
      alert('Erro ao salvar insumo: ' + err.message);
    }
  };

  const handleEditInsumoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedInsumoForEdit) return;
    try {
      const { error } = await supabase
        .from('insumos')
        .update({
          nome: formInsumo.nome,
          categoria: formInsumo.categoria,
          unidade_medida: formInsumo.unidade_medida,
          quantidade_embalagem: Number(formInsumo.quantidade_embalagem),
          quantidade_rendimento: Number(formInsumo.quantidade_rendimento),
          preco_embalagem_atual: Number(formInsumo.preco_embalagem_atual),
          estoque_minimo: Number(formInsumo.estoque_minimo),
          ativo: formInsumo.ativo,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInsumoForEdit.id);

      if (error) throw error;
      setIsEditInsumoOpen(false);
      setSelectedInsumoForEdit(null);
      resetInsumoForm();
      fetchInsumosAndEstoque();
    } catch (err: any) {
      alert('Erro ao atualizar insumo: ' + err.message);
    }
  };

  const openEditInsumo = (insumo: any) => {
    setSelectedInsumoForEdit(insumo);
    setFormInsumo({
      nome: insumo.nome,
      categoria: insumo.categoria || 'Descartáveis',
      unidade_medida: insumo.unidade_medida || 'unidade',
      quantidade_embalagem: String(insumo.quantidade_embalagem),
      quantidade_rendimento: String(insumo.quantidade_rendimento),
      preco_embalagem_atual: String(insumo.preco_embalagem_atual),
      estoque_minimo: String(insumo.estoque_minimo),
      ativo: insumo.ativo
    });
    setIsEditInsumoOpen(true);
  };

  const resetInsumoForm = () => {
    setFormInsumo({
      nome: '',
      categoria: 'Descartáveis',
      unidade_medida: unidadesMedida[0]?.nome || 'unidade',
      quantidade_embalagem: '',
      quantidade_rendimento: '',
      preco_embalagem_atual: '',
      estoque_minimo: '',
      ativo: true
    });
  };

  const toggleInsumoAtivo = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .update({ ativo: !current, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchInsumosAndEstoque();
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleDeleteInsumo = async (id: string) => {
    if (!activeTenant) return;
    if (!confirm('Deseja realmente excluir este insumo? Isso removerá o item do catálogo, todos os saldos de estoque e fichas técnicas associados.')) return;
    try {
      const { error: rpcErr } = await supabase.rpc('deletar_insumo_completo', {
        p_insumo_id: id,
        p_tenant_id: activeTenant.id
      });

      if (rpcErr) {
        console.warn('RPC deletar_insumo_completo falhou, tentando exclusão direta:', rpcErr);
        const { error: directErr } = await supabase
          .from('insumos')
          .delete()
          .eq('id', id)
          .eq('tenant_id', activeTenant.id);
        if (directErr) throw directErr;
      }

      await fetchInsumosAndEstoque();
    } catch (err: any) {
      console.error('Erro ao excluir insumo:', err);
      alert('Erro ao excluir insumo: ' + (err.message || err));
    }
  };

  const handleZerarEstoqueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    if (zerarConfirmInput.trim().toUpperCase() !== 'ZERAR') {
      alert('Por favor, digite a palavra ZERAR em maiúsculas para confirmar.');
      return;
    }

    setIsZerando(true);
    try {
      const { error } = await supabase.rpc('zerar_estoque_completo', {
        p_tenant_id: activeTenant.id,
        p_mode: zerarMode
      });

      if (error) throw error;

      alert(
        zerarMode === 'apagar_tudo'
          ? 'Estoque e catálogo de materiais zerados com sucesso! Você já pode cadastrar seus materiais do zero.'
          : 'Saldos de estoque redefinidos para 0,00 com sucesso!'
      );
      setIsZerarEstoqueOpen(false);
      setZerarConfirmInput('');
      await fetchAll();
    } catch (err: any) {
      console.error('Erro ao zerar estoque:', err);
      alert('Erro ao processar ação no estoque: ' + (err.message || err));
    } finally {
      setIsZerando(false);
    }
  };

  // 3. Compras & Ajustes
  const handleAddCompraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    const { insumo_id, fornecedor, quantidade_comprada, preco_pago_embalagem, nota_fiscal } = formCompra;
    if (!insumo_id || !quantidade_comprada || !preco_pago_embalagem) return;

    try {
      const { error } = await supabase.rpc('processar_compra_estoque', {
        p_insumo_id: insumo_id,
        p_unit_id: selectedUnit,
        p_fornecedor: fornecedor || 'Diversos',
        p_quantidade: Number(quantidade_comprada),
        p_valor_total: Number(quantidade_comprada) * Number(preco_pago_embalagem),
        p_valor_unitario: Number(preco_pago_embalagem),
        p_nota_fiscal: nota_fiscal || null,
        p_tenant_id: activeTenant.id
      });

      if (error) throw error;
      setIsNewCompraOpen(false);
      setFormCompra({ insumo_id: '', fornecedor: '', quantidade_comprada: '', preco_pago_embalagem: '', nota_fiscal: '' });
      await fetchInsumosAndEstoque();
      await fetchMovements();
      alert('Entrada registrada com sucesso! Custo da embalagem atualizado.');
    } catch (err: any) {
      alert('Erro ao registrar compra: ' + err.message);
    }
  };

  const handleAjusteManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    const { insumo_id, quantidade, tipo, motivo } = formAjuste;
    if (!insumo_id || !quantidade) return;

    try {
      const qtyNum = Number(quantidade);
      const stockChange = tipo === 'saida' ? -qtyNum : qtyNum;

      // 1. Registrar movimentação
      const { error: movErr } = await supabase
        .from('movimentacoes_estoque')
        .insert([{
          tenant_id: activeTenant.id,
          unit_id: selectedUnit,
          insumo_id: insumo_id,
          tipo: tipo,
          quantidade: qtyNum,
          motivo: motivo,
          referencia_tipo: 'ajuste_manual'
        }]);
      if (movErr) throw movErr;

      // 2. Atualizar estoque
      const { error: upsertErr } = await supabase
        .from('estoque_unidade')
        .upsert({
          tenant_id: activeTenant.id,
          unit_id: selectedUnit,
          insumo_id: insumo_id,
          quantidade_atual: (estoqueUnidade.find(e => e.insumo_id === insumo_id)?.quantidade_atual || 0) + stockChange,
          updated_at: new Date().toISOString()
        }, { onConflict: 'unit_id, insumo_id' });

      if (upsertErr) throw upsertErr;

      setIsAjusteManualOpen(false);
      setFormAjuste({ insumo_id: '', quantidade: '', tipo: 'saida', motivo: 'perda' });
      await fetchInsumosAndEstoque();
      await fetchMovements();
      alert('Estoque ajustado com sucesso!');
    } catch (err: any) {
      alert('Erro ao ajustar estoque: ' + err.message);
    }
  };

  // 4. Precificação por Procedimento (Salvar)
  const handleSavePrecificacao = async () => {
    if (!activeTenant || !selectedProcedure) return;

    // Validar soma de taxas
    const somaPercentuais = comissaoProfissionalPct + taxaCartaoPct + impostosPct + margemLucroDesejadaPct + outrasDeducoesPct;
    if (somaPercentuais >= 100) {
      alert('Erro: A soma das comissões, taxas de cartão, impostos, margem e outras deduções não pode ser igual ou maior que 100%!');
      return;
    }

    try {
      // 1. Salvar os parâmetros de custos do procedimento
      const { error: calcErr } = await supabase
        .from('procedimento_custos')
        .upsert({
          tenant_id: activeTenant.id,
          procedure_id: selectedProcedure,
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

      if (calcErr) throw calcErr;

      // 2. Atualizar o preço praticado na tabela procedures
      const { error: procErr } = await supabase
        .from('procedures')
        .update({
          preco_praticado: precoPraticado,
          categoria_especialidade: selectedCategory !== 'Todos' ? selectedCategory : null
        })
        .eq('id', selectedProcedure)
        .eq('tenant_id', activeTenant.id);

      if (procErr) throw procErr;

      // 3. Salvar BOM (procedimento_insumos): Limpar antigos e gravar novos
      const { error: delErr } = await supabase
        .from('procedimento_insumos')
        .delete()
        .eq('procedure_id', selectedProcedure)
        .eq('tenant_id', activeTenant.id);
      if (delErr) throw delErr;

      const validBoms = bomItems.filter(b => b.insumo_id && b.quantidade_usada_por_procedimento > 0);
      if (validBoms.length > 0) {
        const { error: insErr } = await supabase
          .from('procedimento_insumos')
          .insert(validBoms.map(b => ({
            tenant_id: activeTenant.id,
            procedure_id: selectedProcedure,
            insumo_id: b.insumo_id,
            quantidade_usada_por_procedimento: b.quantidade_usada_por_procedimento,
            numero_consultas_necessarias: b.numero_consultas_necessarias
          })));
        if (insErr) throw insErr;
      }

      alert('Precificação e Ficha Técnica salvas com sucesso!');
      await fetchProcedures();
      await fetchRentabilidade();
      await loadProcedurePricingDetails(selectedProcedure);
    } catch (err: any) {
      alert('Erro ao salvar precificação: ' + err.message);
    }
  };

  // Manipulações locais da lista de BOM
  const handleAddBOMRow = () => {
    setBomItems([...bomItems, { insumo_id: '', quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 }]);
  };

  const handleRemoveBOMRow = (idx: number) => {
    setBomItems(bomItems.filter((_, i) => i !== idx));
  };

  const handleBOMChange = (idx: number, field: string, value: any) => {
    const updated = [...bomItems];
    if (field === 'insumo_id') {
      const selectedInsumo = insumos.find(i => i.id === value);
      updated[idx] = { 
        ...updated[idx], 
        insumo_id: value, 
        insumo: selectedInsumo 
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: Number(value) };
    }
    setBomItems(updated);
  };

  // =========================================================================
  // FÓRMULAS DE CÁLCULO E LÓGICA DE NEGÓCIO (EM TEMPO REAL)
  // =========================================================================

  // Helper de número seguro
  const safeNum = (val: any, fallback = 0) => {
    const n = Number(val);
    return isNaN(n) || !isFinite(n) ? fallback : n;
  };

  // 1. Custo Hora Clínica
  const totalCustosFixosMensais = (custosFixos || [])
    .filter(cf => cf && cf.ativo)
    .reduce((acc, curr) => acc + safeNum(curr.valor_mensal, 0), 0);

  const calculatedCustoHoraClinica = safeNum(horasOcupadasMes, 0) > 0 
    ? totalCustosFixosMensais / safeNum(horasOcupadasMes, 120) 
    : 0;

  // 2. Custo de Insumos da BOM
  const calculatedCustoMaterialGeral = (bomItems || []).reduce((acc, b) => {
    if (!b || !b.insumo_id || !b.insumo) return acc;
    const preco = safeNum(b.insumo.preco_embalagem_atual, 0);
    const rendimento = safeNum(b.insumo.quantidade_rendimento, 1);
    const qtyUsada = safeNum(b.quantidade_usada_por_procedimento, 0);
    const sessoesNecessarias = safeNum(b.numero_consultas_necessarias, 1);

    const valorPorConsulta = rendimento > 0 ? (preco / rendimento) * qtyUsada : 0;
    return acc + (valorPorConsulta * sessoesNecessarias);
  }, 0);

  // 3. Calculadora de Procedimento
  const safeTempoMinutos = safeNum(tempoConsultaMinutos, 0);
  const safeSessoes = safeNum(numeroSessoesTotal, 1);
  const safeMatEspecial = safeNum(custoMaterialEspecial, 0);
  const safeTerceirosLab = safeNum(custoTerceirosLaboratorio, 0);

  const custoPorConsultaTempo = (safeTempoMinutos / 60) * calculatedCustoHoraClinica;
  const custoFixoProcedimento = calculatedCustoMaterialGeral + safeMatEspecial + safeTerceirosLab;
  const custoTotalProcedimento = (custoPorConsultaTempo * safeSessoes) + custoFixoProcedimento;

  const safeComissao = safeNum(comissaoProfissionalPct, 0);
  const safeTaxaCartao = safeNum(taxaCartaoPct, 0);
  const safeImpostos = safeNum(impostosPct, 0);
  const safeMargem = safeNum(margemLucroDesejadaPct, 0);
  const safeOutras = safeNum(outrasDeducoesPct, 0);

  const totalDeducoesPct = safeComissao + safeTaxaCartao + safeImpostos + safeMargem + safeOutras;
  
  const markupDivisor = (totalDeducoesPct < 100 && totalDeducoesPct >= 0) 
    ? 1 / (1 - (totalDeducoesPct / 100)) 
    : null;

  const valorSugeridoCobranca = markupDivisor 
    ? custoTotalProcedimento * markupDivisor 
    : 0;

  // Filtrar procedimentos
  const filteredProcedures = procedures.filter(p => {
    if (selectedCategory === 'Todos') return true;
    return p.categoria_especialidade === selectedCategory;
  });

  // Categorias para filtro
  const categoriesList = [
    'Todos', 
    'Endodontia', 
    'Dentística', 
    'Prótese', 
    'Odontopediatria', 
    'Cirurgia', 
    'Implantodontia', 
    'Periodontia', 
    'Harmonização Facial'
  ];

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.title}>Precificação & Custos</h1>
          <p className={styles.subtitle}>Gerenciamento de margens, hora clínica, estoque e custos fixos em tempo real.</p>
        </div>
        
        <div className={styles.roleToggle}>
          <span>Unidade Selecionada: </span>
          <strong style={{ color: 'hsl(var(--primary))', marginLeft: '6px' }}>
            {estoqueUnidade.length > 0 ? 'Ativa' : 'Sem Estoque Lançado'}
          </strong>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button 
          onClick={() => setActiveTab('estoque')} 
          className={`${styles.tabButton} ${activeTab === 'estoque' ? styles.activeTab : ''}`}
        >
          <Boxes size={16} />
          Estoque & Movimentações
        </button>
        <button 
          onClick={() => setActiveTab('insumos')} 
          className={`${styles.tabButton} ${activeTab === 'insumos' ? styles.activeTab : ''}`}
        >
          <SlidersHorizontal size={16} />
          Catálogo de Insumos
        </button>
        <button 
          onClick={() => setActiveTab('custos')} 
          className={`${styles.tabButton} ${activeTab === 'custos' ? styles.activeTab : ''}`}
        >
          <DollarSign size={16} />
          Custos Fixos da Clínica
        </button>
        <button 
          onClick={() => setActiveTab('precificacao')} 
          className={`${styles.tabButton} ${activeTab === 'precificacao' ? styles.activeTab : ''}`}
        >
          <Calculator size={16} />
          Precificação por Procedimento
        </button>
        <button 
          onClick={() => setActiveTab('rentabilidade')} 
          className={`${styles.tabButton} ${activeTab === 'rentabilidade' ? styles.activeTab : ''}`}
        >
          <LineChart size={16} />
          Dashboard de Rentabilidade
        </button>
      </div>

      {/* =========================================================================
          ABA 1: ESTOQUE & MOVIMENTAÇÕES
          ========================================================================= */}
      {activeTab === 'estoque' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Alerta de estoque baixo */}
          {insumos.filter(i => {
            const est = estoqueUnidade.find(e => e.insumo_id === i.id);
            const qty = est ? Number(est.quantidade_atual) : 0;
            return qty < Number(i.estoque_minimo) && i.ativo;
          }).length > 0 && (
            <div className={styles.alertBox}>
              <AlertTriangle size={20} />
              <div>
                <strong>Atenção: Itens com Estoque Crítico!</strong>
                <p>
                  Existem materiais com quantidade atual abaixo do estoque mínimo de segurança.
                </p>
              </div>
            </div>
          )}

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle}><Boxes size={16} /> Saldo de Itens</div>
              <div className={styles.cardValue}>{insumos.filter(i => i.ativo).length}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle} style={{ color: 'hsl(var(--danger))' }}><AlertTriangle size={16} /> Estoque Crítico</div>
              <div className={styles.cardValue} style={{ color: 'hsl(var(--danger))' }}>
                {insumos.filter(i => {
                  const est = estoqueUnidade.find(e => e.insumo_id === i.id);
                  const qty = est ? Number(est.quantidade_atual) : 0;
                  return qty < Number(i.estoque_minimo) && i.ativo;
                }).length}
              </div>
            </div>
          </div>

          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Saldos Atuais em Estoque</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={fetchAll} className={styles.secondaryBtn} title="Atualizar">
                  <RefreshCw size={14} />
                </button>
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => setIsZerarEstoqueOpen(true)} 
                      className={styles.removeBtn} 
                      style={{ padding: '8px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title="Zerar ou Reiniciar Estoque para Começar do Zero"
                    >
                      <RotateCcw size={14} />
                      Zerar Estoque
                    </button>
                    <button onClick={() => setIsAjusteManualOpen(true)} className={styles.secondaryBtn}>
                      Ajuste Manual
                    </button>
                    <button onClick={() => setIsNewCompraOpen(true)} className={styles.primaryBtn}>
                      <Plus size={14} />
                      Registrar Compra
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Material / Insumo</th>
                    <th>Categoria</th>
                    <th>Estoque Mínimo</th>
                    <th>Saldo Atual (Uso)</th>
                    <th>Preço Embalagem</th>
                    <th>Custo Unitário</th>
                    <th>Status</th>
                    {isAdmin && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {insumos.length > 0 ? (
                    insumos.map(i => {
                      const est = estoqueUnidade.find(e => e.insumo_id === i.id);
                      const qty = est ? Number(est.quantidade_atual) : 0;
                      const isLow = qty < Number(i.estoque_minimo);
                      const unitCost = Number(i.quantidade_rendimento) > 0 
                        ? Number(i.preco_embalagem_atual) / Number(i.quantidade_rendimento) 
                        : 0;

                      return (
                        <tr key={i.id} style={{ opacity: i.ativo ? 1 : 0.5 }}>
                          <td style={{ fontWeight: 600 }}>{i.nome}</td>
                          <td>{i.categoria || 'Geral'}</td>
                          <td>{i.estoque_minimo} {i.unidade_medida}s</td>
                          <td style={{ fontWeight: 700 }}>
                            <span style={{ color: isLow ? 'hsl(var(--danger))' : 'inherit' }}>
                              {qty.toFixed(2)}
                            </span>
                            {isLow && (
                              <span className={`${styles.badge} ${styles.badgeLowStock}`} style={{ marginLeft: '8px' }}>
                                Crítico
                              </span>
                            )}
                          </td>
                          <td>R$ {Number(i.preco_embalagem_atual).toFixed(2)}</td>
                          <td>R$ {unitCost.toFixed(4)}</td>
                          <td>
                            <span className={`${styles.badge} ${i.ativo ? styles.badgeNormal : styles.badgeLowStock}`}>
                              {i.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => openEditInsumo(i)} className={styles.closeBtn} title="Editar">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDeleteInsumo(i.id)} className={styles.removeBtn} title="Excluir">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '24px' }}>Nenhum insumo cadastrado no sistema.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico de Movimentações */}
          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Histórico Recente de Movimentações</h2>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Insumo</th>
                    <th>Tipo</th>
                    <th>Quantidade (Uso)</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length > 0 ? (
                    movements.map(m => (
                      <tr key={m.id}>
                        <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                        <td style={{ fontWeight: 500 }}>{m.insumo?.nome || 'Insumo Excluído'}</td>
                        <td>
                          <span className={`${styles.badge} ${
                            m.tipo === 'entrada' ? styles.badgeNormal : 
                            m.tipo === 'saida' ? styles.badgeLowStock : 
                            styles.badgeWarning
                          }`}>
                            {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Ajuste'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {m.tipo === 'saida' ? '-' : '+'}{Number(m.quantidade).toFixed(2)}
                        </td>
                        <td>{m.motivo}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Nenhuma movimentação registrada nesta unidade.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: CATÁLOGO DE INSUMOS
          ========================================================================= */}
      {activeTab === 'insumos' && (
        <div className={styles.contentCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Materiais e Insumos Cadastrados</h2>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setEditingUnitId(null); setUnitInput(''); setIsUnidadesMedidaOpen(true); }} className={styles.secondaryBtn}>
                  Gerenciar Unidades
                </button>
                <button onClick={() => { resetInsumoForm(); setIsNewInsumoOpen(true); }} className={styles.primaryBtn}>
                  <Plus size={14} />
                  Cadastrar Material
                </button>
              </div>
            )}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome do Material</th>
                  <th>Categoria</th>
                  <th>Medida</th>
                  <th>Qtd. Embalagem</th>
                  <th>Rendimento (Usos)</th>
                  <th>Preço Embalagem</th>
                  <th>Custo Unitário</th>
                  <th>Estoque Mínimo</th>
                  <th>Status</th>
                  {isAdmin && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {insumos.length > 0 ? (
                  insumos.map(i => {
                    const unitCost = Number(i.quantidade_rendimento) > 0 
                      ? Number(i.preco_embalagem_atual) / Number(i.quantidade_rendimento) 
                      : 0;

                    return (
                      <tr key={i.id} style={{ opacity: i.ativo ? 1 : 0.6 }}>
                        <td style={{ fontWeight: 600 }}>{i.nome}</td>
                        <td>{i.categoria || 'Sem categoria'}</td>
                        <td>{i.unidade_medida}</td>
                        <td>{i.quantidade_embalagem}</td>
                        <td>{i.quantidade_rendimento} usos</td>
                        <td>R$ {Number(i.preco_embalagem_atual).toFixed(2)}</td>
                        <td style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>
                          R$ {unitCost.toFixed(4)}
                        </td>
                        <td>{i.estoque_minimo}</td>
                        <td>
                          <span 
                            onClick={() => isAdmin && toggleInsumoAtivo(i.id, i.ativo)}
                            className={`${styles.badge} ${i.ativo ? styles.badgeNormal : styles.badgeLowStock}`}
                            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                          >
                            {i.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => openEditInsumo(i)} className={styles.closeBtn} title="Editar">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteInsumo(i.id)} className={styles.removeBtn} title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>Nenhum material no catálogo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 3: CUSTOS FIXOS
          ========================================================================= */}
      {activeTab === 'custos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Painel Operacional de Parâmetros e Hora Clínica */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
            <div className={styles.contentCard}>
              <h2 className={styles.sectionTitle} style={{ marginBottom: '12px' }}>Parâmetros Operacionais da Unidade</h2>
              <div className={styles.form} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className={styles.formGroup}>
                  <label>Consultórios / Cadeiras Ativas</label>
                  <input 
                    type="number" 
                    className={styles.input}
                    value={numeroCadeiras}
                    onChange={(e) => setNumeroCadeiras(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={!isAdmin}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Horas Funcionamento Mês (Por cadeira)</label>
                  <input 
                    type="number" 
                    className={styles.input}
                    value={horasFuncionamentoMes}
                    onChange={(e) => setHorasFuncionamentoMes(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!isAdmin}
                  />
                </div>
                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label>Horas Ocupadas Mês (Rateio real)</label>
                    {isAdmin && (
                      <button 
                        type="button" 
                        onClick={() => setHorasOcupadasMes(numeroCadeiras * horasFuncionamentoMes)}
                        style={{ fontSize: '11px', color: 'hsl(var(--primary))', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Sugerir Automático ({numeroCadeiras * horasFuncionamentoMes}h)
                      </button>
                    )}
                  </div>
                  <input 
                    type="number" 
                    className={styles.input}
                    value={horasOcupadasMes}
                    onChange={(e) => setHorasOcupadasMes(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={handleSaveParameters} 
                  className={styles.primaryBtn} 
                  style={{ marginTop: '16px', alignSelf: 'flex-start' }}
                >
                  <Save size={14} />
                  Salvar Parâmetros
                </button>
              )}
            </div>

            {/* Painel do custo de Hora Clínica */}
            <div className={styles.contentCard} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(135deg, hsl(var(--primary-light)) 0%, rgba(124,58,237,0.05) 100%)', borderColor: 'rgba(124,58,237,0.2)' }}>
              <MoneyIcon size={40} style={{ color: 'hsl(var(--primary))', marginBottom: '12px' }} />
              <span style={{ fontSize: '14px', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>Custo Hora Clínica Calculado</span>
              <h2 className="gradient-text" style={{ fontSize: '38px', fontWeight: 800, margin: '8px 0' }}>
                R$ {calculatedCustoHoraClinica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', maxWidth: '200px' }}>
                Baseado em R$ {totalCustosFixosMensais.toFixed(2)} de despesas fixas ativas e {horasOcupadasMes} horas de rateio ocupadas.
              </div>
            </div>
          </div>

          {/* Listagem de Custos Fixos */}
          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Lista de Despesas Fixas Mensais</h2>
              {isAdmin && (
                <button onClick={() => setIsNewCustoOpen(true)} className={styles.primaryBtn}>
                  <Plus size={14} />
                  Adicionar Despesa
                </button>
              )}
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome do Custo</th>
                    <th>Valor Mensal</th>
                    <th>Status</th>
                    {isAdmin && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {custosFixos.length > 0 ? (
                    custosFixos.map(cf => (
                      <tr key={cf.id} style={{ opacity: cf.ativo ? 1 : 0.5 }}>
                        <td style={{ fontWeight: 600 }}>{cf.nome_custo}</td>
                        <td style={{ fontWeight: 700, color: 'hsl(var(--danger))' }}>
                          R$ {Number(cf.valor_mensal).toFixed(2)}
                        </td>
                        <td>
                          <span 
                            onClick={() => isAdmin && toggleCustoAtivo(cf.id, cf.ativo)}
                            className={`${styles.badge} ${cf.ativo ? styles.badgeNormal : styles.badgeLowStock}`}
                            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                          >
                            {cf.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <button onClick={() => handleDeleteCusto(cf.id)} className={styles.removeBtn} title="Excluir">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>Nenhum custo fixo lançado nesta unidade.</td>
                    </tr>
                  )}
                  {custosFixos.length > 0 && (
                    <tr style={{ background: 'hsl(var(--bg-app))', fontWeight: 700 }}>
                      <td>Total Custos Fixos Ativos</td>
                      <td style={{ color: 'hsl(var(--danger))' }}>
                        R$ {totalCustosFixosMensais.toFixed(2)}
                      </td>
                      <td colSpan={isAdmin ? 2 : 1}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 4: PRECIFICAÇÃO POR PROCEDIMENTO
          ========================================================================= */}
      {activeTab === 'precificacao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Seletor de Especialidade e Procedimento */}
          <div className={styles.contentCard} style={{ display: 'flex', flexDirection: 'row', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className={styles.formGroup} style={{ flex: 1, minWidth: '200px' }}>
              <label>Filtro por Especialidade</label>
              <select 
                className={styles.select}
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedProcedure('');
                  setBomItems([]);
                  resetCalculatorParams();
                }}
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup} style={{ flex: 2, minWidth: '300px' }}>
              <label>Selecione um Procedimento</label>
              <select 
                className={styles.select}
                value={selectedProcedure}
                onChange={(e) => {
                  setSelectedProcedure(e.target.value);
                  loadProcedurePricingDetails(e.target.value);
                }}
              >
                <option value="">Selecione o procedimento...</option>
                {filteredProcedures.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProcedure ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Coluna Esquerda: BOM */}
              <div className={styles.contentCard}>
                <h3 className={styles.sectionTitle} style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px', marginBottom: '8px' }}>
                  Ficha Técnica de Materiais (BOM)
                </h3>
                
                <div className={styles.bomList}>
                  {bomItems.map((item, idx) => {
                    const preco = Number(item.insumo?.preco_embalagem_atual || 0);
                    const rendimento = Number(item.insumo?.quantidade_rendimento || 1);
                    const costPerConsult = rendimento > 0 ? (preco / rendimento) * item.quantidade_usada_por_procedimento : 0;
                    const totalRowCost = costPerConsult * item.numero_consultas_necessarias;

                    return (
                      <div key={idx} className={styles.bomGrid} style={{ background: 'hsl(var(--bg-app))', padding: '12px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                        <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--primary))' }}>Material {idx + 1}</span>
                          <button onClick={() => handleRemoveBOMRow(idx)} className={styles.removeBtn} style={{ padding: '2px' }}>
                            <Trash size={14} />
                          </button>
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: 'span 3' }}>
                          <select 
                            className={styles.select}
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            value={item.insumo_id}
                            onChange={(e) => handleBOMChange(idx, 'insumo_id', e.target.value)}
                          >
                            <option value="">Selecione o Insumo...</option>
                            {insumos.filter(i => i.ativo).map(i => (
                              <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                            ))}
                          </select>
                        </div>

                        <div className={styles.formGroup}>
                          <label style={{ fontSize: '11px' }}>Qtd por Uso</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            className={styles.input}
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            value={item.quantidade_usada_por_procedimento}
                            onChange={(e) => handleBOMChange(idx, 'quantidade_usada_por_procedimento', e.target.value)}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label style={{ fontSize: '11px' }}>Consultas</label>
                          <input 
                            type="number" 
                            step="0.5" 
                            className={styles.input}
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            value={item.numero_consultas_necessarias}
                            onChange={(e) => handleBOMChange(idx, 'numero_consultas_necessarias', e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '6px', fontSize: '12px', textAlign: 'right' }}>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>Custo Total</span>
                          <strong style={{ fontSize: '13px', color: 'hsl(var(--text-main))' }}>R$ {(Number(totalRowCost) || 0).toFixed(2)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button onClick={handleAddBOMRow} className={styles.secondaryBtn} style={{ marginTop: '12px', justifyContent: 'center', borderStyle: 'dashed' }}>
                  <Plus size={14} />
                  Inserir Material no Procedimento
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-app))', padding: '16px', borderRadius: '12px', marginTop: '24px', border: '1px solid hsl(var(--border-color))' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Custo Total de Insumos (BOM)</span>
                  <strong style={{ fontSize: '18px', color: 'hsl(var(--primary))' }}>
                    R$ {(Number(calculatedCustoMaterialGeral) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Coluna Direita: Calculadora */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className={styles.contentCard}>
                  <h3 className={styles.sectionTitle} style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '12px', marginBottom: '8px' }}>
                    Variáveis e Rateios
                  </h3>
                  
                  <div className={styles.form} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className={styles.formGroup}>
                      <label>Mat. Especial Avulso (R$)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={custoMaterialEspecial}
                        onChange={(e) => setCustoMaterialEspecial(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Serviço Laboratório (R$)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={custoTerceirosLaboratorio}
                        onChange={(e) => setCustoTerceirosLaboratorio(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Tempo de Cadeira (Minutos)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={tempoConsultaMinutos}
                        onChange={(e) => setTempoConsultaMinutos(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Total de Sessões/Consultas</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={numeroSessoesTotal}
                        onChange={(e) => setNumeroSessoesTotal(Math.max(1, parseFloat(e.target.value) || 1))}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', height: '1px', background: 'hsl(var(--border-color))', margin: '8px 0' }} />

                    <div className={styles.formGroup}>
                      <label>Comissão Profissional (%)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={comissaoProfissionalPct}
                        onChange={(e) => setComissaoProfissionalPct(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Taxa de Cartão (%)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={taxaCartaoPct}
                        onChange={(e) => setTaxaCartaoPct(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Impostos (%)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={impostosPct}
                        onChange={(e) => setImpostosPct(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Margem Desejada (%)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={margemLucroDesejadaPct}
                        onChange={(e) => setMargemLucroDesejadaPct(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                      <label>Outras Deduções (%)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        value={outrasDeducoesPct}
                        onChange={(e) => setOutrasDeducoesPct(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </div>

                {/* Dashboard de Resultados Ao Vivo */}
                <div className={styles.contentCard} style={{ background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-color))' }}>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '15px' }}>Resultados do Cálculo (Markup Divisor)</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Custo por Sessão (Tempo Cadeira)</span>
                      <span>R$ {(Number(custoPorConsultaTempo) || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Custo Fixo do Procedimento</span>
                      <span>R$ {(Number(custoFixoProcedimento) || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                      <span style={{ color: 'hsl(var(--text-main))' }}>Custo Total do Procedimento</span>
                      <span>R$ {(Number(custoTotalProcedimento) || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Markup Divisor</span>
                      <span>{markupDivisor ? (Number(markupDivisor) || 0).toFixed(4) : 'Inválido'}</span>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'hsl(var(--border-color))', margin: '8px 0' }} />

                  {totalDeducoesPct >= 100 ? (
                    <div className={styles.alertBox} style={{ background: 'hsl(var(--danger-light))', color: 'hsl(var(--danger))', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <ShieldAlert size={20} />
                      <div>
                        <strong>Markup Indeterminado!</strong>
                        <p>A soma das deduções atingiu {totalDeducoesPct}%. Ajuste as porcentagens para que a soma seja inferior a 100%.</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, hsl(var(--success-light)) 0%, rgba(16,185,129,0.02) 100%)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>Valor Sugerido de Venda</span>
                        <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'hsl(var(--success))' }}>
                          R$ {(Number(valorSugeridoCobranca) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={() => setPrecoPraticado(Number((Number(valorSugeridoCobranca) || 0).toFixed(2)))} 
                          className={styles.secondaryBtn}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Usar Sugerido
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Preço Praticado na Clínica (R$)</label>
                    <input 
                      type="number" 
                      className={styles.input}
                      style={{ fontSize: '16px', fontWeight: 700, borderColor: 'hsl(var(--primary))' }}
                      value={precoPraticado}
                      onChange={(e) => setPrecoPraticado(Math.max(0, parseFloat(e.target.value) || 0))}
                      disabled={!isAdmin}
                    />
                  </div>

                  {isAdmin && (
                    <button onClick={handleSavePrecificacao} className={styles.primaryBtn} style={{ marginTop: '16px', justifyContent: 'center' }}>
                      <Save size={16} />
                      Salvar Precificação & Ficha
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.contentCard} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
              <Info size={32} style={{ margin: '0 auto 12px', display: 'block' }} />
              Selecione um procedimento acima para editar e calcular margens.
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 5: DASHBOARD DE RENTABILIDADE
          ========================================================================= */}
      {activeTab === 'rentabilidade' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle}><TrendingUp size={16} style={{ color: 'hsl(var(--success))' }} /> Mais Rentável</div>
              <div className={styles.cardValue} style={{ fontSize: '16px', fontWeight: 700 }}>
                {rentabilidadeData.length > 0 ? rentabilidadeData[0].procedure_name : '-'}
              </div>
              <span style={{ fontSize: '12px', color: 'hsl(var(--success))', fontWeight: 600 }}>
                {rentabilidadeData.length > 0 ? `${rentabilidadeData[0].margem_realizada_pct}% de margem` : ''}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.cardTitle}><TrendingDown size={16} style={{ color: 'hsl(var(--danger))' }} /> Deficitários (Margem Negativa)</div>
              <div className={styles.cardValue} style={{ color: 'hsl(var(--danger))' }}>
                {rentabilidadeData.filter(r => r.margem_realizada_valor < 0).length}
              </div>
              <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Procedimentos operando no prejuízo</span>
            </div>
          </div>

          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Ranking de Lucratividade dos Procedimentos</h2>
              <button onClick={window.print} className={styles.secondaryBtn}>
                Imprimir Demonstrativo
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th>Especialidade</th>
                    <th>Custo Total</th>
                    <th>Preço Praticado</th>
                    <th>Margem (R$)</th>
                    <th>Margem (%)</th>
                    <th>Desempenho</th>
                  </tr>
                </thead>
                <tbody>
                  {rentabilidadeData.length > 0 ? (
                    rentabilidadeData.map(r => {
                      const isNeg = r.margem_realizada_valor < 0;
                      const isLow = r.margem_realizada_pct < 20 && !isNeg;

                      return (
                        <tr key={r.procedure_id} style={{ borderLeft: isNeg ? '4px solid hsl(var(--danger))' : 'none' }}>
                          <td style={{ fontWeight: 600 }}>{r.procedure_name}</td>
                          <td>{r.categoria_especialidade || 'Outros'}</td>
                          <td>R$ {Number(r.custo_total).toFixed(2)}</td>
                          <td style={{ fontWeight: 500 }}>R$ {Number(r.preco_praticado).toFixed(2)}</td>
                          <td style={{ fontWeight: 700, color: isNeg ? 'hsl(var(--danger))' : 'hsl(var(--success))' }}>
                            R$ {Number(r.margem_realizada_valor).toFixed(2)}
                          </td>
                          <td>
                            <span className={`${styles.profitBadge} ${isNeg ? styles.profitNegative : isLow ? styles.badgeWarning : styles.profitPositive}`}>
                              {r.margem_realizada_pct.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            {isNeg ? (
                              <span className={`${styles.badge} ${styles.badgeLowStock}`}>Prejuízo</span>
                            ) : isLow ? (
                              <span className={`${styles.badge} ${styles.badgeWarning}`}>Alerta</span>
                            ) : (
                              <span className={`${styles.badge} ${styles.badgeNormal}`}>Excelente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Nenhum procedimento precificado na unidade.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DRAWER: CADASTRAR/EDITAR INSUMO
          ========================================================================= */}
      <div className={`${styles.overlay} ${(isNewInsumoOpen || isEditInsumoOpen) ? styles.overlayActive : ''}`} onClick={() => { setIsNewInsumoOpen(false); setIsEditInsumoOpen(false); }} />
      <div className={`${styles.drawer} ${(isNewInsumoOpen || isEditInsumoOpen) ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>{isEditInsumoOpen ? 'Editar Material' : 'Cadastrar Novo Material'}</h3>
          <button className={styles.closeBtn} onClick={() => { setIsNewInsumoOpen(false); setIsEditInsumoOpen(false); }}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={isEditInsumoOpen ? handleEditInsumoSubmit : handleAddInsumoSubmit}>
          <div className={styles.formGroup}>
            <label>Nome do Insumo / Material</label>
            <input 
              type="text" 
              name="nome_insumo"
              autoComplete="off"
              className={styles.input}
              placeholder="Ex: Anestésico Mepivacaína 2%"
              value={formInsumo.nome}
              onChange={(e) => setFormInsumo({ ...formInsumo, nome: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Categoria</label>
            <select 
              className={styles.select}
              value={formInsumo.categoria}
              onChange={(e) => setFormInsumo({ ...formInsumo, categoria: e.target.value })}
            >
              <option value="Descartáveis">Descartáveis</option>
              <option value="Anestésicos">Anestésicos</option>
              <option value="Dentística">Dentística</option>
              <option value="Ortodontia">Ortodontia</option>
              <option value="Cirurgia">Cirurgia</option>
              <option value="Materiais de Escritório">Materiais de Escritório</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Unidade de Medida (Estoque)</label>
            <select 
              className={styles.select}
              value={formInsumo.unidade_medida}
              onChange={(e) => setFormInsumo({ ...formInsumo, unidade_medida: e.target.value })}
            >
              {unidadesMedida.map((u) => (
                <option key={u.id} value={u.nome}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Qtd. por Embalagem Comprada</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 1 (caixa)"
              value={formInsumo.quantidade_embalagem}
              onChange={(e) => setFormInsumo({ ...formInsumo, quantidade_embalagem: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Rendimento em Unidades de Uso</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 50 (50 agulhas ou 50 aplicações)"
              value={formInsumo.quantidade_rendimento}
              onChange={(e) => setFormInsumo({ ...formInsumo, quantidade_rendimento: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Preço Pago por Embalagem (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 120.00"
              value={formInsumo.preco_embalagem_atual}
              onChange={(e) => setFormInsumo({ ...formInsumo, preco_embalagem_atual: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Estoque Mínimo (Alerta)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 20"
              value={formInsumo.estoque_minimo}
              onChange={(e) => setFormInsumo({ ...formInsumo, estoque_minimo: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input 
              type="checkbox" 
              id="insumo_ativo"
              checked={formInsumo.ativo}
              onChange={(e) => setFormInsumo({ ...formInsumo, ativo: e.target.checked })}
            />
            <label htmlFor="insumo_ativo" style={{ fontSize: '13px', fontWeight: 500, userSelect: 'none' }}>Material Ativo no Catálogo</label>
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ marginTop: '12px', justifyContent: 'center' }}>
            {isEditInsumoOpen ? 'Salvar Alterações' : 'Gravar Material'}
          </button>
        </form>
      </div>

      {/* =========================================================================
          DRAWER: REGISTRAR COMPRA
          ========================================================================= */}
      <div className={`${styles.overlay} ${isNewCompraOpen ? styles.overlayActive : ''}`} onClick={() => setIsNewCompraOpen(false)} />
      <div className={`${styles.drawer} ${isNewCompraOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Registrar Entrada de Compra</h3>
          <button className={styles.closeBtn} onClick={() => setIsNewCompraOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleAddCompraSubmit}>
          <div className={styles.formGroup}>
            <label>Insumo Adquirido</label>
            <select 
              className={styles.select}
              value={formCompra.insumo_id}
              onChange={(e) => setFormCompra({ ...formCompra, insumo_id: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {insumos.filter(i => i.ativo).map(i => (
                <option key={i.id} value={i.id}>{i.nome}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Fornecedor</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: Dental Cremer"
              value={formCompra.fornecedor}
              onChange={(e) => setFormCompra({ ...formCompra, fornecedor: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Quantidade de Embalagens</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 5"
              value={formCompra.quantidade_comprada}
              onChange={(e) => setFormCompra({ ...formCompra, quantidade_comprada: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Preço Pago por Embalagem (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 45.00"
              value={formCompra.preco_pago_embalagem}
              onChange={(e) => setFormCompra({ ...formCompra, preco_pago_embalagem: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Nota Fiscal (Opcional)</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: NF-4923"
              value={formCompra.nota_fiscal}
              onChange={(e) => setFormCompra({ ...formCompra, nota_fiscal: e.target.value })}
            />
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ marginTop: '12px', justifyContent: 'center' }}>
            Confirmar Entrada
          </button>
        </form>
      </div>

      {/* =========================================================================
          DRAWER: NOVO CUSTO FIXO
          ========================================================================= */}
      <div className={`${styles.overlay} ${isNewCustoOpen ? styles.overlayActive : ''}`} onClick={() => setIsNewCustoOpen(false)} />
      <div className={`${styles.drawer} ${isNewCustoOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Adicionar Custo Fixo</h3>
          <button className={styles.closeBtn} onClick={() => setIsNewCustoOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleAddCustoSubmit}>
          <div className={styles.formGroup}>
            <label>Descrição do Custo</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: Aluguel da Clínica, Pro Labore, Internet"
              value={formCusto.nome_custo}
              onChange={(e) => setFormCusto({ ...formCusto, nome_custo: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Valor Mensal (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 2500.00"
              value={formCusto.valor_mensal}
              onChange={(e) => setFormCusto({ ...formCusto, valor_mensal: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input 
              type="checkbox" 
              id="custo_ativo"
              checked={formCusto.ativo}
              onChange={(e) => setFormCusto({ ...formCusto, ativo: e.target.checked })}
            />
            <label htmlFor="custo_ativo" style={{ fontSize: '13px', fontWeight: 500, userSelect: 'none' }}>Custo Ativo no Rateio</label>
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ marginTop: '12px', justifyContent: 'center' }}>
            Gravar Lançamento
          </button>
        </form>
      </div>

      {/* =========================================================================
          DRAWER: AJUSTE MANUAL DE ESTOQUE
          ========================================================================= */}
      <div className={`${styles.overlay} ${isAjusteManualOpen ? styles.overlayActive : ''}`} onClick={() => setIsAjusteManualOpen(false)} />
      <div className={`${styles.drawer} ${isAjusteManualOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Ajustar Estoque Manualmente</h3>
          <button className={styles.closeBtn} onClick={() => setIsAjusteManualOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleAjusteManualSubmit}>
          <div className={styles.formGroup}>
            <label>Material para Ajuste</label>
            <select 
              className={styles.select}
              value={formAjuste.insumo_id}
              onChange={(e) => setFormAjuste({ ...formAjuste, insumo_id: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {insumos.filter(i => i.ativo).map(i => (
                <option key={i.id} value={i.id}>{i.nome}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Tipo de Ajuste</label>
            <select 
              className={styles.select}
              value={formAjuste.tipo}
              onChange={(e) => setFormAjuste({ ...formAjuste, tipo: e.target.value })}
              required
            >
              <option value="saida">Saída (Subtrair do estoque)</option>
              <option value="entrada">Entrada (Adicionar ao estoque)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Quantidade de Ajuste (Uso Real)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 5"
              value={formAjuste.quantidade}
              onChange={(e) => setFormAjuste({ ...formAjuste, quantidade: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Motivo do Ajuste</label>
            <select 
              className={styles.select}
              value={formAjuste.motivo}
              onChange={(e) => setFormAjuste({ ...formAjuste, motivo: e.target.value })}
              required
            >
              <option value="perda">Perda / Desperdício / Vencimento</option>
              <option value="ajuste_manual">Ajuste de Inventário / Contagem</option>
              <option value="doacao">Doação / Empréstimo</option>
            </select>
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ marginTop: '12px', justifyContent: 'center' }}>
            Confirmar Ajuste
          </button>
        </form>
      </div>

      {/* =========================================================================
          DRAWER: GERENCIAR UNIDADES DE MEDIDA
          ========================================================================= */}
      <div className={`${styles.overlay} ${isUnidadesMedidaOpen ? styles.overlayActive : ''}`} onClick={() => setIsUnidadesMedidaOpen(false)} />
      <div className={`${styles.drawer} ${isUnidadesMedidaOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Gerenciar Unidades de Medida</h3>
          <button className={styles.closeBtn} onClick={() => setIsUnidadesMedidaOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 4px' }}>
          <form className={styles.form} onSubmit={handleSaveUnit} style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '20px' }}>
            <div className={styles.formGroup}>
              <label>{editingUnitId ? 'Editar Unidade de Medida' : 'Nova Unidade de Medida'}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder="Ex: bisnaga, rolo, pacote"
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                  required
                />
                <button type="submit" className={styles.primaryBtn} style={{ whiteSpace: 'nowrap' }}>
                  {editingUnitId ? 'Salvar' : 'Adicionar'}
                </button>
                {editingUnitId && (
                  <button 
                    type="button" 
                    className={styles.secondaryBtn} 
                    onClick={() => { setEditingUnitId(null); setUnitInput(''); }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </form>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--text-main))' }}>Unidades Cadastradas</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {unidadesMedida.map((u) => (
                <div 
                  key={u.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    backgroundColor: 'hsl(var(--bg-card))', 
                    borderRadius: 'var(--radius-xs)', 
                    border: '1px solid hsl(var(--border-color))' 
                  }}
                >
                  <span style={{ textTransform: 'lowercase', fontWeight: 500, color: 'hsl(var(--text-main))' }}>{u.nome}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => { setEditingUnitId(u.id); setUnitInput(u.nome); }} 
                      className={styles.closeBtn} 
                      title="Editar"
                      style={{ padding: '4px' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    {u.nome !== 'unidade' && (
                      <button 
                        onClick={() => handleDeleteUnit(u.id, u.nome)} 
                        className={styles.removeBtn} 
                        title="Excluir"
                        style={{ padding: '4px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL: ZERAR / REINICIAR ESTOQUE (COMEÇAR DO ZERO)
          ========================================================================= */}
      <div className={`${styles.overlay} ${isZerarEstoqueOpen ? styles.overlayActive : ''}`} onClick={() => setIsZerarEstoqueOpen(false)} />
      <div className={`${styles.drawer} ${isZerarEstoqueOpen ? styles.drawerActive : ''}`} style={{ maxWidth: '500px' }}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle} style={{ color: 'hsl(var(--danger))', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={20} />
            Zerar ou Reiniciar Estoque
          </h3>
          <button className={styles.closeBtn} onClick={() => setIsZerarEstoqueOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleZerarEstoqueSubmit}>
          <div className={styles.alertBox} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'hsl(var(--danger))' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Atenção: Ação irreversível!</strong>
              <p>Escolha como deseja resetar o controle de materiais da clínica:</p>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label style={{ fontWeight: 600, marginBottom: '8px' }}>Modo de Reinício:</label>
            
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', padding: '10px', border: '1px solid hsl(var(--border-color))', borderRadius: '8px', marginBottom: '8px' }}>
              <input 
                type="radio" 
                name="zerarMode" 
                value="apagar_tudo"
                checked={zerarMode === 'apagar_tudo'}
                onChange={() => setZerarMode('apagar_tudo')}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong style={{ color: 'hsl(var(--danger))' }}>Apagar tudo e começar do zero (Recomendado)</strong>
                <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', margin: '2px 0 0 0' }}>
                  Exclui todos os materiais de teste, compras e histórico para você cadastrar os materiais reais da clínica do zero.
                </p>
              </div>
            </label>

            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', padding: '10px', border: '1px solid hsl(var(--border-color))', borderRadius: '8px' }}>
              <input 
                type="radio" 
                name="zerarMode" 
                value="zerar_saldos"
                checked={zerarMode === 'zerar_saldos'}
                onChange={() => setZerarMode('zerar_saldos')}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong>Manter materiais e zerar saldos</strong>
                <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', margin: '2px 0 0 0' }}>
                  Mantém a lista de materiais cadastrados, mas redefine todas as quantidades em estoque para 0,00.
                </p>
              </div>
            </label>
          </div>

          <div className={styles.formGroup}>
            <label>Para confirmar, digite <strong>ZERAR</strong> abaixo:</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Digite ZERAR para confirmar"
              value={zerarConfirmInput}
              onChange={(e) => setZerarConfirmInput(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button 
              type="button" 
              className={styles.secondaryBtn} 
              onClick={() => setIsZerarEstoqueOpen(false)}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={styles.removeBtn} 
              disabled={isZerando || zerarConfirmInput.trim().toUpperCase() !== 'ZERAR'}
              style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
            >
              {isZerando ? 'Processando...' : 'Confirmar e Resetar'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
