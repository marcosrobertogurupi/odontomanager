import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/units - Listar unidades
router.get('/', async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Units Route] Utilizando fallback de mock:', (err as Error).message);
    res.json(mockStore.units);
  }
});

export default router;
