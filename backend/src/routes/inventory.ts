import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/inventory - Listar insumos e saldos por unidade
router.get('/', async (req, res, next) => {
  const { unit_id } = req.query;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data: insumos, error } = await supabase
      .from('insumos')
      .select(`
        *,
        estoque_unidade (
          quantidade_atual,
          unit_id
        )
      `)
      .order('nome');

    if (error) throw error;

    const formatted = (insumos || []).map((i: any) => {
      const est = i.estoque_unidade?.find((e: any) => e.unit_id === unit_id);
      const rendimento = Number(i.quantidade_rendimento || 1);
      const precoEmbalagem = Number(i.preco_embalagem_atual || 0);
      return {
        id: i.id,
        nome: i.nome,
        unidade_medida: i.unidade_medida,
        estoque_minimo: i.estoque_minimo,
        categoria: i.categoria,
        ativo: i.ativo,
        status: i.ativo ? 'ativo' : 'inativo',
        quantidade_atual: est ? Number(est.quantidade_atual) : 0,
        custo_medio: rendimento > 0 ? precoEmbalagem / rendimento : 0
      };
    });

    res.json(formatted);
  } catch (err) {
    console.warn('[Inventory Route] Fallback mock para listar insumos:', (err as Error).message);
    res.json(mockStore.getInsumos(unit_id as string));
  }
});

// POST /api/inventory - Cadastrar novo insumo
router.post('/', async (req, res, next) => {
  const { nome, unidade_medida, estoque_minimo, categoria, status, ativo, tenant_id, quantidade_embalagem, quantidade_rendimento, preco_embalagem_atual } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('insumos')
      .insert([{
        tenant_id,
        nome,
        unidade_medida,
        estoque_minimo: Number(estoque_minimo || 0),
        categoria,
        quantidade_embalagem: Number(quantidade_embalagem || 1),
        quantidade_rendimento: Number(quantidade_rendimento || 1),
        preco_embalagem_atual: Number(preco_embalagem_atual || 0),
        ativo: ativo !== undefined ? Boolean(ativo) : status !== 'inativo'
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Inventory Route] Fallback mock para cadastrar insumo:', (err as Error).message);
    const newInsumo = {
      id: Math.random().toString(36).substring(2),
      nome,
      unidade_medida,
      estoque_minimo: Number(estoque_minimo || 0),
      categoria,
      status: status || 'ativo'
    };
    mockStore.addInsumo(newInsumo);
    res.status(201).json(newInsumo);
  }
});

// GET /api/inventory/movements - Histórico de movimentações
router.get('/movements', async (req, res, next) => {
  const { unit_id } = req.query;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('movimentacoes_estoque')
      .select(`
        *,
        insumo:insumos (
          nome,
          unidade_medida
        )
      `)
      .eq('unit_id', unit_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Inventory Route] Fallback mock para listar movimentações:', (err as Error).message);
    res.json(mockStore.getMovimentacoes(unit_id as string));
  }
});

// POST /api/inventory/purchases - Registrar compra e dar entrada no estoque
router.post('/purchases', async (req, res, next) => {
  const { insumo_id, unit_id, tenant_id, fornecedor, quantidade, valor_total, nota_fiscal } = req.body;
  if (!insumo_id || !unit_id || !fornecedor || !quantidade || !valor_total) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  const valor_unitario = Number(valor_total) / Number(quantidade);

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { error } = await supabase.rpc('processar_compra_estoque', {
      p_insumo_id: insumo_id,
      p_unit_id: unit_id,
      p_fornecedor: fornecedor,
      p_quantidade: Number(quantidade),
      p_valor_total: Number(valor_total),
      p_valor_unitario: valor_unitario,
      p_nota_fiscal: nota_fiscal || null,
      p_tenant_id: tenant_id
    });

    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (err) {
    console.warn('[Inventory Route] Fallback mock para processar compra:', (err as Error).message);
    const newCompra = {
      id: '',
      insumo_id,
      unit_id,
      fornecedor,
      quantidade: Number(quantidade),
      valor_total: Number(valor_total),
      valor_unitario,
      data_compra: new Date().toISOString().split('T')[0],
      nota_fiscal
    };
    const result = mockStore.addCompraEstoque(newCompra);
    res.status(201).json(result);
  }
});

export default router;
