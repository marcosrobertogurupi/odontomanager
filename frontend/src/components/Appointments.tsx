import React, { useEffect, useState } from 'react';
import { 
  CalendarDays, 
  Plus, 
  Link2, 
  User, 
  Clock, 
  MapPin, 
  X, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './Appointments.module.css';

interface AppointmentsProps {
  selectedUnit: string;
}

export default function Appointments({ selectedUnit }: AppointmentsProps) {
  const { activeTenant } = useTenant();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [dentists, setDentists] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedDentist, setSelectedDentist] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Campos do formulário de novo agendamento
  const [formPatient, setFormPatient] = useState('');
  const [formDentist, setFormDentist] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState('60');
  const [formRoom, setFormRoom] = useState('Consultório A');
  const [formNotes, setFormNotes] = useState('');

  const fetchAppointments = async () => {
    if (!activeTenant || !selectedUnit) return;
    setLoading(true);
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*),
          professional:profiles(*),
          procedure:procedures(*)
        `)
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit);

      if (selectedDate) {
        const startOfDay = `${selectedDate}T00:00:00Z`;
        const endOfDay = `${selectedDate}T23:59:59Z`;
        query = query.gte('start_time', startOfDay).lte('start_time', endOfDay);
      }

      if (selectedDentist) {
        query = query.eq('professional_id', selectedDentist);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Erro ao buscar consultas:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDependencies = async () => {
    if (!activeTenant) return;
    try {
      // Carregar dentistas
      const { data: dentistData, error: dentistError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('role', 'dentist');
      if (dentistError) throw dentistError;
      setDentists(dentistData || []);

      // Carregar pacientes
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (patientError) throw patientError;
      setPatients(patientData || []);
    } catch (err) {
      console.error('Erro ao carregar dependências para agendamentos:', err);
    }
  };

  useEffect(() => {
    if (activeTenant && selectedUnit) {
      fetchAppointments();
      loadDependencies();
    }
  }, [selectedUnit, selectedDate, selectedDentist, activeTenant]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    if (!formPatient || !formDentist) return alert('Selecione um paciente e um profissional.');

    // Montar as datas de início e fim
    const start_time = `${selectedDate}T${formTime}:00-03:00`;
    const startObj = new Date(start_time);
    const endObj = new Date(startObj.getTime() + Number(formDuration) * 60000);
    const end_time = endObj.toISOString();

    const payload = {
      patient_id: formPatient,
      professional_id: formDentist,
      unit_id: selectedUnit,
      start_time,
      end_time,
      status: 'scheduled',
      room: formRoom,
      notes: formNotes,
      tenant_id: activeTenant.id
    };

    try {
      const { error } = await supabase
        .from('appointments')
        .insert([payload]);

      if (error) throw error;

      setIsDrawerOpen(false);
      fetchAppointments();
      // Reset form
      setFormPatient('');
      setFormNotes('');
    } catch (err: any) {
      console.error('Erro ao criar agendamento:', err);
      alert('Erro ao criar agendamento: ' + err.message);
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    if (!activeTenant) return;
    const now = new Date().toISOString();

    try {
      // 1. Tentar ver se já existe registro de fluxo
      const { data: existingFlow, error: selectError } = await supabase
        .from('clinic_flow')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (!existingFlow) {
        // Criar novo fluxo
        const { error: insertError } = await supabase
          .from('clinic_flow')
          .insert([{
            appointment_id: appointmentId,
            status: 'checked_in',
            checked_in_at: now,
            tenant_id: activeTenant.id
          }]);
        if (insertError) throw insertError;
      } else {
        // Atualizar fluxo existente
        const { error: updateError } = await supabase
          .from('clinic_flow')
          .update({ status: 'checked_in', checked_in_at: now })
          .eq('appointment_id', appointmentId)
          .eq('tenant_id', activeTenant.id);
        if (updateError) throw updateError;
      }

      alert('Check-in realizado com sucesso! O paciente já aparece na recepção da clínica.');
      fetchAppointments();
    } catch (err: any) {
      console.error('Erro ao realizar check-in:', err);
      alert('Erro ao realizar check-in: ' + err.message);
    }
  };

  const handleGenerateLink = () => {
    const mockLink = `https://agendar.odontomanager.com/clinica-${selectedUnit.substring(0,6)}`;
    navigator.clipboard.writeText(mockLink);
    alert('Link público de agendamento copiado para a área de transferência:\n' + mockLink);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'confirmed': return 'Confirmado';
      case 'canceled': return 'Cancelado';
      case 'missed': return 'Faltou';
      default: return status;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.title}>Agenda Clínica</h1>
          <p className={styles.subtitle}>Gerencie horários, salas de consultório e profissionais.</p>
        </div>
        <div className={styles.actionGroup}>
          <button onClick={handleGenerateLink} className={styles.secondaryBtn}>
            <Link2 size={16} />
            <span>Link Público</span>
          </button>
          <button onClick={() => setIsDrawerOpen(true)} className={styles.primaryBtn}>
            <Plus size={16} />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className={styles.filterCard}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filtrar Data</span>
          <input 
            type="date" 
            className={styles.input} 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filtrar Profissional</span>
          <select 
            className={styles.select}
            value={selectedDentist}
            onChange={(e) => setSelectedDentist(e.target.value)}
          >
            <option value="">Todos os Dentistas</option>
            {dentists.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Corpo da Agenda */}
      <div className={styles.contentArea}>
        <div className={styles.timelineCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Cronograma de Atendimentos</h2>
            <button onClick={fetchAppointments} className={styles.secondaryBtn} style={{ padding: '6px 12px', fontSize: '12px' }}>
              <RefreshCw size={12} />
              <span>Recarregar</span>
            </button>
          </div>

          <div className={styles.timeline}>
            {appointments.length > 0 ? (
              appointments.map(app => {
                const startTime = new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(app.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={app.id} className={styles.timelineItem}>
                    <div className={styles.timeCol}>
                      <span>{startTime} - {endTime}</span>
                      <span className={styles.duration}>
                        {Math.round((new Date(app.end_time).getTime() - new Date(app.start_time).getTime()) / 60000)} min
                      </span>
                    </div>

                    <div className={styles.infoCol}>
                      <span className={styles.patientName}>{app.patient?.name}</span>
                      <div className={styles.details}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} />
                          {app.professional?.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} />
                          {app.room}
                        </span>
                      </div>
                      {app.notes && <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>{app.notes}</p>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={`${styles.statusTag} ${styles['status_' + app.status]}`}>
                        {getStatusLabel(app.status)}
                      </span>
                      {app.status === 'scheduled' && (
                        <button 
                          onClick={() => handleCheckIn(app.id)} 
                          className={styles.primaryBtn}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          <CheckCircle2 size={12} />
                          <span>Check-in</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>Nenhuma consulta agendada para este dia.</p>
            )}
          </div>
        </div>
      </div>

      {/* Drawer de Cadastro (Painel Deslizante da Direita) */}
      <div className={`${styles.overlay} ${isDrawerOpen ? styles.overlayActive : ''}`} onClick={() => setIsDrawerOpen(false)} />
      <div className={`${styles.drawer} ${isDrawerOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Novo Agendamento</h3>
          <button className={styles.closeBtn} onClick={() => setIsDrawerOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleCreateAppointment}>
          <div className={styles.formGroup}>
            <label>Paciente</label>
            <select 
              className={styles.select}
              value={formPatient}
              onChange={(e) => setFormPatient(e.target.value)}
              required
            >
              <option value="">Selecione o Paciente</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Dentista</label>
            <select 
              className={styles.select}
              value={formDentist}
              onChange={(e) => setFormDentist(e.target.value)}
              required
            >
              <option value="">Selecione o Dentista</option>
              {dentists.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Horário de Início</label>
            <input 
              type="time" 
              className={styles.input}
              value={formTime}
              onChange={(e) => setFormTime(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Duração (minutos)</label>
            <select 
              className={styles.select}
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
            >
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1 hora e meia</option>
              <option value="120">2 horas</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Sala / Consultório</label>
            <select 
              className={styles.select}
              value={formRoom}
              onChange={(e) => setFormRoom(e.target.value)}
            >
              <option value="Consultório A">Consultório A</option>
              <option value="Consultório B">Consultório B</option>
              <option value="Consultório C">Consultório C</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Observações</label>
            <textarea 
              className={styles.input}
              style={{ minHeight: '80px', resize: 'vertical' }}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.primaryBtn} style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            Confirmar Agendamento
          </button>
        </form>
      </div>
    </div>
  );
}
