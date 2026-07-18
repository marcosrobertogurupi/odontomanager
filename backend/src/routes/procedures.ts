import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/procedures - Listar
router.get('/', async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('procedures')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Procedures Route] Utilizando fallback de mock:', (err as Error).message);
    res.json(mockStore.getProcedures());
  }
});

// POST /api/procedures - Criar
router.post('/', async (req, res, next) => {
  const { name, description, price } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('procedures')
      .insert([{ name, description, price }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Procedures Route] Criando em mock:', (err as Error).message);
    const newProc = {
      id: Math.random().toString(36).substring(2),
      name,
      description,
      price: Number(price)
    };
    mockStore.addProcedure(newProc);
    res.status(201).json(newProc);
  }
});

export default router;
