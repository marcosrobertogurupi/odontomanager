import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Smile, 
  Activity, 
  BellRing,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import { checkAndGenerateSystemAnnouncements } from '../lib/systemAnnouncements';
import { useAverageSatisfaction } from '../lib/useAverageSatisfaction';
import styles from './Dashboard.module.css';

interface DashboardProps {
  selectedUnit: string;
}

interface DayBalance {
  dateStr: string;
  label: string;
  income: number;
  expense: number;
  isToday: boolean;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Data local no formato YYYY-MM-DD (toISOString usaria UTC e viraria o dia à noite no Brasil)
const toLocalDateStr = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Últimos 7 dias (6 dias atrás até hoje), já zerados
const buildLastSevenDays = (): DayBalance[] => {
  const days: DayBalance[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      dateStr: toLocalDateStr(d),
      label: WEEKDAY_LABELS[d.getDay()],
      income: 0,
      expense: 0,
      isToday: i === 0
    });
  }
  return days;
};

export default function Dashboard({ selectedUnit }: DashboardProps) {
  const { activeTenant, profile } = useTenant();
  const satisfactionRate = useAverageSatisfaction(activeTenant?.id);
  const firstName = profile?.name?.trim().split(/\s+/)[0] || '';
  const [stats, setStats] = useState({
    appointmentsCount: 0,
    waitingRoomCount: 0
  });
  const [weekBalance, setWeekBalance] = useState<DayBalance[]>(buildLastSevenDays);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const todayBalance = weekBalance.find(d => d.isToday);
  const todayIncome = todayBalance?.income ?? 0;
  const weekIncome = weekBalance.reduce((acc, d) => acc + d.income, 0);
  const weekExpense = weekBalance.reduce((acc, d) => acc + d.expense, 0);
  const chartMax = Math.max(...weekBalance.flatMap(d => [d.income, d.expense]), 0);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!activeTenant || !selectedUnit) return;

      try {
        // Limites do dia no fuso local do usuário
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

        const days = buildLastSevenDays();
        const firstDayStr = days[0].dateStr;

        // Executar consultas independentes em paralelo e usar Index-Only Scan / Count
        const [
          { data: txs, error: txError },
          { count: apptsCount, error: appError },
          { data: flowData, error: flowError }
        ] = await Promise.all([
          // 1. Movimentações financeiras dos últimos 7 dias (usa idx_transactions_tenant_unit_date)
          supabase
            .from('transactions')
            .select('type, amount, date')
            .eq('tenant_id', activeTenant.id)
            .eq('unit_id', selectedUnit)
            .gte('date', firstDayStr),

          // 2. Contar agendamentos de hoje sem trafegar todas as colunas/linhas
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', activeTenant.id)
            .eq('unit_id', selectedUnit)
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay),

          // 3. Carregar fila de espera ativa e atividades recentes (limitado e com projeção enxuta)
          supabase
            .from('clinic_flow')
            .select(`
              id,
              status,
              checked_in_at,
              appointment:appointments!inner(
                id,
                unit_id,
                patient:patients(name)
              )
            `)
            .eq('tenant_id', activeTenant.id)
            .eq('appointment.unit_id', selectedUnit)
            .order('checked_in_at', { ascending: false })
            .limit(50)
        ]);

        if (txError) throw txError;
        if (appError) throw appError;
        if (flowError) throw flowError;

        (txs || []).forEach((t: any) => {
          const day = days.find(d => d.dateStr === String(t.date).slice(0, 10));
          if (!day) return;
          if (t.type === 'income') day.income += Number(t.amount);
          else if (t.type === 'expense') day.expense += Number(t.amount);
        });
        setWeekBalance(days);

        const activeFlow = (flowData || []).filter((f: any) => f.status === 'waiting' || f.status === 'checked_in');
        setStats(prev => ({
          ...prev,
          appointmentsCount: apptsCount || 0,
          waitingRoomCount: activeFlow.length || 0
        }));

        const activities = (flowData || []).map((flowItem: any) => {
          const patientName = flowItem.appointment?.patient?.name || 'Paciente';
          const time = new Date(flowItem.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          let text = '';
          let color = '';
          
          if (flowItem.status === 'checked_in') {
            text = `${patientName} fez check-in na recepção.`;
            color = 'hsl(var(--secondary))';
          } else if (flowItem.status === 'waiting') {
            text = `${patientName} aguardando atendimento na sala de espera.`;
            color = 'hsl(var(--warning))';
          } else if (flowItem.status === 'in_consultation') {
            text = `${patientName} entrou para atendimento no consultório.`;
            color = 'hsl(var(--primary))';
          } else {
            text = `${patientName} finalizou a consulta (checkout realizado).`;
            color = 'hsl(var(--success))';
          }

          return { id: flowItem.id, text, time, color };
        });
        setRecentActivities(activities.slice(0, 5));

        // 4. Executar verificação e geração automática de alertas do sistema (estoque baixo, etc)
        await checkAndGenerateSystemAnnouncements(activeTenant.id, selectedUnit);

        // 5. Carregar comunicados/avisos reais
        const { data: noticesData, error: noticesError } = await supabase
          .from('announcements')
          .select('*')
          .eq('tenant_id', activeTenant.id)
          .or(`unit_id.is.null,unit_id.eq.${selectedUnit}`)
          .order('created_at', { ascending: false });

        if (noticesError) throw noticesError;
        setAnnouncements(noticesData || []);

      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
      }
    };

    if (activeTenant && selectedUnit) {
      loadDashboardData();
    }
  }, [selectedUnit, activeTenant]);

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div>
          <h1 className={styles.welcomeTitle}>{firstName ? `Olá, ${firstName}!` : 'Olá!'}</h1>
          <p className={styles.subtitle}>Veja como estão as atividades da sua clínica hoje.</p>
        </div>
      </div>

      {/* Cards de Métricas Rápidas */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIconContainer} style={{ backgroundColor: 'hsl(var(--primary-light))', color: 'hsl(var(--primary))' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{stats.appointmentsCount}</div>
            <div className={styles.statLabel}>Agendados para Hoje</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconContainer} style={{ backgroundColor: 'hsl(var(--warning-light))', color: 'hsl(var(--warning))' }}>
            <Users size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{stats.waitingRoomCount}</div>
            <div className={styles.statLabel}>Pacientes na Espera</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconContainer} style={{ backgroundColor: 'hsl(var(--success-light))', color: 'hsl(var(--success))' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div className={styles.statValue}>R$ {formatBRL(todayIncome)}</div>
            <div className={styles.statLabel}>Faturamento do Dia</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconContainer} style={{ backgroundColor: 'hsl(var(--danger-light))', color: 'hsl(var(--danger))' }}>
            <Smile size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{satisfactionRate !== null ? satisfactionRate.toFixed(1) : '—'}</div>
            <div className={styles.statLabel}>Satisfação Média</div>
          </div>
        </div>
      </div>

      {/* Seção Principal de Conteúdo */}
      <div className={styles.contentGrid}>
        {/* Lado Esquerdo - Gráfico Semanal & Atividades */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <TrendingUp size={20} style={{ color: 'hsl(var(--primary))' }} />
              Balanço Financeiro Semanal
            </h2>
            
            {/* Gráfico com as movimentações reais dos últimos 7 dias */}
            <div className={styles.chartContainer}>
              {weekBalance.map((day) => {
                const incomeHeight = chartMax > 0 ? Math.max((day.income / chartMax) * 85, day.income > 0 ? 2 : 0) : 0;
                const expenseHeight = chartMax > 0 ? Math.max((day.expense / chartMax) * 85, day.expense > 0 ? 2 : 0) : 0;
                return (
                  <div
                    key={day.dateStr}
                    className={styles.chartBarContainer}
                    title={`${day.label} — Entradas: R$ ${formatBRL(day.income)} | Saídas: R$ ${formatBRL(day.expense)}`}
                  >
                    <div
                      className={`${styles.chartBar} ${styles.chartBarIncome}`}
                      style={{ height: `${incomeHeight}%`, boxShadow: day.isToday && day.income > 0 ? '0 0 10px rgba(124,58,237,0.3)' : undefined }}
                    ></div>
                    <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: `${expenseHeight}%` }}></div>
                    <span
                      className={styles.chartLabel}
                      style={day.isToday ? { fontWeight: '700', color: 'hsl(var(--primary))' } : undefined}
                    >
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
                <span>Entradas (R$ {formatBRL(weekIncome)})</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'hsl(var(--danger))' }}></div>
                <span>Saídas (R$ {formatBRL(weekExpense)})</span>
              </div>
            </div>
          </div>

          {/* Atividade Recente */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <Activity size={20} style={{ color: 'hsl(var(--secondary))' }} />
              Fluxo Recente de Pacientes
            </h2>
            <div className={styles.activityList}>
              {recentActivities.length > 0 ? (
                recentActivities.map((act) => (
                  <div key={act.id} className={styles.activityItem}>
                    <div className={styles.activityDot} style={{ backgroundColor: act.color }}></div>
                    <div className={styles.activityContent}>
                      <p className={styles.activityText}>{act.text}</p>
                      <span className={styles.activityTime}>{act.time}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.subtitle} style={{ textAlign: 'center', padding: '20px' }}>Nenhuma atividade registrada hoje.</p>
              )}
            </div>
          </div>
        </div>

        {/* Lado Direito - Comunicados e Avisos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <BellRing size={20} style={{ color: 'hsl(var(--warning))' }} />
              Avisos e Comunicados
            </h2>
            <div className={styles.noticeBoard}>
              {announcements.length > 0 ? (
                announcements.map((notice) => {
                  let tagStyle = { backgroundColor: 'hsl(var(--success-light))', color: 'hsl(var(--success))' };
                  if (notice.tag_type === 'urgent') {
                    tagStyle = { backgroundColor: 'hsl(var(--danger-light))', color: 'hsl(var(--danger))' };
                  } else if (notice.tag_type === 'new') {
                    tagStyle = { backgroundColor: 'hsl(var(--primary-light))', color: 'hsl(var(--primary))' };
                  }

                  const createdDate = new Date(notice.created_at);
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);

                  let timeLabel = '';
                  if (createdDate.toDateString() === today.toDateString()) {
                    timeLabel = 'Hoje';
                  } else if (createdDate.toDateString() === yesterday.toDateString()) {
                    timeLabel = 'Ontem';
                  } else {
                    timeLabel = createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                  }

                  return (
                    <div key={notice.id} className={styles.noticeItem}>
                      <div className={styles.noticeHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={styles.noticeTag} style={tagStyle}>{notice.tag}</span>
                          {notice.is_system && (
                            <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              Automático
                            </span>
                          )}
                        </div>
                        <span className={styles.activityTime}>{timeLabel}</span>
                      </div>
                      <h4 className={styles.noticeTitle}>{notice.title}</h4>
                      <p className={styles.noticeBody}>{notice.body}</p>
                    </div>
                  );
                })
              ) : (
                <p className={styles.subtitle} style={{ textAlign: 'center', padding: '20px' }}>Nenhum aviso ou comunicado registrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
