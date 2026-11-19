import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  MapPin,
  X,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Edit3,
  Lock,
  Stethoscope,
  Briefcase,
  MessageCircle,
  Bell,
  Check,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './Appointments.module.css';

interface AppointmentsProps {
  selectedUnit: string;
}

type CalendarViewMode = 'day' | 'week' | 'month' | 'schedule';
type EventType = 'clinic' | 'personal';
type AnimationState = { id: string; type: 'added' | 'updated' | 'deleted' } | null;

interface ToastState {
  id: string;
  type: 'added' | 'updated' | 'deleted' | 'whatsapp';
  title: string;
  subtitle: string;
}

const CALENDAR_COLORS = [
  { id: 'peacock', label: 'Azul Pavão', hex: '#039be5' },
  { id: 'sage', label: 'Verde Sálvia', hex: '#33b679' },
  { id: 'grape', label: 'Roxo Uva', hex: '#8e24aa' },
  { id: 'flamingo', label: 'Rosa Coral', hex: '#e67c73' },
  { id: 'banana', label: 'Amarelo Solar', hex: '#f6bf26' },
  { id: 'tangerine', label: 'Laranja Tangerina', hex: '#f4511e' },
  { id: 'lavender', label: 'Lavanda', hex: '#7986cb' },
  { id: 'graphite', label: 'Grafite', hex: '#616161' },
];

const WHATSAPP_REMINDER_OPTIONS = [
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 180, label: '3 horas antes' },
  { value: 360, label: '6 horas antes' },
  { value: 720, label: '12 horas antes' },
  { value: 1440, label: '24 horas antes (1 dia)' },
  { value: 2880, label: '48 horas antes (2 dias)' },
];

const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MINI_WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 64; // 64px por hora -> 1536px por 24h
const BUSINESS_START_HOUR = 8; // horário comercial: a grade abre rolada em 08:00

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function getStartOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const day = copy.getDay(); // 0 = Domingo
  copy.setDate(copy.getDate() - day);
  return copy;
}

function formatReminderAntecedencia(mins: number): string {
  if (mins < 60) return `${mins}min antes`;
  if (mins === 60) return '1h antes';
  if (mins < 1440) return `${Math.round(mins / 60)}h antes`;
  const days = Math.round(mins / 1440);
  return `${days}d antes`;
}

function getColorHex(colorId?: string): string {
  return CALENDAR_COLORS.find(c => c.id === colorId)?.hex || '#039be5';
}

