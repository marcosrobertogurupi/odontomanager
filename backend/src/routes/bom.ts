import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/procedures/:id/bom - Obter a ficha técnica do procedimento
router.get('/:id/bom', async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('procedimento_insumos')
      .select(`
        *,
        insumo:insumos(*)
      `)
      .eq('procedimento_id', id);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[BOM Route] Fallback mock para obter BOM:', (err as Error).message);
    res.json(mockStore.getProcedimentoInsumos(id));
  }
});

// POST /api/procedures/:id/bom - Salvar/Atualizar a ficha técnica do procedimento
router.post('/:id/bom', async (req, res, next) => {
  const { id } = req.params;
  const { items } = req.body; // Array de { insumo_id, quantidade_padrao }

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    // Remove registros antigos
    const { error: deleteError } = await supabase
      .from('procedimento_insumos')
      .delete()
      .eq('procedimento_id', id);

    if (deleteError) throw deleteError;

    if (items && items.length > 0) {
      const insertRows = items.map((item: any) => ({
        procedimento_id: id,
        insumo_id: item.insumo_id,
        quantidade_padrao: Number(item.quantidade_padrao)
      }));

      const { data, error } = await supabase
        .from('procedimento_insumos')
        .insert(insertRows)
        .select(`
          *,
          insumo:insumos(*)
        `);

      if (error) throw error;
      return res.json(data);
    }

    res.json([]);
  } catch (err) {
    console.warn('[BOM Route] Fallback mock para atualizar BOM:', (err as Error).message);
    const result = mockStore.updateProcedimentoInsumos(id, items || []);
    res.json(result);
  }
});

export default router;
