import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/patients - Listar ou buscar
router.get('/', async (req, res, next) => {
  const { search } = req.query;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    let query = supabase.from('patients').select('*');
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Patients Route] Utilizando fallback de mock:', (err as Error).message);
    let list = mockStore.getPatients();
    if (search) {
      const s = (search as string).toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s));
    }
    res.json(list);
  }
});

// POST /api/patients - Criar
router.post('/', async (req, res, next) => {
  const { name, email, phone, birth_date, cpf } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('patients')
      .insert([{ name, email, phone, birth_date, cpf }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Patients Route] Criando em mock:', (err as Error).message);
    const newPatient = {
      id: Math.random().toString(36).substring(2),
      name,
      email,
      phone,
      birth_date,
      cpf,
      satisfaction_score: 10.0
    };
    mockStore.addPatient(newPatient);
    res.status(201).json(newPatient);
  }
});

// PUT /api/patients/:id - Atualizar
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { name, email, phone, birth_date, cpf, satisfaction_score } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('patients')
      .update({ name, email, phone, birth_date, cpf, satisfaction_score })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Patients Route] Atualizando em mock:', (err as Error).message);
    const updated = mockStore.updatePatient(id, { name, email, phone, birth_date, cpf, satisfaction_score });
    if (!updated) return res.status(404).json({ error: 'Patient not found' });
    res.json(updated);
  }
});

// DELETE /api/patients/:id - Deletar
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.warn('[Patients Route] Deletando em mock:', (err as Error).message);
    const removed = mockStore.deletePatient(id);
    if (!removed) return res.status(404).json({ error: 'Patient not found' });
    res.json({ success: true, removed });
  }
});

export default router;
