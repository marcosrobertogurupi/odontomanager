import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/fixed-costs - Listar custos fixos
router.get('/', async (req, res, next) => {
  const { unit_id, competencia } = req.query; // competencia formato MM/YYYY
  if (!unit_id || !competencia) {
    return res.status(400).json({ error: 'unit_id and competencia are required' });
  }

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('custos_fixos')
      .select('*')
      .eq('unidade_id', unit_id)
      .eq('competencia', competencia);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Fixed Costs Route] Fallback mock para listar custos fixos:', (err as Error).message);
    res.json(mockStore.getCustosFixos(unit_id as string, competencia as string));
  }
});

// POST /api/fixed-costs - Cadastrar custo fixo
router.post('/', async (req, res, next) => {
  const { nome, tipo, valor, competencia, unidade_id } = req.body;
  if (!nome || !tipo || !valor || !competencia || !unidade_id) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('custos_fixos')
      .insert([{
        nome,
        tipo,
        valor: Number(valor),
        competencia,
        unidade_id
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
