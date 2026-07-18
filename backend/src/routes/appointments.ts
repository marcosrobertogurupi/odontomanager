import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/appointments - Listar
router.get('/', async (req, res, next) => {
  const { unit_id, professional_id, date } = req.query;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    let query = supabase.from('appointments').select(`
      *,
      patient:patients(*),
      professional:profiles(*)
    `);

    if (unit_id) query = query.eq('unit_id', unit_id);
    if (professional_id) query = query.eq('professional_id', professional_id);
    
    if (date) {
      const startOfDay = `${date}T00:00:00Z`;
      const endOfDay = `${date}T23:59:59Z`;
      query = query.gte('start_time', startOfDay).lte('start_time', endOfDay);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Appointments Route] Utilizando fallback de mock:', (err as Error).message);
    let list = mockStore.getAppointments();
    
    if (unit_id) {
      list = list.filter(a => a.unit_id === unit_id);
    }
    if (professional_id) {
      list = list.filter(a => a.professional_id === professional_id);
    }
    if (date) {
      const dStr = date as string;
      list = list.filter(a => a.start_time.startsWith(dStr));
    }
    res.json(list);
  }
});

// POST /api/appointments - Criar
router.post('/', async (req, res, next) => {
  const { patient_id, professional_id, unit_id, start_time, end_time, status, room, notes } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('appointments')
      .insert([{ patient_id, professional_id, unit_id, start_time, end_time, status, room, notes }])
      .select(`
        *,
        patient:patients(*),
        professional:profiles(*)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Appointments Route] Criando em mock:', (err as Error).message);
    const id = Math.random().toString(36).substring(2);
    const newApp = {
      id,
      patient_id,
      professional_id,
      unit_id,
      start_time,
      end_time,
      status: status || 'scheduled',
      room,
      notes
    };
    mockStore.addAppointment(newApp);
    
    // Retorna com os dados relacionados anexados para o frontend
    const fullApp = mockStore.getAppointments().find(a => a.id === id);
    res.status(201).json(fullApp || newApp);
  }
});

// PUT /api/appointments/:id - Atualizar
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { status, start_time, end_time, room, notes } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('appointments')
      .update({ status, start_time, end_time, room, notes })
      .eq('id', id)
      .select(`
        *,
        patient:patients(*),
        professional:profiles(*)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Appointments Route] Atualizando em mock:', (err as Error).message);
    const updated = mockStore.updateAppointment(id, { status, start_time, end_time, room, notes });
    if (!updated) return res.status(404).json({ error: 'Appointment not found' });
    
    const fullApp = mockStore.getAppointments().find(a => a.id === id);
    res.json(fullApp || updated);
  }
});

export default router;
