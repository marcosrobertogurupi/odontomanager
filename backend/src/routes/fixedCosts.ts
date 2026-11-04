import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/fixed-costs - Listar custos fixos
router.get('/', async (req, res, next) => {
  const { unit_id, competencia } = req.query;
  if (!unit_id) {
    return res.status(400).json({ error: 'unit_id is required' });
  }

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('custos_fixos')
      .select('*')
      .eq('unit_id', unit_id)
      .order('nome_custo');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Fixed Costs Route] Fallback mock para listar custos fixos:', (err as Error).message);
    res.json(mockStore.getCustosFixos(unit_id as string, (competencia as string) || ''));
  }
});

// POST /api/fixed-costs - Cadastrar custo fixo
router.post('/', async (req, res, next) => {
  const { nome, nome_custo, tipo, valor, valor_mensal, competencia, unidade_id, unit_id, tenant_id, ativo } = req.body;
  const resolvedName = nome_custo || nome;
  const resolvedValue = valor_mensal ?? valor;
  const resolvedUnitId = unit_id || unidade_id;

  if (!resolvedName || resolvedValue === undefined || !resolvedUnitId) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('custos_fixos')
      .insert([{
        tenant_id,
        unit_id: resolvedUnitId,
        nome_custo: resolvedName,
        valor_mensal: Number(resolvedValue),
        ativo: ativo !== undefined ? Boolean(ativo) : true
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Fixed Costs Route] Fallback mock para cadastrar custo fixo:', (err as Error).message);
    const newCusto = {
      id: Math.random().toString(36).substring(2),
      nome,
      tipo,
      valor: Number(valor),
      competencia,
      unidade_id
    };
    mockStore.addCustoFixo(newCusto);
    res.status(201).json(newCusto);
  }
});

export default router;
