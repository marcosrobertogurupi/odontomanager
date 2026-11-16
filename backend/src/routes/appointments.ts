import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/appointments - Listar
router.get('/', async (req, res) => {
  const { unit_id, professional_id, date, start_from, start_to, tenant_id } = req.query;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    let query = supabase.from('appointments').select(`
      *,
      patient:patients(*),
      professional:profiles(*),
      procedure:procedures(*)
    `);

    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    if (unit_id) query = query.eq('unit_id', unit_id);
    if (professional_id) query = query.eq('professional_id', professional_id);
    
    if (start_from && start_to) {
      query = query.gte('start_time', String(start_from)).lte('start_time', String(start_to));
    } else if (date) {
      const startOfDay = `${date}T00:00:00Z`;
      const endOfDay = `${date}T23:59:59Z`;
      query = query.gte('start_time', startOfDay).lte('start_time', endOfDay);
    }

    const { data, error } = await query.order('start_time', { ascending: true });
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
    if (start_from && start_to) {
      const fromTime = new Date(String(start_from)).getTime();
      const toTime = new Date(String(start_to)).getTime();
      list = list.filter(a => {
        const t = new Date(a.start_time).getTime();
        return t >= fromTime && t <= toTime;
      });
    } else if (date) {
      const dStr = date as string;
      list = list.filter(a => a.start_time.startsWith(dStr));
    }

    const fullList = list.map(app => ({
      ...app,
      procedure: mockStore.procedures.find(p => p.id === app.procedure_id)
    }));

    res.json(fullList);
  }
});

