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
  const { status, unit_id, procedure_id, consumos } = req.body; // status: checked_in, waiting, in_consultation, checked_out

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const now = new Date().toISOString();

    // Se for alterado para concluído (checked_out), realiza baixa de estoque transacional
    if (status === 'checked_out') {
      if (!unit_id) throw new Error('unit_id is required for checkout');

      if (procedure_id && consumos && consumos.length > 0) {
        const { error: rpcError } = await supabase.rpc('registrar_consumo_atendimento', {
          p_appointment_id: appointmentId,
          p_procedimento_id: procedure_id,
          p_unit_id: unit_id,
          p_consumos: consumos
        });
        if (rpcError) throw rpcError;
      }

      // Atualiza status do agendamento para confirmado
      await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointmentId);
    } else {
      // Se for alterado de checked_out para outro status, estorna os insumos
      const { data: currentFlow } = await supabase
        .from('clinic_flow')
        .select('status')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (currentFlow && currentFlow.status === 'checked_out') {
        if (!unit_id) throw new Error('unit_id is required for revert');
        const { error: revertError } = await supabase.rpc('estornar_consumo_atendimento', {
          p_appointment_id: appointmentId,
          p_unit_id: unit_id
        });
        if (revertError) throw revertError;
      }
    }

    // Tenta ver se já existe registro de fluxo
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

    const resolvedUnitId = unit_id || 'b1f7313d-7938-417e-85fc-fa9ded098671';
    if (status === 'checked_out') {
      if (procedure_id && consumos) {
        mockStore.addConsumosAtendimento(appointmentId, resolvedUnitId, procedure_id, consumos);
      }
      mockStore.updateAppointment(appointmentId, { status: 'confirmed' });
    } else {
      const currentFlow = mockStore.getClinicFlow().find(f => f.appointment_id === appointmentId);
      if (currentFlow && currentFlow.status === 'checked_out') {
        mockStore.revertConsumosAtendimento(appointmentId, resolvedUnitId);
      }
    }

    const updatedFlow = mockStore.updateClinicFlow(appointmentId, status);
    res.json(updatedFlow);
  }
});

export default router;
