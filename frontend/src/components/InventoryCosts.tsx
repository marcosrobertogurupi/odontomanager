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
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './InventoryCosts.module.css';

interface InventoryCostsProps {
  selectedUnit: string;
}

export default function InventoryCosts({ selectedUnit }: InventoryCostsProps) {
  const { activeTenant, role } = useTenant();
  const [activeTab, setActiveTab] = useState<'estoque' | 'compras' | 'custos' | 'bom' | 'margens'>('estoque');
  
  // Estados de dados
  const [insumos, setInsumos] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [custosFixos, setCustosFixos] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [bomItems, setBomItems] = useState<any[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [competence, setCompetence] = useState('07/2026'); // Valor de seed para teste
  
  // Drawers
  const [isNewInsumoOpen, setIsNewInsumoOpen] = useState(false);
  const [isNewCompraOpen, setIsNewCompraOpen] = useState(false);
  const [isNewCustoOpen, setIsNewCustoOpen] = useState(false);

  // Forms
  const [formInsumo, setFormInsumo] = useState({ nome: '', unidade_medida: 'unidade', estoque_minimo: '', categoria: 'Descartáveis' });
  const [formCompra, setFormCompra] = useState({ insumo_id: '', fornecedor: '', quantidade: '', valor_total: '', nota_fiscal: '' });
  const [formCusto, setFormCusto] = useState({ nome: '', tipo: 'fixo_mensal' as any, valor: '', competencia: '07/2026' });

  // Funções de busca
  const fetchInsumos = async () => {
    if (!activeTenant || !selectedUnit) return;
    setLoading(true);
    try {
      const { data: insumosData, error } = await supabase
        .from('insumos')
        .select(`
          *,
          estoque_unidade (
            quantidade_atual,
            custo_medio,
            unit_id
          )
        `)
        .eq('tenant_id', activeTenant.id)
        .order('nome');

      if (error) throw error;

      const formatted = (insumosData || []).map((i: any) => {
        const est = i.estoque_unidade?.find((e: any) => e.unit_id === selectedUnit);
        return {
          id: i.id,
          nome: i.nome,
          unidade_medida: i.unidade_medida,
          estoque_minimo: i.estoque_minimo,
          categoria: i.categoria,
          status: i.status,
          quantidade_atual: est ? Number(est.quantidade_atual) : 0,
          custo_medio: est ? Number(est.custo_medio) : 0
        };
      });

      setInsumos(formatted);
    } catch (err) {
      console.error('Erro ao buscar insumos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select(`
          *,
          insumo:insumos (
            nome,
            unidade_medida
          )
        `)
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .order('data', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error('Erro ao buscar movimentações:', err);
    }
  };

  const fetchCustosFixos = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unidade_id', selectedUnit)
        .eq('competencia', competence);

      if (error) throw error;
      setCustosFixos(data || []);
    } catch (err) {
      console.error('Erro ao buscar custos fixos:', err);
    }
  };

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

  const fetchBOM = async (procId: string) => {
    if (!activeTenant) return;
    if (!procId) return setBomItems([]);
    try {
      const { data, error } = await supabase
        .from('procedimento_insumos')
        .select(`
          *,
          insumo:insumos(*)
        `)
        .eq('procedimento_id', procId)
        .eq('tenant_id', activeTenant.id);

      if (error) throw error;
      setBomItems((data || []).map((item: any) => ({
        insumo_id: item.insumo_id,
        quantidade_padrao: item.quantidade_padrao
      })));
    } catch (err) {
      console.error('Erro ao buscar BOM:', err);
    }
  };

  const fetchReport = async () => {
    if (!activeTenant || !selectedUnit || !competence) return;
    try {
      // 1. Buscar procedimentos
      const { data: procs, error: procErr } = await supabase
        .from('procedures')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (procErr) throw procErr;

      // 2. Buscar boms
      const { data: boms, error: bomErr } = await supabase
        .from('procedimento_insumos')
        .select(`
          *,
          insumo:insumos(*)
        `)
        .eq('tenant_id', activeTenant.id);
      if (bomErr) throw bomErr;

      // 3. Buscar saldos de estoque da unidade
      const { data: est, error: estErr } = await supabase
        .from('estoque_unidade')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit);
      if (estErr) throw estErr;

      // 4. Buscar custos fixos da unidade no mês
      const { data: cFixos, error: cfErr } = await supabase
        .from('custos_fixos')
        .select('valor')
        .eq('tenant_id', activeTenant.id)
        .eq('unidade_id', selectedUnit)
        .eq('competencia', competence);
      if (cfErr) throw cfErr;

      const totalCustosFixos = (cFixos || []).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);

      // 5. Contar agendamentos confirmados (realizados) no mês
      const [monthStr, yearStr] = competence.split('/');
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextMonthYear = month === 12 ? year + 1 : year;
      const endOfMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;

      const { count: totalRealizados, error: countError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .eq('status', 'confirmed')
        .gte('start_time', startOfMonth)
        .lt('start_time', endOfMonth);

      if (countError) throw countError;

      const divisorProcedimentos = (totalRealizados && totalRealizados > 0) ? totalRealizados : 1;
      const custoFixoRateado = totalCustosFixos / divisorProcedimentos;

      // 6. Consolidar relatório
      const report = (procs || []).map((proc: any) => {
        const procBoms = (boms || []).filter((b: any) => b.procedimento_id === proc.id);
        const custoMaterial = procBoms.reduce((acc: number, item: any) => {
          const estItem = (est || []).find((e: any) => e.insumo_id === item.insumo_id);
          const custoUnitario = estItem ? Number(estItem.custo_medio) : 0;
          return acc + (Number(item.quantidade_padrao) * custoUnitario);
        }, 0);

        const custoTotal = custoMaterial + custoFixoRateado;
        const valorCobrado = Number(proc.price);
        const margemPercentual = valorCobrado > 0 ? ((valorCobrado - custoTotal) / valorCobrado) * 100 : 0;

        return {
          procedimento_id: proc.id,
          procedimento_nome: proc.name,
          valor_cobrado: valorCobrado,
          custo_material: custoMaterial,
          custo_fixo_rateado: custoFixoRateado,
          custo_total: custoTotal,
          margem_percentual: Number(margemPercentual.toFixed(2))
        };
      });

      setReportData(report);
    } catch (err) {
      console.error('Erro ao gerar relatório de lucratividade:', err);
    }
  };

  useEffect(() => {
    if (activeTenant && selectedUnit) {
      fetchInsumos();
      fetchMovements();
      fetchProcedures();
    }
  }, [selectedUnit, activeTenant]);

  useEffect(() => {
    if (activeTenant && selectedUnit && (activeTab === 'custos' || activeTab === 'margens')) {
      fetchCustosFixos();
      fetchReport();
    }
  }, [selectedUnit, competence, activeTab, activeTenant]);

  // Cadastro de novo insumo
  const handleAddInsumoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    if (!formInsumo.nome || !formInsumo.estoque_minimo) return;

    try {
      const { error } = await supabase
        .from('insumos')
        .insert([{
          nome: formInsumo.nome,
          unidade_medida: formInsumo.unidade_medida,
          estoque_minimo: Number(formInsumo.estoque_minimo),
          categoria: formInsumo.categoria,
          status: 'ativo',
          tenant_id: activeTenant.id
        }]);

      if (error) throw error;
      setIsNewInsumoOpen(false);
      fetchInsumos();
      setFormInsumo({ nome: '', unidade_medida: 'unidade', estoque_minimo: '', categoria: 'Descartáveis' });
    } catch (err: any) {
      console.error('Erro ao adicionar insumo:', err);
      alert('Erro ao adicionar insumo: ' + err.message);
    }
  };

  // Cadastro de nova compra
  const handleAddCompraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    const { insumo_id, fornecedor, quantidade, valor_total, nota_fiscal } = formCompra;
    if (!insumo_id || !fornecedor || !quantidade || !valor_total) return;

    const valor_unitario = Number(valor_total) / Number(quantidade);

    try {
      const { error } = await supabase.rpc('processar_compra_estoque', {
        p_insumo_id: insumo_id,
        p_unit_id: selectedUnit,
        p_fornecedor: fornecedor,
        p_quantidade: Number(quantidade),
        p_valor_total: Number(valor_total),
        p_valor_unitario: valor_unitario,
        p_nota_fiscal: nota_fiscal || null,
        p_tenant_id: activeTenant.id
      });

      if (error) throw error;

      setIsNewCompraOpen(false);
      fetchInsumos();
      fetchMovements();
      setFormCompra({ insumo_id: '', fornecedor: '', quantidade: '', valor_total: '', nota_fiscal: '' });
      alert('Entrada registrada e custo médio atualizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao processar compra de estoque:', err);
      alert('Erro ao registrar compra: ' + err.message);
    }
  };

  // Cadastro de custo fixo
  const handleAddCustoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    if (!formCusto.nome || !formCusto.valor || !formCusto.competencia) return;

    try {
      const { error } = await supabase
        .from('custos_fixos')
        .insert([{
          nome: formCusto.nome,
          tipo: formCusto.tipo,
          valor: Number(formCusto.valor),
          competencia: formCusto.competencia,
          unidade_id: selectedUnit,
          tenant_id: activeTenant.id
        }]);

      if (error) throw error;

      setIsNewCustoOpen(false);
      fetchCustosFixos();
      fetchReport();
      setFormCusto({ nome: '', tipo: 'fixo_mensal', valor: '', competencia: competence });
    } catch (err: any) {
      console.error('Erro ao adicionar custo fixo:', err);
      alert('Erro ao cadastrar custo: ' + err.message);
    }
  };

  // Salvar Ficha Técnica (BOM)
  const handleSaveBOM = async () => {
    if (!activeTenant || !selectedProcedure) return;
    
    try {
      // 1. Remover registros antigos
      const { error: deleteError } = await supabase
        .from('procedimento_insumos')
        .delete()
        .eq('procedimento_id', selectedProcedure)
        .eq('tenant_id', activeTenant.id);

      if (deleteError) throw deleteError;

      // 2. Inserir novos registros
      if (bomItems && bomItems.length > 0) {
        const insertRows = bomItems.map((item: any) => ({
          procedimento_id: selectedProcedure,
          insumo_id: item.insumo_id,
          quantidade_padrao: Number(item.quantidade_padrao),
          tenant_id: activeTenant.id
        }));

        const { error: insertError } = await supabase
          .from('procedimento_insumos')
          .insert(insertRows);

        if (insertError) throw insertError;
      }

      alert('Ficha Técnica (BOM) atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar ficha técnica:', err);
      alert('Erro ao atualizar BOM: ' + err.message);
    }
  };

  const handleAddBOMRow = () => {
    setBomItems([...bomItems, { insumo_id: '', quantidade_padrao: 1 }]);
  };

  const handleRemoveBOMRow = (idx: number) => {
    setBomItems(bomItems.filter((_, i) => i !== idx));
  };

  const handleBOMChange = (idx: number, field: string, val: any) => {
    const updated = [...bomItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setBomItems(updated);
  };

  // Verifica se há alertas de estoque mínimo
  const lowStockInsumos = insumos.filter(i => i.quantidade_atual < i.estoque_minimo);

  // Segurança de dados financeiros
  const isAdmin = role === 'admin' || role === 'clinic_owner' || role === 'super_admin';

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.title}>Custos & Estoque</h1>
          <p className={styles.subtitle}>Gerenciamento inteligente de insumos clínicos, fichas técnicas e rateios.</p>
        </div>
        
        <div className={styles.roleToggle}>
          <span>Perfil Ativo: </span>
          <strong style={{ textTransform: 'capitalize', marginLeft: '6px', color: 'hsl(var(--primary))' }}>
            {role === 'clinic_owner' ? 'Proprietário' : role === 'admin' ? 'Administrador' : role === 'dentist' ? 'Dentista' : role === 'receptionist' ? 'Recepcionista' : role}
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
          Estoque Atual
        </button>
        <button 
          onClick={() => setActiveTab('compras')} 
          className={`${styles.tabButton} ${activeTab === 'compras' ? styles.activeTab : ''}`}
        >
          <History size={16} />
          Compras & Entradas
        </button>
        <button 
          onClick={() => setActiveTab('bom')} 
          className={`${styles.tabButton} ${activeTab === 'bom' ? styles.activeTab : ''}`}
        >
          <SlidersHorizontal size={16} />
          Fichas Técnicas (BOM)
        </button>
        <button 
          onClick={() => setActiveTab('custos')} 
          className={`${styles.tabButton} ${activeTab === 'custos' ? styles.activeTab : ''}`}
        >
          <DollarSign size={16} />
          Custos Fixos
        </button>
        <button 
          onClick={() => setActiveTab('margens')} 
          className={`${styles.tabButton} ${activeTab === 'margens' ? styles.activeTab : ''}`}
        >
          <LineChart size={16} />
          Custos & Margens por Procedimento
        </button>
      </div>

      {/* Alerta Geral de Estoque Mínimo */}
      {activeTab === 'estoque' && lowStockInsumos.length > 0 && (
        <div className={styles.alertBox}>
          <AlertTriangle size={20} />
          <div>
            <strong>Alerta de Reabastecimento!</strong>
            <p>Os seguintes insumos estão abaixo do estoque mínimo: {lowStockInsumos.map(i => `${i.nome} (${i.quantidade_atual} ${i.unidade_medida}s)`).join(', ')}.</p>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 1: ESTOQUE ATUAL
          ========================================================================= */}
      {activeTab === 'estoque' && (
        <div className={styles.contentCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Saldo de Insumos</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={fetchInsumos} className={styles.secondaryBtn} title="Recarregar saldos">
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
              <button onClick={() => setIsNewInsumoOpen(true)} className={styles.primaryBtn}>
                <Plus size={14} />
                <span>Novo Insumo</span>
              </button>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoria</th>
                  <th>Unidade Medida</th>
                  <th>Estoque Mínimo</th>
                  <th>Saldo Atual</th>
                  <th>Custo Médio Ponderado</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {insumos.length > 0 ? (
                  insumos.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontWeight: '600' }}>{i.nome}</td>
                      <td>{i.categoria || 'Geral'}</td>
                      <td>{i.unidade_medida}</td>
                      <td>{i.estoque_minimo}</td>
                      <td style={{ fontWeight: '700' }}>
                        <span className={i.quantidade_atual < i.estoque_minimo ? styles.profitNegative : ''}>
                          {i.quantidade_atual}
                        </span>
                        {i.quantidade_atual < i.estoque_minimo && (
                          <span className={`${styles.badge} ${styles.badgeLowStock}`} style={{ marginLeft: '8px' }}>
                            Abaixo do Mínimo
                          </span>
                        )}
                      </td>
                      <td>R$ {Number(i.custo_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`${styles.badge} ${i.status === 'ativo' ? styles.badgeNormal : styles.badgeLowStock}`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Nenhum insumo cadastrado ou carregando...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: COMPRAS & ENTRADAS (RESTRITO ADMIN)
          ========================================================================= */}
      {activeTab === 'compras' && (
        !isAdmin ? (
          <div className={styles.contentCard}>
            <div className={styles.restrictedArea}>
              <Lock size={48} style={{ color: 'hsl(var(--danger))' }} />
              <h3 className={styles.restrictedTitle}>Acesso Restrito</h3>
              <p className={styles.restrictedText}>A visualização de registros de compras e lançamentos de custo médio é confidencial e permitida apenas para Administradores.</p>
            </div>
          </div>
        ) : (
          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Histórico de Compras & Movimentações</h2>
              <button onClick={() => setIsNewCompraOpen(true)} className={styles.primaryBtn}>
                <Plus size={14} />
                <span>Registrar Entrada</span>
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Insumo</th>
                    <th>Tipo</th>
                    <th>Origem</th>
                    <th>Quantidade</th>
                    <th>Unidade Medida</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length > 0 ? (
                    movements.map((mov, idx) => (
                      <tr key={mov.id || idx}>
                        <td>{new Date(mov.data).toLocaleString('pt-BR')}</td>
                        <td style={{ fontWeight: '500' }}>{mov.insumo?.nome}</td>
                        <td>
                          <span className={`${styles.badge} ${
                            mov.tipo === 'entrada' ? styles.badgeNormal : 
                            mov.tipo === 'saida' ? styles.badgeLowStock : 
                            styles.badgeWarning
                          }`}>
                            {mov.tipo}
                          </span>
                        </td>
                        <td>{mov.origem}</td>
                        <td style={{ fontWeight: '600' }}>
                          {mov.tipo === 'saida' ? '-' : '+'}{mov.quantidade}
                        </td>
                        <td>{mov.insumo?.unidade_medida}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>Nenhuma movimentação registrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* =========================================================================
          ABA 3: FICHAS TÉCNICAS (BOM)
          ========================================================================= */}
      {activeTab === 'bom' && (
        <div className={styles.contentCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Composição dos Procedimentos (BOM)</h2>
          </div>

          <div className={styles.formGroup} style={{ maxWidth: '400px' }}>
            <label>Selecione um Procedimento</label>
            <select 
              className={styles.select}
              value={selectedProcedure}
              onChange={(e) => {
                setSelectedProcedure(e.target.value);
                fetchBOM(e.target.value);
              }}
            >
              <option value="">Selecione o procedimento...</option>
              {procedures.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {selectedProcedure && (
            <div className={styles.bomList}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginTop: '12px' }}>Insumos Consumidos (Padrão)</h3>
              
              {bomItems.map((item, idx) => (
                <div key={idx} className={styles.bomGrid}>
                  <select 
                    className={styles.select}
                    value={item.insumo_id}
                    onChange={(e) => handleBOMChange(idx, 'insumo_id', e.target.value)}
                  >
                    <option value="">Selecione o Insumo...</option>
                    {insumos.map(i => (
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="Qtd padrão" 
                    className={styles.input}
                    value={item.quantidade_padrao}
                    onChange={(e) => handleBOMChange(idx, 'quantidade_padrao', e.target.value)}
                  />
                  <button onClick={() => handleRemoveBOMRow(idx)} className={styles.removeBtn}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleAddBOMRow} className={styles.secondaryBtn}>
                  Adicionar Insumo
                </button>
                <button onClick={handleSaveBOM} className={styles.primaryBtn}>
                  Salvar Ficha Técnica
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 4: CUSTOS FIXOS (RESTRITO ADMIN)
          ========================================================================= */}
      {activeTab === 'custos' && (
        !isAdmin ? (
          <div className={styles.contentCard}>
            <div className={styles.restrictedArea}>
              <Lock size={48} style={{ color: 'hsl(var(--danger))' }} />
              <h3 className={styles.restrictedTitle}>Acesso Restrito</h3>
              <p className={styles.restrictedText}>A visualização e cadastro de custos fixos e folha de pagamento são permitidos apenas para Administradores.</p>
            </div>
          </div>
        ) : (
          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 className={styles.sectionTitle}>Despesas & Custos Recorrentes</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>Competência:</span>
                  <input 
                    type="text" 
                    placeholder="MM/YYYY" 
                    className={styles.input}
                    style={{ width: '100px', padding: '4px 8px' }}
                    value={competence}
                    onChange={(e) => setCompetence(e.target.value)}
                  />
                </div>
              </div>
              <button onClick={() => setIsNewCustoOpen(true)} className={styles.primaryBtn}>
                <Plus size={14} />
                <span>Lançar Custo Fixo</span>
              </button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome da Despesa</th>
                    <th>Tipo</th>
                    <th>Competência</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {custosFixos.length > 0 ? (
                    custosFixos.map(cf => (
                      <tr key={cf.id}>
                        <td style={{ fontWeight: '600' }}>{cf.nome}</td>
                        <td>{cf.tipo}</td>
                        <td>{cf.competencia}</td>
                        <td style={{ fontWeight: '700', color: 'hsl(var(--danger))' }}>
                          R$ {Number(cf.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>Nenhum custo fixo registrado para esta competência.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* =========================================================================
          ABA 5: RELATÓRIO DE CUSTOS E MARGENS (RESTRITO ADMIN)
          ========================================================================= */}
      {activeTab === 'margens' && (
        !isAdmin ? (
          <div className={styles.contentCard}>
            <div className={styles.restrictedArea}>
              <Lock size={48} style={{ color: 'hsl(var(--danger))' }} />
              <h3 className={styles.restrictedTitle}>Acesso Restrito</h3>
              <p className={styles.restrictedText}>Relatórios consolidados de custos, rateios e margens por procedimento só podem ser visualizados por Administradores.</p>
            </div>
          </div>
        ) : (
          <div className={styles.contentCard}>
            <div className={styles.sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 className={styles.sectionTitle}>Demonstrativo de Rentabilidade por Procedimento</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>Competência:</span>
                  <input 
                    type="text" 
                    placeholder="MM/YYYY" 
                    className={styles.input}
                    style={{ width: '100px', padding: '4px 8px' }}
                    value={competence}
                    onChange={(e) => setCompetence(e.target.value)}
                  />
                </div>
              </div>
              <button onClick={() => window.print()} className={styles.secondaryBtn}>
                <span>Imprimir / Exportar PDF</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', background: 'hsl(var(--bg-app))', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'hsl(var(--text-muted))', alignItems: 'center' }}>
              <Info size={16} />
              <span><strong>Método de Rateio Simplificado:</strong> O custo fixo do mês (folha de pagamento, aluguel, energia) é somado e dividido pelo total de procedimentos confirmados no mesmo mês. Deixado preparado na V1 para suportar futuros rateios por tempo de cadeira.</span>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Procedimento</th>
                    <th>Valor Cobrado</th>
                    <th>Custo Material (BOM)</th>
                    <th>Custo Fixo Rateado</th>
                    <th>Custo Total</th>
                    <th>Lucro Sugerido</th>
                    <th>Margem (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.length > 0 ? (
                    reportData.map(row => {
                      const lucro = row.valor_cobrado - row.custo_total;
                      return (
                        <tr key={row.procedimento_id}>
                          <td style={{ fontWeight: '600' }}>{row.procedimento_nome}</td>
                          <td style={{ fontWeight: '500' }}>
                            R$ {Number(row.valor_cobrado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td>R$ {Number(row.custo_material).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td>R$ {Number(row.custo_fixo_rateado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td style={{ fontWeight: '600' }}>
                            R$ {Number(row.custo_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontWeight: '600', color: lucro >= 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                            R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span className={`${styles.profitBadge} ${row.margem_percentual >= 30 ? styles.profitPositive : styles.profitNegative}`}>
                              {row.margem_percentual}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Nenhum dado financeiro para demonstrar nesta competência.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* =========================================================================
          DRAWER: NOVO INSUMO
          ========================================================================= */}
      <div className={`${styles.overlay} ${isNewInsumoOpen ? styles.overlayActive : ''}`} onClick={() => setIsNewInsumoOpen(false)} />
      <div className={`${styles.drawer} ${isNewInsumoOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Cadastrar Novo Insumo</h3>
          <button className={styles.closeBtn} onClick={() => setIsNewInsumoOpen(false)}>
            <RefreshCw size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleAddInsumoSubmit}>
          <div className={styles.formGroup}>
            <label>Nome do Insumo</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: Resina Composta Z350"
              value={formInsumo.nome}
              onChange={(e) => setFormInsumo({ ...formInsumo, nome: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Unidade de Medida</label>
            <select 
              className={styles.select}
              value={formInsumo.unidade_medida}
              onChange={(e) => setFormInsumo({ ...formInsumo, unidade_medida: e.target.value })}
            >
              <option value="unidade">Unidade</option>
              <option value="ml">ml</option>
              <option value="caixa">Caixa</option>
              <option value="mg">mg</option>
              <option value="grama">Grama</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Estoque Mínimo (Alerta)</label>
            <input 
              type="number" 
              className={styles.input}
              placeholder="Ex: 10"
              value={formInsumo.estoque_minimo}
              onChange={(e) => setFormInsumo({ ...formInsumo, estoque_minimo: e.target.value })}
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
            </select>
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ marginTop: '12px', justifyContent: 'center' }}>
            Salvar Insumo
          </button>
        </form>
      </div>

      {/* =========================================================================
          DRAWER: REGISTRAR COMPRA (RESTRITO ADMIN)
          ========================================================================= */}
      <div className={`${styles.overlay} ${isNewCompraOpen ? styles.overlayActive : ''}`} onClick={() => setIsNewCompraOpen(false)} />
      <div className={`${styles.drawer} ${isNewCompraOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Registrar Compra de Insumo</h3>
          <button className={styles.closeBtn} onClick={() => setIsNewCompraOpen(false)}>
            <RefreshCw size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleAddCompraSubmit}>
          <div className={styles.formGroup}>
            <label>Selecione o Insumo</label>
            <select 
              className={styles.select}
              value={formCompra.insumo_id}
              onChange={(e) => setFormCompra({ ...formCompra, insumo_id: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {insumos.map(i => (
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
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Quantidade Comprada</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 50"
              value={formCompra.quantidade}
              onChange={(e) => setFormCompra({ ...formCompra, quantidade: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Valor Total da Compra (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 120.00"
              value={formCompra.valor_total}
              onChange={(e) => setFormCompra({ ...formCompra, valor_total: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Nota Fiscal (Opcional)</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: NF-23423"
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
          DRAWER: NOVO CUSTO FIXO (RESTRITO ADMIN)
          ========================================================================= */}
      <div className={`${styles.overlay} ${isNewCustoOpen ? styles.overlayActive : ''}`} onClick={() => setIsNewCustoOpen(false)} />
      <div className={`${styles.drawer} ${isNewCustoOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Lançar Despesa Fixa</h3>
          <button className={styles.closeBtn} onClick={() => setIsNewCustoOpen(false)}>
            <RefreshCw size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleAddCustoSubmit}>
          <div className={styles.formGroup}>
            <label>Nome do Custo / Serviço</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: Aluguel da Sala"
              value={formCusto.nome}
              onChange={(e) => setFormCusto({ ...formCusto, nome: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Tipo</label>
            <select 
              className={styles.select}
              value={formCusto.tipo}
              onChange={(e) => setFormCusto({ ...formCusto, tipo: e.target.value as any })}
            >
              <option value="fixo_mensal">Fixo Mensal</option>
              <option value="variavel">Variável Operacional</option>
              <option value="recorrente">Recorrente (Folha PG)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Valor (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className={styles.input}
              placeholder="Ex: 1500.00"
              value={formCusto.valor}
              onChange={(e) => setFormCusto({ ...formCusto, valor: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Competência (Mês/Ano)</label>
            <input 
              type="text" 
              className={styles.input}
              placeholder="Ex: 07/2026"
              value={formCusto.competencia}
              onChange={(e) => setFormCusto({ ...formCusto, competencia: e.target.value })}
              required
            />
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ marginTop: '12px', justifyContent: 'center' }}>
            Confirmar Lançamento
          </button>
        </form>
      </div>
    </div>
  );
}