// POST /api/appointments - Criar
router.post('/', async (req, res) => {
  const {
    patient_id,
    professional_id,
    unit_id,
    start_time,
    end_time,
    status,
    room,
    notes,
    procedure_id,
    tenant_id,
    event_type,
    title,
    color,
    whatsapp_notify,
    whatsapp_reminder_minutes,
    whatsapp_phone,
    whatsapp_custom_message
  } = req.body;

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const insertPayload: Record<string, any> = {
      patient_id: event_type === 'personal' ? (patient_id || null) : patient_id,
      professional_id,
      unit_id,
      start_time,
      end_time,
      status: status || 'scheduled',
      room: room || null,
      notes: notes || null,
      procedure_id: procedure_id || null,
      tenant_id: tenant_id || null,
      event_type: event_type || 'clinic',
      title: title || null,
      color: color || 'peacock',
      whatsapp_notify: Boolean(whatsapp_notify),
      whatsapp_reminder_minutes: Number(whatsapp_reminder_minutes || 60),
      whatsapp_phone: whatsapp_phone || null,
      whatsapp_custom_message: whatsapp_custom_message || null
    };

    const { data, error } = await supabase
      .from('appointments')
      .insert([insertPayload])
      .select(`
        *,
        patient:patients(*),
        professional:profiles(*),
        procedure:procedures(*)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Appointments Route] Criando em mock:', (err as Error).message);
    const id = Math.random().toString(36).substring(2);
    const newApp = {
      id,
      patient_id: event_type === 'personal' ? null : patient_id,
      professional_id,
      unit_id,
      start_time,
      end_time,
      status: status || 'scheduled',
      room: room || '',
      notes,
      procedure_id,
      event_type: event_type || 'clinic',
      title: title || null,
      color: color || 'peacock',
      whatsapp_notify: Boolean(whatsapp_notify),
      whatsapp_reminder_minutes: Number(whatsapp_reminder_minutes || 60),
      whatsapp_phone: whatsapp_phone || null,
      whatsapp_custom_message: whatsapp_custom_message || null
    };
    mockStore.addAppointment(newApp);
    
    const fullApp = mockStore.getAppointments().find(a => a.id === id);
    if (fullApp) {
      (fullApp as any).procedure = mockStore.procedures.find(p => p.id === procedure_id);
    }
    res.status(201).json(fullApp || newApp);
  }
});

// PUT /api/appointments/:id - Atualizar
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    patient_id,
    professional_id,
    status,
    start_time,
    end_time,
    room,
    notes,
    procedure_id,
    event_type,
    title,
    color,
    whatsapp_notify,
    whatsapp_reminder_minutes,
    whatsapp_phone,
    whatsapp_reminder_sent,
    whatsapp_reminder_sent_at,
    whatsapp_custom_message
  } = req.body;

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    if (status === 'canceled' || status === 'missed') {
      const { data: currentApp } = await supabase
        .from('appointments')
        .select('unit_id, tenant_id')
        .eq('id', id)
        .single();
      
      if (currentApp) {
        await supabase.rpc('estornar_consumo_atendimento', {
          p_appointment_id: id,
          p_unit_id: currentApp.unit_id,
          p_tenant_id: currentApp.tenant_id
        });
      }
    }

    const updateFields: Record<string, any> = {};
    if (patient_id !== undefined) updateFields.patient_id = patient_id;
    if (professional_id !== undefined) updateFields.professional_id = professional_id;
    if (status !== undefined) updateFields.status = status;
    if (start_time !== undefined) updateFields.start_time = start_time;
    if (end_time !== undefined) updateFields.end_time = end_time;
    if (room !== undefined) updateFields.room = room;
    if (notes !== undefined) updateFields.notes = notes;
    if (procedure_id !== undefined) updateFields.procedure_id = procedure_id;
    if (event_type !== undefined) updateFields.event_type = event_type;
    if (title !== undefined) updateFields.title = title;
    if (color !== undefined) updateFields.color = color;
    if (whatsapp_notify !== undefined) updateFields.whatsapp_notify = whatsapp_notify;
    if (whatsapp_reminder_minutes !== undefined) updateFields.whatsapp_reminder_minutes = whatsapp_reminder_minutes;
    if (whatsapp_phone !== undefined) updateFields.whatsapp_phone = whatsapp_phone;
    if (whatsapp_reminder_sent !== undefined) updateFields.whatsapp_reminder_sent = whatsapp_reminder_sent;
    if (whatsapp_reminder_sent_at !== undefined) updateFields.whatsapp_reminder_sent_at = whatsapp_reminder_sent_at;
    if (whatsapp_custom_message !== undefined) updateFields.whatsapp_custom_message = whatsapp_custom_message;

    const { data, error } = await supabase
      .from('appointments')
      .update(updateFields)
      .eq('id', id)
      .select(`
        *,
        patient:patients(*),
        professional:profiles(*),
        procedure:procedures(*)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Appointments Route] Atualizando em mock:', (err as Error).message);

    if (status === 'canceled' || status === 'missed') {
      const app = mockStore.appointments.find(a => a.id === id);
      if (app) {
        mockStore.revertConsumosAtendimento(id, app.unit_id);
      }
    }

    const updated = mockStore.updateAppointment(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Appointment not found' });
    
    const fullApp = mockStore.getAppointments().find(a => a.id === id);
    if (fullApp) {
      (fullApp as any).procedure = mockStore.procedures.find(p => p.id === (procedure_id || fullApp.procedure_id));
    }
    res.json(fullApp || updated);
  }
});

// DELETE /api/appointments/:id - Excluir
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data: currentApp } = await supabase
      .from('appointments')
      .select('unit_id, tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (currentApp) {
      await supabase.rpc('estornar_consumo_atendimento', {
        p_appointment_id: id,
        p_unit_id: currentApp.unit_id,
        p_tenant_id: currentApp.tenant_id
      });
    }

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, id });
  } catch (err) {
    console.warn('[Appointments Route] Excluindo em mock:', (err as Error).message);
    const app = mockStore.appointments.find(a => a.id === id);
    if (app) {
      mockStore.revertConsumosAtendimento(id, app.unit_id);
    }
    mockStore.deleteAppointment(id);
    res.json({ success: true, id });
  }
});

export default router;