export default function Appointments({ selectedUnit }: AppointmentsProps) {
  const { activeTenant, user, role, profile } = useTenant();

  // Controles de visualização estilo Google Calendar
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateStr(new Date()));
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [gridAnimKey, setGridAnimKey] = useState<number>(0);

  // Dados carregados do Supabase
  const [appointments, setAppointments] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [selectedDentist, setSelectedDentist] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Filtros de categorias na sidebar ("Minhas Agendas")
  const [showClinicEvents, setShowClinicEvents] = useState<boolean>(true);
  const [showPersonalEvents, setShowPersonalEvents] = useState<boolean>(true);

  // Estado de animação CRUD (Adicionar, Alterar, Excluir) e Toast
  const [animatingEvent, setAnimatingEvent] = useState<AnimationState>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Indicador de hora atual (linha vermelha do Google Calendar)
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  const timeGridScrollRef = useRef<HTMLDivElement | null>(null);

  // Estado do Modal (Criar / Editar Compromisso)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const [savingForm, setSavingForm] = useState<boolean>(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState<boolean>(false);

  // Campos do formulário de agendamento (Clínico ou Pessoal)
  const [formEventType, setFormEventType] = useState<EventType>('clinic');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formPatient, setFormPatient] = useState<string>('');
  const [formDentist, setFormDentist] = useState<string>('');
  const [formProcedure, setFormProcedure] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(() => toLocalDateStr(new Date()));
  const [formTime, setFormTime] = useState<string>('09:00');
  const [formDuration, setFormDuration] = useState<string>('60');
  const [formRoom, setFormRoom] = useState<string>('Consultório A');
  const [formStatus, setFormStatus] = useState<string>('scheduled');
  const [formColor, setFormColor] = useState<string>('peacock');
  const [formNotes, setFormNotes] = useState<string>('');

  // Campos de aviso pelo WhatsApp com antecedência
  const [formWhatsappNotify, setFormWhatsappNotify] = useState<boolean>(true);
  const [formWhatsappMinutes, setFormWhatsappMinutes] = useState<number>(60);
  const [formWhatsappPhone, setFormWhatsappPhone] = useState<string>('');
  const [formWhatsappMessage, setFormWhatsappMessage] = useState<string>('');

  // Se o usuário logado tem perfil estrito de dentista, ele vê exclusivamente a própria agenda
  const isStrictDentist = role === 'dentist';

  const triggerToast = useCallback((type: ToastState['type'], title: string, subtitle: string) => {
    const id = String(Date.now());
    setToast({ id, type, title, subtitle });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  // Atualizar relógio da linha vermelha a cada 60s
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Posicionar o scroll vertical da grade no início do expediente (08:00).
  // Roda a cada render até a grade ter overflow real (layout pronto) e então
  // aplica uma única vez por visualização — evita ficar às 01:00 quando o
  // layout ainda não estava medido no primeiro efeito.
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    if (viewMode !== 'week' && viewMode !== 'day') {
      initialScrollDoneRef.current = false;
      return;
    }
    const el = timeGridScrollRef.current;
    if (!el || initialScrollDoneRef.current) return;
    if (el.scrollHeight <= el.clientHeight) return;
    // -12px para o rótulo "08:00" (centrado na linha) não ficar cortado no topo
    el.scrollTop = BUSINESS_START_HOUR * HOUR_HEIGHT - 12;
    initialScrollDoneRef.current = true;
  });

  // 1. Carregar Profissionais, Pacientes e Procedimentos
  const loadDependencies = useCallback(async () => {
    if (!activeTenant) return;
    try {
      const [
        { data: profData, error: profError },
        { data: patientData, error: patientError },
        { data: procData, error: procError }
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('tenant_id', activeTenant.id)
          .in('role', ['dentist', 'admin'])
          .order('name'),
        supabase
          .from('patients')
          .select('*')
          .eq('tenant_id', activeTenant.id)
          .order('name'),
        supabase
          .from('procedures')
          .select('*')
          .eq('tenant_id', activeTenant.id)
          .order('name')
      ]);

      if (profError) throw profError;
      if (patientError) throw patientError;
      if (procError) throw procError;

      // Ordenar colocando dentistas primeiro ou o usuário logado
      const sortedProfs = (profData || []).sort((a, b) => {
        if (a.role === 'dentist' && b.role !== 'dentist') return -1;
        if (a.role !== 'dentist' && b.role === 'dentist') return 1;
        return a.name.localeCompare(b.name);
      });

      setProfessionals(sortedProfs);
      setPatients(patientData || []);
      setProcedures(procData || []);

      // Definir profissional ativo garantindo que um profissional nunca veja o compromisso do outro
      if (isStrictDentist && user?.id) {
        setSelectedDentist(user.id);
        setFormDentist(user.id);
      } else if (sortedProfs.length > 0) {
        setSelectedDentist(prev => {
          if (prev && sortedProfs.some(p => p.id === prev)) return prev;
          const ownProfile = user?.id ? sortedProfs.find(p => p.id === user.id) : null;
          const firstDentist = sortedProfs.find(p => p.role === 'dentist') || sortedProfs[0];
          const chosen = (firstDentist || ownProfile)?.id || sortedProfs[0].id;
          setFormDentist(chosen);
          return chosen;
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dependências da agenda:', err);
    }
  }, [activeTenant, isStrictDentist, user?.id]);

  // Calcular janela de datas visível (mês inteiro + margem para mini calendário e visão semanal)
  const visibleDateRange = useMemo(() => {
    const center = parseLocalDate(selectedDate);
    const start = new Date(center.getFullYear(), center.getMonth() - 1, 1, 0, 0, 0);
    const end = new Date(center.getFullYear(), center.getMonth() + 2, 0, 23, 59, 59);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  }, [selectedDate]);

  // 2. Buscar Compromissos estritamente do Profissional Selecionado
  const fetchAppointments = useCallback(async () => {
    if (!activeTenant || !selectedUnit || !selectedDentist) return;
    setLoading(true);
    try {
      const targetProfId = isStrictDentist && user?.id ? user.id : selectedDentist;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*),
          professional:profiles(*),
          procedure:procedures(*)
        `)
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .eq('professional_id', targetProfId)
        .gte('start_time', visibleDateRange.startIso)
        .lte('start_time', visibleDateRange.endIso)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Erro ao buscar compromissos:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTenant, selectedUnit, selectedDentist, isStrictDentist, user?.id, visibleDateRange]);

  useEffect(() => {
    if (activeTenant && selectedUnit) {
      loadDependencies();
    }
  }, [activeTenant, selectedUnit, loadDependencies]);

  useEffect(() => {
    if (activeTenant && selectedUnit && selectedDentist) {
      fetchAppointments();
    }
  }, [activeTenant, selectedUnit, selectedDentist, fetchAppointments]);

  // Atualizar telefone e sugestão de mensagem do WhatsApp automaticamente quando paciente, profissional, data ou hora mudarem
  const activeProfessionalObj = useMemo(
    () => professionals.find(p => p.id === (formDentist || selectedDentist)),
    [professionals, formDentist, selectedDentist]
  );

  const selectedPatientObj = useMemo(
    () => patients.find(p => p.id === formPatient),
    [patients, formPatient]
  );

  const buildDefaultWhatsappMessage = useCallback(
    (
      evType: EventType,
      patName: string,
      profName: string,
      titleStr: string,
      dateStr: string,
      timeStr: string,
      roomStr: string
    ) => {
      const formattedDate = parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const clinicName = activeTenant?.nome_clinica || 'OdontoManager';

      if (evType === 'personal') {
        return `Olá ${profName || ''}! 🔔 Lembrete do seu compromisso pessoal: *${titleStr || 'Compromisso'}* agendado para *${formattedDate}* às *${timeStr}*.`;
      }
      return `Olá *${patName || 'Paciente'}*! 😊 Passando para confirmar e lembrar da sua consulta na *${clinicName}* com *${profName || 'nosso especialista'}* em *${formattedDate}* às *${timeStr}* (${roomStr || 'Consultório'}). Podemos confirmar sua presença?`;
    },
    [activeTenant?.nome_clinica]
  );

  // Quando trocar paciente ou tipo de compromisso no modal (em criação), preencher telefone automaticamente
  const handleEventTypeSwitch = (newType: EventType) => {
    setFormEventType(newType);
    if (newType === 'personal') {
      setFormColor('grape');
      const profPhone = activeProfessionalObj?.phone || profile?.phone || activeTenant?.telefone_whatsapp || '';
      setFormWhatsappPhone(profPhone);
    } else {
      setFormColor('peacock');
      const patPhone = selectedPatientObj?.phone || '';
      setFormWhatsappPhone(patPhone);
    }
  };

  const handlePatientSelect = (patId: string) => {
    setFormPatient(patId);
    const pat = patients.find(p => p.id === patId);
    if (pat?.phone) {
      setFormWhatsappPhone(pat.phone);
    }
  };

  // Disparo de mensagem WhatsApp via Edge Function `send-message` (com fallback wa.me)
  const sendWhatsAppNotification = useCallback(
    async (appointmentRecord: any, isManualTrigger = false) => {
      if (!activeTenant) return false;
      const phone =
        appointmentRecord.whatsapp_phone ||
        (appointmentRecord.event_type === 'personal'
          ? appointmentRecord.professional?.phone || profile?.phone
          : appointmentRecord.patient?.phone);

      if (!phone) {
        if (isManualTrigger) {
          alert('Informe um número de telefone com WhatsApp para enviar o aviso.');
        }
        return false;
      }

      const startDt = new Date(appointmentRecord.start_time);
      const dateStr = toLocalDateStr(startDt);
      const timeStr = startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const messageText =
        appointmentRecord.whatsapp_custom_message?.trim() ||
        buildDefaultWhatsappMessage(
          appointmentRecord.event_type || 'clinic',
          appointmentRecord.patient?.name || 'Paciente',
          appointmentRecord.professional?.name || activeProfessionalObj?.name || '',
          appointmentRecord.title || '',
          dateStr,
          timeStr,
          appointmentRecord.room || 'Consultório'
        );

      try {
        setSendingWhatsapp(true);
        const { data, error } = await supabase.functions.invoke('send-message', {
          body: {
            tenant_id: activeTenant.id,
            phone,
            message: messageText,
            channel: 'whatsapp'
          }
        });

        if (error || (data && data.error)) {
          throw new Error(error?.message || data?.error || 'Integração UAZAPI não configurada');
        }

        const sentNow = new Date().toISOString();
        await supabase
          .from('appointments')
          .update({
            whatsapp_reminder_sent: true,
            whatsapp_reminder_sent_at: sentNow
          })
          .eq('id', appointmentRecord.id);

        setAppointments(prev =>
          prev.map(a =>
            a.id === appointmentRecord.id
              ? { ...a, whatsapp_reminder_sent: true, whatsapp_reminder_sent_at: sentNow }
              : a
          )
        );

        triggerToast(
          'whatsapp',
          'Aviso enviado pelo WhatsApp!',
          `Notificação entregue para ${phone}`
        );
        return true;
      } catch (err: any) {
        console.warn('Fallback WhatsApp Web:', err?.message);
        if (isManualTrigger) {
          let digits = String(phone).replace(/\D/g, '');
          if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
          const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(messageText)}`;
          window.open(waUrl, '_blank', 'noopener,noreferrer');

          const sentNow = new Date().toISOString();
          await supabase
            .from('appointments')
            .update({
              whatsapp_reminder_sent: true,
              whatsapp_reminder_sent_at: sentNow
            })
            .eq('id', appointmentRecord.id);

          setAppointments(prev =>
            prev.map(a =>
              a.id === appointmentRecord.id
                ? { ...a, whatsapp_reminder_sent: true, whatsapp_reminder_sent_at: sentNow }
                : a
            )
          );

          triggerToast(
            'whatsapp',
            'WhatsApp Aberto com o Lembrete!',
            'Mensagem pronta para envio e marcada como avisada.'
          );
        }
        return false;
      } finally {
        setSendingWhatsapp(false);
      }
    },
    [activeTenant, profile?.phone, activeProfessionalObj?.name, buildDefaultWhatsappMessage, triggerToast]
  );

  // Verificador automático de antecedência do WhatsApp (dispara quando chega no horário configurado)
  useEffect(() => {
    if (!activeTenant || appointments.length === 0) return;

    const checkPendingReminders = async () => {
      const nowMs = Date.now();
      for (const app of appointments) {
        if (
          app.whatsapp_notify &&
          !app.whatsapp_reminder_sent &&
          app.status !== 'canceled' &&
          app.status !== 'missed'
        ) {
          const startMs = new Date(app.start_time).getTime();
          const reminderMins = Number(app.whatsapp_reminder_minutes || 60);
          const triggerMs = startMs - reminderMins * 60000;

          // Se já entrou na janela de antecedência e a consulta ainda vai acontecer
          if (nowMs >= triggerMs && nowMs <= startMs) {
            await sendWhatsAppNotification(app, false);
          }
        }
      }
    };

    const interval = setInterval(checkPendingReminders, 45000);
    return () => clearInterval(interval);
  }, [activeTenant, appointments, sendWhatsAppNotification]);

  // Navegação de datas estilo Google Calendar (Hoje, Anterior, Próximo)
  const navigateCalendar = (direction: 'prev' | 'next' | 'today') => {
    setGridAnimKey(prev => prev + 1);
    if (direction === 'today') {
      setSelectedDate(toLocalDateStr(new Date()));
      return;
    }

    const delta = direction === 'next' ? 1 : -1;
    const current = parseLocalDate(selectedDate);

    if (viewMode === 'day') {
      current.setDate(current.getDate() + delta);
    } else if (viewMode === 'week' || viewMode === 'schedule') {
      current.setDate(current.getDate() + delta * 7);
    } else if (viewMode === 'month') {
      current.setMonth(current.getMonth() + delta);
    }

    setSelectedDate(toLocalDateStr(current));
  };

  // Dias exibidos nas colunas da grade (7 dias na visão Semana, 1 dia na visão Dia)
  const displayedDays = useMemo(() => {
    const base = parseLocalDate(selectedDate);
    if (viewMode === 'day') {
      return [base];
    }
    const startOfWeek = getStartOfWeek(base);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + idx);
      return d;
    });
  }, [selectedDate, viewMode]);

  // Dias do Mini Calendário e da Visão Mensal (42 células = 6 semanas)
  const monthCalendarDays = useMemo(() => {
    const base = parseLocalDate(selectedDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = firstDayOfMonth.getDay();
    const startCellDate = new Date(year, month, 1 - startOffset);

    return Array.from({ length: 42 }, (_, idx) => {
      const cellDate = new Date(startCellDate);
      cellDate.setDate(startCellDate.getDate() + idx);
      return {
        date: cellDate,
        dateStr: toLocalDateStr(cellDate),
        isCurrentMonth: cellDate.getMonth() === month
      };
    });
  }, [selectedDate]);

  // Filtrar compromissos pelas checkboxes da sidebar ("Atendimentos" vs "Pessoais")
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const evType: EventType = app.event_type === 'personal' ? 'personal' : 'clinic';
      if (evType === 'clinic' && !showClinicEvents) return false;
      if (evType === 'personal' && !showPersonalEvents) return false;
      return true;
    });
  }, [appointments, showClinicEvents, showPersonalEvents]);

  // Mapa rápido de dias que possuem compromissos (para os pontinhos do mini calendário)
  const daysWithEventsSet = useMemo(() => {
    const set = new Set<string>();
    filteredAppointments.forEach(app => {
      const dStr = toLocalDateStr(new Date(app.start_time));
      set.add(dStr);
    });
    return set;
  }, [filteredAppointments]);

  // Abrir modal para CRIAR novo compromisso (clicando no botão "+ Criar" ou em um horário na grade)
  const handleOpenCreateModal = (
    dateStr?: string,
    timeStr?: string,
    presetType: EventType = 'clinic'
  ) => {
    setEditingAppointment(null);
    const targetDate = dateStr || selectedDate;
    const targetTime = timeStr || '09:00';
    const targetDentist = isStrictDentist && user?.id ? user.id : selectedDentist;

    setFormEventType(presetType);
    setFormTitle('');
    setFormPatient('');
    setFormDentist(targetDentist);
    setFormProcedure('');
    setFormDate(targetDate);
    setFormTime(targetTime);
    setFormDuration('60');
    setFormRoom('Consultório A');
    setFormStatus('scheduled');
    setFormColor(presetType === 'personal' ? 'grape' : 'peacock');
    setFormNotes('');
    setFormWhatsappNotify(true);
    setFormWhatsappMinutes(60);

    const profObj = professionals.find(p => p.id === targetDentist);
    setFormWhatsappPhone(presetType === 'personal' ? profObj?.phone || profile?.phone || '' : '');
    setFormWhatsappMessage('');
    setIsModalOpen(true);
  };

  // Abrir modal para EDITAR compromisso existente clicando no bloco do calendário
  const handleOpenEditModal = (app: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingAppointment(app);

    const startDt = new Date(app.start_time);
    const endDt = new Date(app.end_time);
    const durMins = Math.max(15, Math.round((endDt.getTime() - startDt.getTime()) / 60000));
    const evType: EventType = app.event_type === 'personal' ? 'personal' : 'clinic';

    setFormEventType(evType);
    setFormTitle(app.title || '');
    setFormPatient(app.patient_id || '');
    setFormDentist(app.professional_id || selectedDentist);
    setFormProcedure(app.procedure_id || '');
    setFormDate(toLocalDateStr(startDt));
    setFormTime(
      startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
    setFormDuration(String(durMins));
    setFormRoom(app.room || 'Consultório A');
    setFormStatus(app.status || 'scheduled');
    setFormColor(app.color || (evType === 'personal' ? 'grape' : 'peacock'));
    setFormNotes(app.notes || '');
    setFormWhatsappNotify(Boolean(app.whatsapp_notify));
    setFormWhatsappMinutes(Number(app.whatsapp_reminder_minutes || 60));
    setFormWhatsappPhone(
      app.whatsapp_phone ||
        (evType === 'personal' ? app.professional?.phone || '' : app.patient?.phone || '')
    );
    setFormWhatsappMessage(app.whatsapp_custom_message || '');
    setIsModalOpen(true);
  };

  // Salvar (Criar ou Editar) Compromisso com Animação
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;

    const targetProfId = isStrictDentist && user?.id ? user.id : formDentist || selectedDentist;
    if (!targetProfId) {
      alert('Selecione um profissional para este agendamento.');
      return;
    }

    if (formEventType === 'clinic' && !formPatient) {
      alert('Para atendimento na clínica, selecione o paciente.');
      return;
    }

    if (formEventType === 'personal' && !formTitle.trim()) {
      alert('Para compromisso pessoal, digite um título (ex: Almoço, Reunião, Academia).');
      return;
    }

    const startIso = `${formDate}T${formTime}:00-03:00`;
    const startObj = new Date(startIso);
    const endObj = new Date(startObj.getTime() + Number(formDuration || 60) * 60000);
    const endIso = endObj.toISOString();

    const patObj = patients.find(p => p.id === formPatient);
    const profObj = professionals.find(p => p.id === targetProfId);

    const resolvedPhone =
      formWhatsappPhone.trim() ||
      (formEventType === 'personal' ? profObj?.phone || '' : patObj?.phone || '');

    const payload: Record<string, any> = {
      tenant_id: activeTenant.id,
      unit_id: selectedUnit,
      professional_id: targetProfId,
      patient_id: formEventType === 'clinic' ? formPatient : null,
      procedure_id: formEventType === 'clinic' && formProcedure ? formProcedure : null,
      event_type: formEventType,
      title:
        formEventType === 'personal'
          ? formTitle.trim()
          : formTitle.trim() || patObj?.name || 'Atendimento Clínico',
      start_time: startIso,
      end_time: endIso,
      status: formStatus,
      room: formEventType === 'clinic' ? formRoom : formRoom || 'Pessoal',
      color: formColor,
      notes: formNotes.trim() || null,
      whatsapp_notify: formWhatsappNotify,
      whatsapp_reminder_minutes: Number(formWhatsappMinutes || 60),
      whatsapp_phone: resolvedPhone || null,
      whatsapp_custom_message: formWhatsappMessage.trim() || null
    };

    try {
      setSavingForm(true);

      if (editingAppointment) {
        // ATUALIZAR COMPROMISSO EXISTENTE
        const { data: updatedRow, error } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', editingAppointment.id)
          .select(`
            *,
            patient:patients(*),
            professional:profiles(*),
            procedure:procedures(*)
          `)
          .single();

        if (error) throw error;

        setIsModalOpen(false);
        setSelectedDate(formDate);
        if (targetProfId !== selectedDentist && !isStrictDentist) {
          setSelectedDentist(targetProfId);
        }

        setAppointments(prev =>
          prev.map(item => (item.id === updatedRow.id ? updatedRow : item))
        );

        // Disparar animação de ALTERAÇÃO
        setAnimatingEvent({ id: updatedRow.id, type: 'updated' });
        setTimeout(() => setAnimatingEvent(null), 950);

        triggerToast(
          'updated',
          'Compromisso Alterado!',
          `${
            updatedRow.event_type === 'personal'
              ? updatedRow.title
              : updatedRow.patient?.name || updatedRow.title
          } atualizado para ${formTime}.`
        );
      } else {
        // CRIAR NOVO COMPROMISSO
        const { data: createdRow, error } = await supabase
          .from('appointments')
          .insert([payload])
          .select(`
            *,
            patient:patients(*),
            professional:profiles(*),
            procedure:procedures(*)
          `)
          .single();

        if (error) throw error;

        setIsModalOpen(false);
        setSelectedDate(formDate);
        if (targetProfId !== selectedDentist && !isStrictDentist) {
          setSelectedDentist(targetProfId);
        }

        setAppointments(prev =>
          [...prev, createdRow].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          )
        );

        // Rolar suavemente até o horário do novo compromisso na grade
        const [hourNum] = formTime.split(':').map(Number);
        if (timeGridScrollRef.current && !isNaN(hourNum)) {
          timeGridScrollRef.current.scrollTo({
            top: Math.max(0, (hourNum - 1.5) * HOUR_HEIGHT),
            behavior: 'smooth'
          });
        }

        // Disparar animação de ADIÇÃO
        setAnimatingEvent({ id: createdRow.id, type: 'added' });
        setTimeout(() => setAnimatingEvent(null), 950);

        triggerToast(
          'added',
          formEventType === 'personal'
            ? 'Compromisso Pessoal Agendado!'
            : 'Atendimento Agendado!',
          formWhatsappNotify
            ? `Aviso WhatsApp programado (${formatReminderAntecedencia(formWhatsappMinutes)}).`
            : 'Adicionado à agenda do profissional.'
        );
      }
    } catch (err: any) {
      console.error('Erro ao salvar compromisso:', err);
      alert('Erro ao salvar compromisso: ' + err.message);
    } finally {
      setSavingForm(false);
    }
  };

  // Excluir Compromisso com Animação de Saída Implosiva
  const handleDeleteAppointment = async (appointmentToDelete: any) => {
    if (!appointmentToDelete) return;
    const label =
      appointmentToDelete.event_type === 'personal'
        ? appointmentToDelete.title
        : appointmentToDelete.patient?.name || 'este compromisso';

    if (!confirm(`Deseja realmente excluir "${label}" da agenda?`)) return;

    const targetId = appointmentToDelete.id;
    setIsModalOpen(false);

    // 1. Iniciar animação visual de exclusão no bloco da grade
    setAnimatingEvent({ id: targetId, type: 'deleted' });

    try {
      // Aguardar a animação de saída terminar (440ms) enquanto remove do banco
      const [deleteResult] = await Promise.all([
        supabase.from('appointments').delete().eq('id', targetId),
        new Promise(resolve => setTimeout(resolve, 440))
      ]);

      if (deleteResult.error) throw deleteResult.error;

      setAppointments(prev => prev.filter(a => a.id !== targetId));
      setAnimatingEvent(null);

      triggerToast(
        'deleted',
        'Compromisso Excluído',
        `"${label}" foi removido da agenda.`
      );
    } catch (err: any) {
      setAnimatingEvent(null);
      console.error('Erro ao excluir compromisso:', err);
      alert('Erro ao excluir compromisso: ' + err.message);
    }
  };

  // Check-in na recepção (para atendimentos clínicos)
  const handleCheckIn = async (appointmentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeTenant) return;
    const now = new Date().toISOString();

    try {
      const { data: existingFlow, error: selectError } = await supabase
        .from('clinic_flow')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (!existingFlow) {
        const { error: insertError } = await supabase.from('clinic_flow').insert([
          {
            appointment_id: appointmentId,
            status: 'checked_in',
            checked_in_at: now,
            tenant_id: activeTenant.id
          }
        ]);
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('clinic_flow')
          .update({ status: 'checked_in', checked_in_at: now })
          .eq('appointment_id', appointmentId)
          .eq('tenant_id', activeTenant.id);
        if (updateError) throw updateError;
      }

      await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointmentId);

      setAppointments(prev =>
        prev.map(a => (a.id === appointmentId ? { ...a, status: 'confirmed' } : a))
      );

      setAnimatingEvent({ id: appointmentId, type: 'updated' });
      setTimeout(() => setAnimatingEvent(null), 900);

      triggerToast(
        'updated',
        'Check-in Realizado!',
        'Paciente confirmado e enviado para o Fluxo na Clínica.'
      );
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao realizar check-in:', err);
      alert('Erro ao realizar check-in: ' + err.message);
    }
  };

  // Cálculo de posicionamento (top, height, left, width) para eventos de um dia na grade horária
  const getLayoutEventsForDay = (dayDateStr: string) => {
    const dayEvents = filteredAppointments
      .filter(app => toLocalDateStr(new Date(app.start_time)) === dayDateStr)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Algoritmo de colunas para eventos que se sobrepõem no mesmo horário
    const positioned: Array<{
      app: any;
      top: number;
      height: number;
      colIndex: number;
      totalCols: number;
      startMins: number;
      endMins: number;
    }> = [];

    dayEvents.forEach(app => {
      const s = new Date(app.start_time);
      const e = new Date(app.end_time);
      const startMins = s.getHours() * 60 + s.getMinutes();
      const rawEndMins = e.getHours() * 60 + e.getMinutes();
      const durationMins = Math.max(25, rawEndMins > startMins ? rawEndMins - startMins : 60);
      const endMins = startMins + durationMins;

      const top = (startMins / 60) * HOUR_HEIGHT;
      const height = Math.max(28, (durationMins / 60) * HOUR_HEIGHT - 2);

      // Encontrar eventos já posicionados que colidem com este intervalo
      const overlapping = positioned.filter(
        p => p.startMins < endMins && p.endMins > startMins
      );

      const usedCols = new Set(overlapping.map(o => o.colIndex));
      let colIndex = 0;
      while (usedCols.has(colIndex)) colIndex++;

      const newTotalCols = Math.max(colIndex + 1, ...overlapping.map(o => o.totalCols), 1);
      overlapping.forEach(o => {
        o.totalCols = Math.max(o.totalCols, newTotalCols);
      });

      positioned.push({
        app,
        top,
        height,
        colIndex,
        totalCols: newTotalCols,
        startMins,
        endMins
      });
    });

    return positioned;
  };

  // Rótulo do período no cabeçalho estilo Google Calendar
  const periodHeaderLabel = useMemo(() => {
    const base = parseLocalDate(selectedDate);
    if (viewMode === 'day') {
      return base.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
    if (viewMode === 'week') {
      const first = displayedDays[0];
      const last = displayedDays[displayedDays.length - 1];
      if (first.getMonth() === last.getMonth()) {
        return first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      }
      const m1 = first.toLocaleDateString('pt-BR', { month: 'short' });
      const m2 = last.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      return `${m1} – ${m2}`;
    }
    return base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedDate, viewMode, displayedDays]);

  const todayStr = toLocalDateStr(nowTime);
  const currentTimeTopPx = ((nowTime.getHours() * 60 + nowTime.getMinutes()) / 60) * HOUR_HEIGHT;

  // Estatísticas rápidas de lembretes WhatsApp do profissional ativo
  const whatsappStats = useMemo(() => {
    const withWhatsapp = filteredAppointments.filter(a => a.whatsapp_notify);
    const sentCount = withWhatsapp.filter(a => a.whatsapp_reminder_sent).length;
    const pendingCount = withWhatsapp.length - sentCount;
    return { total: withWhatsapp.length, sentCount, pendingCount };
  }, [filteredAppointments]);

  const currentProf = professionals.find(p => p.id === selectedDentist);

  return (
    <div className={styles.container}>
      {/* ====================================================================
          TOP HEADER BAR (ESTILO GOOGLE CALENDAR)
          ==================================================================== */}
      <header className={styles.calendarHeader}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.sidebarToggleBtn}
            onClick={() => setIsSidebarOpen(prev => !prev)}
            title={isSidebarOpen ? 'Recolher painel lateral' : 'Expandir painel lateral'}
          >
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>

          <div className={styles.brandGroup}>
            <div className={styles.calendarLogo}>
              <span className={styles.calendarLogoDay}>{nowTime.getDate()}</span>
            </div>
            <span className={styles.brandTitle}>Agenda</span>
          </div>

          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => navigateCalendar('today')}
          >
            Hoje
          </button>

          <div className={styles.navArrows}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => navigateCalendar('prev')}
              title="Período anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => navigateCalendar('next')}
              title="Próximo período"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <h2 className={styles.currentPeriodLabel}>{periodHeaderLabel}</h2>
        </div>

        <div className={styles.headerRight}>
          {/* SELETOR DE PROFISSIONAL COM PRIVACIDADE ISOLADA */}
          <div className={styles.professionalSelectorWrap}>
            <div
              className={styles.profAvatarMini}
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}
            >
              {(currentProf?.name || profile?.name || 'P').charAt(0).toUpperCase()}
            </div>

            {isStrictDentist ? (
              <span style={{ fontSize: '13px', fontWeight: 700, paddingRight: '4px' }}>
                {currentProf?.name || profile?.name || 'Minha Agenda'}
              </span>
            ) : (
              <select
                className={styles.professionalSelect}
                value={selectedDentist}
                onChange={e => {
                  setGridAnimKey(prev => prev + 1);
                  setSelectedDentist(e.target.value);
                  setFormDentist(e.target.value);
                }}
                title="Selecionar agenda exclusiva do profissional"
              >
                {professionals.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.specialty ? `• ${d.specialty}` : ''}
                  </option>
                ))}
              </select>
            )}

            <span
              className={styles.privacyBadge}
              title="Isolamento ativo: um profissional não vê o compromisso do outro"
            >
              <ShieldCheck size={12} />
              Agenda Isolada
            </span>
          </div>

          {/* SELETOR DE VISÃO: DIA / SEMANA / MÊS / PROGRAMAÇÃO */}
          <div className={styles.viewSwitcher}>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'day' ? styles.viewBtnActive : ''}`}
              onClick={() => {
                setGridAnimKey(prev => prev + 1);
                setViewMode('day');
              }}
            >
              Dia
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'week' ? styles.viewBtnActive : ''}`}
              onClick={() => {
                setGridAnimKey(prev => prev + 1);
                setViewMode('week');
              }}
            >
              Semana
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'month' ? styles.viewBtnActive : ''}`}
              onClick={() => {
                setGridAnimKey(prev => prev + 1);
                setViewMode('month');
              }}
            >
              Mês
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'schedule' ? styles.viewBtnActive : ''}`}
              onClick={() => {
                setGridAnimKey(prev => prev + 1);
                setViewMode('schedule');
              }}
            >
              Programação
            </button>
          </div>

          <button
            type="button"
            onClick={fetchAppointments}
            className={styles.iconBtn}
            title="Sincronizar agenda"
          >
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* ====================================================================
          CORPO PRINCIPAL DA AGENDA (SIDEBAR + GRADE GOOGLE CALENDAR)
          ==================================================================== */}
      <div className={styles.calendarBody}>
        {/* SIDEBAR ESQUERDA ESTILO GOOGLE CALENDAR */}
        {isSidebarOpen && (
          <aside className={styles.calendarSidebar}>
            <button
              type="button"
              className={styles.createFabBtn}
              onClick={() => handleOpenCreateModal(selectedDate, '09:00', 'clinic')}
            >
              <Plus size={20} />
              <span>Criar Compromisso</span>
            </button>

            <div className={styles.quickTypeRow}>
              <button
                type="button"
                className={styles.quickTypeBtn}
                onClick={() => handleOpenCreateModal(selectedDate, '09:00', 'clinic')}
              >
                <Stethoscope size={13} />
                <span>Clínico</span>
              </button>
              <button
                type="button"
                className={styles.quickTypeBtn}
                onClick={() => handleOpenCreateModal(selectedDate, '12:00', 'personal')}
              >
                <Briefcase size={13} />
                <span>Pessoal</span>
              </button>
            </div>

            {/* MINI CALENDÁRIO INTERATIVO */}
            <div className={styles.miniCalendar}>
              <div className={styles.miniCalHeader}>
                <span className={styles.miniCalTitle}>
                  {parseLocalDate(selectedDate).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ width: 26, height: 26 }}
                    onClick={() => {
                      const d = parseLocalDate(selectedDate);
                      d.setMonth(d.getMonth() - 1);
                      setSelectedDate(toLocalDateStr(d));
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ width: 26, height: 26 }}
                    onClick={() => {
                      const d = parseLocalDate(selectedDate);
                      d.setMonth(d.getMonth() + 1);
                      setSelectedDate(toLocalDateStr(d));
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className={styles.miniCalGrid}>
                {MINI_WEEKDAYS.map((w, i) => (
                  <span key={i} className={styles.miniCalWeekday}>
                    {w}
                  </span>
                ))}
                {monthCalendarDays.map(cell => {
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDate;
                  const hasEvents = daysWithEventsSet.has(cell.dateStr);

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setGridAnimKey(prev => prev + 1);
                        setSelectedDate(cell.dateStr);
                      }}
                      className={[
                        styles.miniCalDay,
                        !cell.isCurrentMonth ? styles.miniCalDayOutside : '',
                        isToday ? styles.miniCalDayToday : '',
                        isSelected ? styles.miniCalDaySelected : ''
                      ].join(' ')}
                    >
                      {cell.date.getDate()}
                      {hasEvents && <span className={styles.miniCalDot} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LISTA DE PROFISSIONAIS (AGENDA INDIVIDUAL ISOLADA) */}
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionTitle}>
                <span>Agenda por Profissional</span>
                <Lock size={12} />
              </div>
              <div className={styles.profList}>
                {(isStrictDentist
                  ? professionals.filter(p => p.id === user?.id)
                  : professionals
                ).map((prof, idx) => {
                  const isActive = prof.id === selectedDentist;
                  const paletteColor = CALENDAR_COLORS[idx % CALENDAR_COLORS.length].hex;
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => {
                        if (!isStrictDentist) {
                          setGridAnimKey(prev => prev + 1);
                          setSelectedDentist(prof.id);
                          setFormDentist(prof.id);
                        }
                      }}
                      className={`${styles.profCardBtn} ${isActive ? styles.profCardBtnActive : ''}`}
                    >
                      <div
                        className={styles.profAvatarMini}
                        style={{ backgroundColor: paletteColor }}
                      >
                        {prof.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.profCardInfo}>
                        <span className={styles.profCardName}>{prof.name}</span>
                        <span className={styles.profCardRole}>
                          {prof.role === 'dentist' ? 'Cirurgião-Dentista' : 'Profissional / Admin'}
                        </span>
                      </div>
                      {isActive && <Check size={14} style={{ color: 'hsl(var(--primary))' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FILTRO DE TIPOS DE COMPROMISSO ("MINHAS AGENDAS") */}
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionTitle}>
                <span>Tipos de Compromisso</span>
              </div>

              <label className={styles.filterCheckRow} onClick={() => setShowClinicEvents(v => !v)}>
                <div
                  className={styles.filterColorBox}
                  style={{
                    backgroundColor: showClinicEvents ? '#039be5' : 'transparent',
                    border: '2px solid #039be5'
                  }}
                >
                  {showClinicEvents && <Check size={11} />}
                </div>
                <span>Atendimentos na Clínica</span>
              </label>

              <label
                className={styles.filterCheckRow}
                onClick={() => setShowPersonalEvents(v => !v)}
              >
                <div
                  className={styles.filterColorBox}
                  style={{
                    backgroundColor: showPersonalEvents ? '#8e24aa' : 'transparent',
                    border: '2px solid #8e24aa'
                  }}
                >
                  {showPersonalEvents && <Check size={11} />}
                </div>
                <span>Compromissos Pessoais</span>
              </label>
            </div>

            {/* RESUMO DE AVISOS WHATSAPP */}
            <div className={styles.whatsappSummaryBox}>
              <div className={styles.whatsappSummaryHeader}>
                <MessageCircle size={15} />
                <span>Lembretes WhatsApp</span>
              </div>
              <p className={styles.whatsappSummaryText}>
                <strong>{whatsappStats.total}</strong> compromissos com aviso ativo (
                <strong>{whatsappStats.sentCount}</strong> enviados,{' '}
                <strong>{whatsappStats.pendingCount}</strong> programados por antecedência).
              </p>
            </div>
          </aside>
        )}

        {/* ==================================================================
            ÁREA PRINCIPAL DO CALENDÁRIO (SEMANA / DIA / MÊS / PROGRAMAÇÃO)
            ================================================================== */}
        <section key={gridAnimKey} className={`${styles.calendarMain} ${styles.gridTransition}`}>
          {/* 1. VISÃO SEMANA E VISÃO DIA (GRADE DE HORÁRIOS GOOGLE CALENDAR) */}
          {(viewMode === 'week' || viewMode === 'day') && (
            <>
              {/* Cabeçalho fixo dos dias */}
              <div className={styles.weekHeaderRow}>
                <div className={styles.timeGutterHeader}>GMT-03</div>
                <div
                  className={styles.dayColumnsHeader}
                  style={{
                    gridTemplateColumns: `repeat(${displayedDays.length}, minmax(110px, 1fr))`
                  }}
                >
                  {displayedDays.map(dayDate => {
                    const dStr = toLocalDateStr(dayDate);
                    const isToday = dStr === todayStr;
                    const isSelected = dStr === selectedDate;
                    return (
                      <div
                        key={dStr}
                        className={styles.dayHeaderCell}
                        onClick={() => {
                          setSelectedDate(dStr);
                          if (viewMode === 'week') {
                            // Permite selecionar o dia ou criar evento rápido
                          }
                        }}
                      >
                        <span
                          className={`${styles.dayHeaderWeekday} ${
                            isToday ? styles.dayHeaderWeekdayToday : ''
                          }`}
                        >
                          {WEEKDAY_SHORT[dayDate.getDay()]}
                        </span>
                        <div
                          className={[
                            styles.dayHeaderNumber,
                            isToday ? styles.dayHeaderNumberToday : '',
                            isSelected ? styles.dayHeaderNumberSelected : ''
                          ].join(' ')}
                        >
                          {dayDate.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grade de Horários 24h com Scroll */}
              <div className={styles.timeGridScroll} ref={timeGridScrollRef}>
                {/* Coluna lateral de horas (00:00 a 23:00) */}
                <div className={styles.timeGutter}>
                  {HOURS.map(hour => (
                    <div key={hour} className={styles.hourLabelSlot}>
                      {hour > 0 && (
                        <span className={styles.hourLabelText}>
                          {String(hour).padStart(2, '0')}:00
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Colunas de cada dia */}
                <div
                  className={styles.dayColumnsGrid}
                  style={{
                    gridTemplateColumns: `repeat(${displayedDays.length}, minmax(110px, 1fr))`
                  }}
                >
                  {displayedDays.map(dayDate => {
                    const dStr = toLocalDateStr(dayDate);
                    const isToday = dStr === todayStr;
                    const layoutEvents = getLayoutEventsForDay(dStr);

                    return (
                      <div
                        key={dStr}
                        className={`${styles.dayColumn} ${isToday ? styles.dayColumnToday : ''}`}
                      >
                        {/* Slots clicáveis de 30 em 30 minutos */}
                        {HOURS.map(hour => {
                          const slot00 = `${String(hour).padStart(2, '0')}:00`;
                          const slot30 = `${String(hour).padStart(2, '0')}:30`;
                          return (
                            <React.Fragment key={hour}>
                              <div
                                className={styles.halfHourCell}
                                onClick={() => handleOpenCreateModal(dStr, slot00, 'clinic')}
                              >
                                <span className={styles.slotHoverHint}>
                                  <Plus size={10} /> {slot00}
                                </span>
                              </div>
                              <div
                                className={`${styles.halfHourCell} ${styles.halfHourCellHourEnd}`}
                                onClick={() => handleOpenCreateModal(dStr, slot30, 'clinic')}
                              >
                                <span className={styles.slotHoverHint}>
                                  <Plus size={10} /> {slot30}
                                </span>
                              </div>
                            </React.Fragment>
                          );
                        })}

                        {/* Linha vermelha do horário atual no dia de hoje */}
                        {isToday && (
                          <div
                            className={styles.currentTimeLine}
                            style={{ top: `${currentTimeTopPx}px` }}
                          >
                            <div className={styles.currentTimeDot} />
                          </div>
                        )}

                        {/* Blocos dos Compromissos posicionados por horário */}
                        {layoutEvents.map(item => {
                          const { app, top, height, colIndex, totalCols } = item;
                          const isPersonal = app.event_type === 'personal';
                          const colorKey = app.color || (isPersonal ? 'grape' : 'peacock');
                          const startStr = new Date(app.start_time).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          const endStr = new Date(app.end_time).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          const widthPct = 96 / totalCols;
                          const leftPct = colIndex * widthPct + 2;

                          let animClass = '';
                          if (animatingEvent && animatingEvent.id === app.id) {
                            if (animatingEvent.type === 'added') {
                              animClass = styles.eventAddedAnimation;
                            } else if (animatingEvent.type === 'updated') {
                              animClass = styles.eventUpdatedAnimation;
                            } else if (animatingEvent.type === 'deleted') {
                              animClass = styles.eventDeletedAnimation;
                            }
                          }

                          const displayTitle = isPersonal
                            ? app.title || 'Compromisso Pessoal'
                            : app.patient?.name || app.title || 'Atendimento Clínico';

                          return (
                            <div
                              key={app.id}
                              onClick={e => handleOpenEditModal(app, e)}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`
                              }}
                              className={[
                                styles.calendarEvent,
                                styles[`color_${colorKey}`] || styles.color_peacock,
                                app.status === 'canceled' ? styles.calendarEventCanceled : '',
                                animClass
                              ].join(' ')}
                            >
                              <div className={styles.eventTopRow}>
                                <span className={styles.eventTitle}>
                                  {isPersonal ? (
                                    <Briefcase size={11} style={{ flexShrink: 0 }} />
                                  ) : (
                                    <Stethoscope size={11} style={{ flexShrink: 0 }} />
                                  )}
                                  {displayTitle}
                                </span>

                                <div className={styles.eventBadgesRow}>
                                  {isPersonal && (
                                    <span className={styles.personalMiniTag}>Pessoal</span>
                                  )}
                                  {app.whatsapp_notify && (
                                    <span
                                      className={styles.whatsappMiniTag}
                                      title={
                                        app.whatsapp_reminder_sent
                                          ? 'Aviso WhatsApp já enviado'
                                          : `Aviso WhatsApp programado (${formatReminderAntecedencia(
                                              Number(app.whatsapp_reminder_minutes || 60)
                                            )})`
                                      }
                                    >
                                      <MessageCircle size={9} />
                                      {app.whatsapp_reminder_sent
                                        ? 'Avisado'
                                        : formatReminderAntecedencia(
                                            Number(app.whatsapp_reminder_minutes || 60)
                                          )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className={styles.eventTime}>
                                {startStr} – {endStr}
                              </span>

                              {height >= 54 && (
                                <div className={styles.eventMeta}>
                                  {!isPersonal && app.room && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <MapPin size={10} />
                                      {app.room}
                                    </span>
                                  )}
                                  {app.procedure?.name && <span>• {app.procedure.name}</span>}
                                  {isPersonal && app.notes && <span>{app.notes}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 2. VISÃO MÊS (MONTH VIEW ESTILO GOOGLE CALENDAR) */}
          {viewMode === 'month' && (
            <div className={styles.monthGridWrapper}>
              <div className={styles.monthWeekdaysRow}>
                {WEEKDAY_SHORT.map(w => (
                  <div key={w} className={styles.monthWeekdayCell}>
                    {w}
                  </div>
                ))}
              </div>

              <div className={styles.monthDaysGrid}>
                {monthCalendarDays.map(cell => {
                  const isToday = cell.dateStr === todayStr;
                  const dayEvents = filteredAppointments.filter(
                    app => toLocalDateStr(new Date(app.start_time)) === cell.dateStr
                  );

                  return (
                    <div
                      key={cell.dateStr}
                      className={`${styles.monthDayCell} ${
                        !cell.isCurrentMonth ? styles.monthDayCellOutside : ''
                      }`}
                      onClick={() => handleOpenCreateModal(cell.dateStr, '09:00', 'clinic')}
                    >
                      <div className={styles.monthDayHeader}>
                        <span
                          className={`${styles.monthDayNumber} ${
                            isToday ? styles.monthDayNumberToday : ''
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>
                      </div>

                      <div className={styles.monthEventsList}>
                        {dayEvents.map(app => {
                          const isPersonal = app.event_type === 'personal';
                          const colorKey = app.color || (isPersonal ? 'grape' : 'peacock');
                          const timeStr = new Date(app.start_time).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          const label = isPersonal
                            ? app.title || 'Pessoal'
                            : app.patient?.name || app.title || 'Consulta';

                          let animClass = '';
                          if (animatingEvent && animatingEvent.id === app.id) {
                            if (animatingEvent.type === 'added') animClass = styles.eventAddedAnimation;
                            if (animatingEvent.type === 'updated') animClass = styles.eventUpdatedAnimation;
                            if (animatingEvent.type === 'deleted') animClass = styles.eventDeletedAnimation;
                          }

                          return (
                            <div
                              key={app.id}
                              onClick={e => handleOpenEditModal(app, e)}
                              className={[
                                styles.monthEventPill,
                                styles[`color_${colorKey}`] || styles.color_peacock,
                                animClass
                              ].join(' ')}
                            >
                              <span>{timeStr}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {label}
                              </span>
                              {app.whatsapp_notify && <MessageCircle size={10} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. VISÃO PROGRAMAÇÃO / LISTA (GOOGLE CALENDAR SCHEDULE VIEW) */}
          {viewMode === 'schedule' && (
            <div className={styles.scheduleWrapper}>
              {(() => {
                const grouped: Record<string, any[]> = {};
                filteredAppointments.forEach(app => {
                  const dStr = toLocalDateStr(new Date(app.start_time));
                  if (!grouped[dStr]) grouped[dStr] = [];
                  grouped[dStr].push(app);
                });
                const sortedDates = Object.keys(grouped).sort();

                if (sortedDates.length === 0) {
                  return (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '64px 20px',
                        color: 'hsl(var(--text-muted))',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <CalendarIcon size={42} style={{ opacity: 0.4 }} />
                      <p style={{ fontSize: '15px', fontWeight: 600 }}>
                        Nenhum compromisso agendado para {currentProf?.name || 'este profissional'}{' '}
                        neste período.
                      </p>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => handleOpenCreateModal(selectedDate, '09:00', 'clinic')}
                      >
                        <Plus size={16} />
                        Criar Primeiro Compromisso
                      </button>
                    </div>
                  );
                }

                return sortedDates.map(dStr => {
                  const dObj = parseLocalDate(dStr);
                  const isToday = dStr === todayStr;

                  return (
                    <div key={dStr} className={styles.scheduleDayGroup}>
                      <div className={styles.scheduleDateCol}>
                        <div
                          className={`${styles.scheduleDateCircle} ${
                            isToday ? styles.scheduleDateCircleToday : ''
                          }`}
                        >
                          {dObj.getDate()}
                        </div>
                        <div className={styles.scheduleDateMeta}>
                          <span className={styles.scheduleDateMonth}>
                            {dObj.toLocaleDateString('pt-BR', { month: 'short' })}
                          </span>
                          <span className={styles.scheduleDateWeekday}>
                            {dObj.toLocaleDateString('pt-BR', { weekday: 'short' })}
                          </span>
                        </div>
                      </div>

                      <div className={styles.scheduleEventsCol}>
                        {grouped[dStr].map(app => {
                          const isPersonal = app.event_type === 'personal';
                          const startStr = new Date(app.start_time).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          const endStr = new Date(app.end_time).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          const borderHex = getColorHex(app.color);

                          let animClass = '';
                          if (animatingEvent && animatingEvent.id === app.id) {
                            if (animatingEvent.type === 'added') animClass = styles.eventAddedAnimation;
                            if (animatingEvent.type === 'updated') animClass = styles.eventUpdatedAnimation;
                            if (animatingEvent.type === 'deleted') animClass = styles.eventDeletedAnimation;
                          }

                          return (
                            <div
                              key={app.id}
                              onClick={() => handleOpenEditModal(app)}
                              className={`${styles.scheduleEventRow} ${animClass}`}
                              style={{ borderLeftColor: borderHex }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    minWidth: '105px',
                                    color: 'hsl(var(--text-main))'
                                  }}
                                >
                                  {startStr} – {endStr}
                                </span>

                                <div>
                                  <div
                                    style={{
                                      fontSize: '15px',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                  >
                                    {isPersonal ? (
                                      <>
                                        <Briefcase size={14} style={{ color: borderHex }} />
                                        <span>{app.title || 'Compromisso Pessoal'}</span>
                                        <span className={styles.personalMiniTag}>Pessoal</span>
                                      </>
                                    ) : (
                                      <>
                                        <Stethoscope size={14} style={{ color: borderHex }} />
                                        <span>{app.patient?.name || app.title}</span>
                                      </>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '12px',
                                      color: 'hsl(var(--text-muted))',
                                      marginTop: 2
                                    }}
                                  >
                                    {app.professional?.name}{' '}
                                    {!isPersonal && app.room ? `• ${app.room}` : ''}
                                    {app.notes ? ` • ${app.notes}` : ''}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {app.whatsapp_notify && (
                                  <span className={styles.whatsappMiniTag} style={{ fontSize: 11, padding: '4px 8px' }}>
                                    <MessageCircle size={12} />
                                    {app.whatsapp_reminder_sent
                                      ? 'WhatsApp Enviado'
                                      : `WhatsApp (${formatReminderAntecedencia(
                                          Number(app.whatsapp_reminder_minutes || 60)
                                        )})`}
                                  </span>
                                )}

                                {!isPersonal && app.status === 'scheduled' && (
                                  <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                    onClick={e => handleCheckIn(app.id, e)}
                                  >
                                    <CheckCircle2 size={13} />
                                    Check-in
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>
      </div>

      {/* ====================================================================
          MODAL ESTILO GOOGLE CALENDAR (CRIAR / EDITAR / EXCLUIR / WHATSAPP)
          ==================================================================== */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div
              className={styles.modalColorStrip}
              style={{ backgroundColor: getColorHex(formColor) }}
            />

            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingAppointment ? (
                  <>
                    <Edit3 size={18} style={{ color: getColorHex(formColor) }} />
                    <span>Editar Compromisso</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} style={{ color: getColorHex(formColor) }} />
                    <span>Novo Compromisso na Agenda</span>
                  </>
                )}
              </h3>

              <div className={styles.modalHeaderActions}>
                {editingAppointment && (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Excluir compromisso"
                    onClick={() => handleDeleteAppointment(editingAppointment)}
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveAppointment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className={styles.modalBody}>
                {/* SELETOR DE TIPO: ATENDIMENTO NA CLÍNICA VS COMPROMISSO PESSOAL */}
                <div className={styles.eventTypeTabs}>
                  <button
                    type="button"
                    onClick={() => handleEventTypeSwitch('clinic')}
                    className={`${styles.eventTypeTab} ${
                      formEventType === 'clinic' ? styles.eventTypeTabActiveClinic : ''
                    }`}
                  >
                    <Stethoscope size={16} />
                    <span>Atendimento na Clínica</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEventTypeSwitch('personal')}
                    className={`${styles.eventTypeTab} ${
                      formEventType === 'personal' ? styles.eventTypeTabActivePersonal : ''
                    }`}
                  >
                    <Briefcase size={16} />
                    <span>Compromisso Pessoal</span>
                  </button>
                </div>

                {/* CAMPOS DINÂMICOS CONFORME TIPO */}
                {formEventType === 'personal' ? (
                  <div className={styles.formGroup}>
                    <label>
                      <Briefcase size={13} />
                      Título do Compromisso Pessoal *
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Ex: Almoço de negócios, Academia, Consulta Médica, Congresso..."
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>
                        <User size={13} />
                        Paciente *
                      </label>
                      <select
                        className={styles.select}
                        value={formPatient}
                        onChange={e => handlePatientSelect(e.target.value)}
                        required
                      >
                        <option value="">Selecione o Paciente...</option>
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.phone ? `(${p.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>
                        <Stethoscope size={13} />
                        Procedimento Previsto
                      </label>
                      <select
                        className={styles.select}
                        value={formProcedure}
                        onChange={e => setFormProcedure(e.target.value)}
                      >
                        <option value="">Avaliação / Consulta Geral</option>
                        {procedures.map(proc => (
                          <option key={proc.id} value={proc.id}>
                            {proc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* PROFISSIONAL E SALA/STATUS */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>
                      <Lock size={13} />
                      Profissional Responsável *
                    </label>
                    <select
                      className={styles.select}
                      value={isStrictDentist && user?.id ? user.id : formDentist}
                      onChange={e => setFormDentist(e.target.value)}
                      disabled={isStrictDentist}
                      required
                    >
                      {professionals.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formEventType === 'clinic' ? (
                    <div className={styles.formGroup}>
                      <label>
                        <MapPin size={13} />
                        Sala / Consultório
                      </label>
                      <select
                        className={styles.select}
                        value={formRoom}
                        onChange={e => setFormRoom(e.target.value)}
                      >
                        <option value="Consultório A">Consultório A</option>
                        <option value="Consultório B">Consultório B</option>
                        <option value="Consultório C">Consultório C</option>
                        <option value="Sala de Cirurgia">Sala de Cirurgia</option>
                      </select>
                    </div>
                  ) : (
                    <div className={styles.formGroup}>
                      <label>
                        <MapPin size={13} />
                        Local / Referência (Opcional)
                      </label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Ex: Externo, Online, Escritório..."
                        value={formRoom}
                        onChange={e => setFormRoom(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* DATA, HORÁRIO E DURAÇÃO */}
                <div className={styles.formRow3}>
                  <div className={styles.formGroup}>
                    <label>
                      <CalendarIcon size={13} />
                      Data *
                    </label>
                    <input
                      type="date"
                      className={styles.input}
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>
                      <Clock size={13} />
                      Horário Início *
                    </label>
                    <input
                      type="time"
                      className={styles.input}
                      value={formTime}
                      onChange={e => setFormTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>
                      <Clock size={13} />
                      Duração
                    </label>
                    <select
                      className={styles.select}
                      value={formDuration}
                      onChange={e => setFormDuration(e.target.value)}
                    >
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="45">45 minutos</option>
                      <option value="60">1 hora</option>
                      <option value="90">1h 30min</option>
                      <option value="120">2 horas</option>
                      <option value="180">3 horas</option>
                      <option value="240">4 horas</option>
                    </select>
                  </div>
                </div>

                {/* STATUS (SE EDITANDO) E COR DO GOOGLE CALENDAR */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Status do Compromisso</label>
                    <select
                      className={styles.select}
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value)}
                    >
                      <option value="scheduled">Agendado</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="canceled">Cancelado</option>
                      <option value="missed">Faltou / Não Compareceu</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Cor na Agenda (Google Calendar)</label>
                    <div className={styles.colorPickerRow}>
                      {CALENDAR_COLORS.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          title={c.label}
                          onClick={() => setFormColor(c.id)}
                          style={{ backgroundColor: c.hex }}
                          className={`${styles.colorSwatch} ${
                            formColor === c.id ? styles.colorSwatchSelected : ''
                          }`}
                        >
                          {formColor === c.id && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SEÇÃO DE AVISO PELO WHATSAPP COM ANTECEDÊNCIA */}
                <div className={styles.whatsappBox}>
                  <div
                    className={styles.whatsappToggleHeader}
                    onClick={() => setFormWhatsappNotify(prev => !prev)}
                  >
                    <div className={styles.whatsappTitleGroup}>
                      <div className={styles.whatsappIconBadge}>
                        <MessageCircle size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'hsl(var(--text-main))' }}>
                          Avisar compromisso pelo WhatsApp
                        </div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>
                          {formWhatsappNotify
                            ? `Ativado • Lembrete programado para ${
                                WHATSAPP_REMINDER_OPTIONS.find(o => o.value === formWhatsappMinutes)
                                  ?.label || `${formWhatsappMinutes} min antes`
                              }`
                            : 'Desativado • Nenhuma mensagem automática será enviada'}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`${styles.switchTrack} ${
                        formWhatsappNotify ? styles.switchTrackActive : ''
                      }`}
                    >
                      <div className={styles.switchThumb} />
                    </div>
                  </div>

                  {formWhatsappNotify && (
                    <div className={styles.whatsappFieldsGrid}>
                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label>
                            <Bell size={12} />
                            Antecedência do Aviso *
                          </label>
                          <select
                            className={styles.select}
                            value={formWhatsappMinutes}
                            onChange={e => setFormWhatsappMinutes(Number(e.target.value))}
                          >
                            {WHATSAPP_REMINDER_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className={styles.formGroup}>
                          <label>
                            <MessageCircle size={12} />
                            WhatsApp de Destino ({formEventType === 'personal' ? 'Seu Número' : 'Paciente'})
                          </label>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="(11) 99999-9999"
                            value={formWhatsappPhone}
                            onChange={e => setFormWhatsappPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Mensagem Personalizada (Opcional — deixe em branco para usar o modelo automático)</label>
                        <textarea
                          className={styles.textarea}
                          rows={2}
                          placeholder={buildDefaultWhatsappMessage(
                            formEventType,
                            selectedPatientObj?.name || 'Paciente',
                            activeProfessionalObj?.name || 'Dr(a).',
                            formTitle || 'Compromisso',
                            formDate,
                            formTime,
                            formRoom
                          )}
                          value={formWhatsappMessage}
                          onChange={e => setFormWhatsappMessage(e.target.value)}
                        />
                      </div>

                      {editingAppointment && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                            {editingAppointment.whatsapp_reminder_sent
                              ? '✅ Lembrete já enviado anteriormente'
                              : '⏳ Aguardando horário da antecedência para envio'}
                          </span>
                          <button
                            type="button"
                            className={styles.whatsappSendNowBtn}
                            disabled={sendingWhatsapp}
                            onClick={() =>
                              sendWhatsAppNotification(
                                {
                                  ...editingAppointment,
                                  event_type: formEventType,
                                  title: formTitle,
                                  room: formRoom,
                                  whatsapp_phone: formWhatsappPhone,
                                  whatsapp_custom_message: formWhatsappMessage
                                },
                                true
                              )
                            }
                          >
                            <Send size={13} />
                            <span>
                              {sendingWhatsapp ? 'Enviando...' : 'Enviar Aviso pelo WhatsApp Agora'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* OBSERVAÇÕES */}
                <div className={styles.formGroup}>
                  <label>Observações / Detalhes</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Anotações clínicas, preparativos ou detalhes do compromisso..."
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* RODAPÉ DO MODAL */}
              <div className={styles.modalFooter}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {editingAppointment && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteAppointment(editingAppointment)}
                    >
                      <Trash2 size={15} />
                      <span>Excluir</span>
                    </button>
                  )}

                  {editingAppointment &&
                    editingAppointment.event_type !== 'personal' &&
                    editingAppointment.status === 'scheduled' && (
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => handleCheckIn(editingAppointment.id)}
                      >
                        <CheckCircle2 size={15} style={{ color: 'hsl(var(--success))' }} />
                        <span>Fazer Check-in</span>
                      </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={savingForm}>
                    <Check size={16} />
                    <span>
                      {savingForm
                        ? 'Salvando...'
                        : editingAppointment
                        ? 'Salvar Alterações'
                        : 'Agendar Compromisso'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          TOAST FLUTUANTE ANIMADO DE CONFIRMAÇÃO (ADD / EDIT / DELETE / WA)
          ==================================================================== */}
      {toast && (
        <div className={styles.toastContainer}>
          <div
            className={styles.toastIcon}
            style={{
              backgroundColor:
                toast.type === 'deleted'
                  ? '#ef4444'
                  : toast.type === 'whatsapp'
                  ? '#25D366'
                  : toast.type === 'updated'
                  ? '#039be5'
                  : '#7c3aed'
            }}
          >
            {toast.type === 'deleted' ? (
              <Trash2 size={18} />
            ) : toast.type === 'whatsapp' ? (
              <MessageCircle size={18} />
            ) : (
              <Check size={18} />
            )}
          </div>
          <div className={styles.toastContent}>
            <span className={styles.toastTitle}>{toast.title}</span>
            <span className={styles.toastSubtitle}>{toast.subtitle}</span>
          </div>
        </div>
      )}
    </div>
  );
}
