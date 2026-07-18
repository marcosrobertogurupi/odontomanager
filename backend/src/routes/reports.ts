import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/reports/procedure-profitability - Relatório consolidado de custo e margem por procedimento
router.get('/procedure-profitability', async (req, res, next) => {
  const { unit_id, competencia } = req.query;
  if (!unit_id || !competencia) {
    return res.status(400).json({ error: 'unit_id and competencia are required' });
  }

  const [monthStr, yearStr] = (competencia as string).split('/');
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    // 1. Buscar todos os procedimentos
    const { data: procedures, error: procError } = await supabase
      .from('procedures')
      .select('*')
      .order('name');

    if (procError) throw procError;

    // 2. Buscar todas as fichas técnicas (BOM)
    const { data: boms, error: bomError } = await supabase
      .from('procedimento_insumos')
      .select(`
        *,
        insumo:insumos(*)
      `);

    if (bomError) throw bomError;

    // 3. Buscar saldos e custo médio atual de estoque para a unidade
    const { data: estoque, error: estError } = await supabase
      .from('estoque_unidade')
      .select('*')
      .eq('unit_id', unit_id);

    if (estError) throw estError;

    // 4. Buscar custos fixos totais da unidade no mês
    const { data: custosFixos, error: cfError } = await supabase
      .from('custos_fixos')
      .select('valor')
      .eq('unidade_id', unit_id)
      .eq('competencia', competencia);

    if (cfError) throw cfError;

    const totalCustosFixos = (custosFixos || []).reduce((acc: number, curr: any) => acc + Number(curr.valor), 0);

    // 5. Contar agendamentos realizados no mês
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
    // Fim do mês (aproximado/simplificado)
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const endOfMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;

    const { count: totalRealizados, error: countError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('unit_id', unit_id)
      .eq('status', 'confirmed')
      .gte('start_time', startOfMonth)
      .lt('start_time', endOfMonth);

    if (countError) throw countError;

    const divisorProcedimentos = (totalRealizados && totalRealizados > 0) ? totalRealizados : 1;
    const custoFixoRateado = totalCustosFixos / divisorProcedimentos;

    // 6. Montar o relatório consolidado
    const report = (procedures || []).map((proc: any) => {
      // Insumos do procedimento
      const procBoms = (boms || []).filter((b: any) => b.procedimento_id === proc.id);
      
      const custoMaterial = procBoms.reduce((acc: number, item: any) => {
        const estItem = (estoque || []).find((e: any) => e.insumo_id === item.insumo_id);
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

    res.json(report);
  } catch (err) {
    console.warn('[Reports Route] Fallback mock para relatório de rentabilidade:', (err as Error).message);
    
    // Cálculo mockado
    const procedures = mockStore.getProcedures();
    const cfList = mockStore.getCustosFixos(unit_id as string, competencia as string);
    const totalCustosFixos = cfList.reduce((acc, curr) => acc + curr.valor, 0);

    // Contar consultas mockadas no período
    const appList = mockStore.getAppointments().filter(app => {
      if (app.unit_id !== unit_id || app.status !== 'confirmed') return false;
      const appDate = new Date(app.start_time);
      const appComp = `${String(appDate.getMonth() + 1).padStart(2, '0')}/${appDate.getFullYear()}`;
      return appComp === competencia;
    });

    const divisorProcedimentos = appList.length > 0 ? appList.length : 1;
    const custoFixoRateado = totalCustosFixos / divisorProcedimentos;

    const report = procedures.map(proc => {
      const procBoms = mockStore.getProcedimentoInsumos(proc.id);
      
      const custoMaterial = procBoms.reduce((acc, item) => {
        const est = mockStore.estoqueUnidade.find(e => e.insumo_id === item.insumo_id && e.unit_id === unit_id);
        const custoUnitario = est ? est.custo_medio : 0;
        return acc + (item.quantidade_padrao * custoUnitario);
      }, 0);

      const custoTotal = custoMaterial + custoFixoRateado;
      const valorCobrado = proc.price;
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

    res.json(report);
  }
});

export default router;
