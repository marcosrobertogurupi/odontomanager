import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/clinic-flow - Listar fluxo ativo
router.get('/', async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('clinic_flow')
      .select(`
        *,
        appointment:appointments(
          *,
          patient:patients(*),
          professional:profiles(*)
        )
      `)
      .order('checked_in_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[ClinicFlow Route] Utilizando fallback de mock:', (err as Error).message);
    res.json(mockStore.getClinicFlow());
  }
});

// POST /api/clinic-flow/:appointmentId/status - Atualizar status do paciente na clínica
router.post('/:appointmentId/status', async (req, res, next) => {
  const { appointmentId } = req.params;
  const { status } = req.body; // status: checked_in, waiting, in_consultation, checked_out

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const now = new Date().toISOString();
    
    // Tenta ver se já existe registro
    const { data: existingFlow } = await supabase
      .from('clinic_flow')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    let result;
    if (!existingFlow) {
      // Cria novo fluxo
      const insertData: any = {
        appointment_id: appointmentId,
        status,
        checked_in_at: now
      };
      if (status === 'in_consultation') insertData.consultation_started_at = now;
      if (status === 'checked_out') insertData.consultation_ended_at = now;

      const { data, error } = await supabase
        .from('clinic_flow')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Atualiza fluxo existente
      const updateData: any = { status };
      if (status === 'in_consultation') updateData.consultation_started_at = now;
      if (status === 'checked_out') updateData.consultation_ended_at = now;

      const { data, error } = await supabase
        .from('clinic_flow')
        .update(updateData)
        .eq('appointment_id', appointmentId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    console.warn('[ClinicFlow Route] Atualizando em mock:', (err as Error).message);
    const updatedFlow = mockStore.updateClinicFlow(appointmentId, status);
    res.json(updatedFlow);
  }
});

export default router;
