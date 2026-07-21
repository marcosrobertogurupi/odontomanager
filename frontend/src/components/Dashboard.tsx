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
import styles from './Dashboard.module.css';

interface DashboardProps {
  selectedUnit: string;
}

export default function Dashboard({ selectedUnit }: DashboardProps) {
  const { activeTenant } = useTenant();
  const [stats, setStats] = useState({
    appointmentsCount: 0,
    waitingRoomCount: 0,
    monthlyIncome: 0,
    satisfactionRate: 9.8
  });
  const [financials, setFinancials] = useState({ income: 0, expense: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!activeTenant || !selectedUnit) return;

      try {
        // 1. Carregar resumo financeiro
        const { data: txs, error: txError } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('tenant_id', activeTenant.id)
          .eq('unit_id', selectedUnit);

        if (txError) throw txError;

        let income = 0;
        let expense = 0;
        (txs || []).forEach((t: any) => {
          if (t.type === 'income') income += Number(t.amount);
          else if (t.type === 'expense') expense += Number(t.amount);
        });
        setFinancials({ income, expense });

        // 2. Carregar agendamentos de hoje
        const todayStr = new Date().toISOString().split('T')[0];
        const startOfDay = `${todayStr}T00:00:00Z`;
        const endOfDay = `${todayStr}T23:59:59Z`;

        const { data: appts, error: appError } = await supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', activeTenant.id)
          .eq('unit_id', selectedUnit)
          .gte('start_time', startOfDay)
          .lte('start_time', endOfDay);

        if (appError) throw appError;

        setStats(prev => ({
          ...prev,
          appointmentsCount: appts?.length || 0
        }));

        // 3. Carregar fila de espera ativa e atividades recentes
        const { data: flowData, error: flowError } = await supabase
          .from('clinic_flow')
          .select(`
            *,
            appointment:appointments!inner(
              *,
              patient:patients(*)
            )
          `)
          .eq('tenant_id', activeTenant.id)
          .eq('appointment.unit_id', selectedUnit)
          .order('checked_in_at', { ascending: false });

        if (flowError) throw flowError;

        const activeFlow = (flowData || []).filter((f: any) => f.status === 'waiting' || f.status === 'checked_in');
        setStats(prev => ({
          ...prev,
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
          <h1 className={styles.welcomeTitle}>Olá, Dr. Carlos!</h1>
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
            <div className={styles.statValue}>R$ {financials.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className={styles.statLabel}>Faturamento do Dia</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconContainer} style={{ backgroundColor: 'hsl(var(--danger-light))', color: 'hsl(var(--danger))' }}>
            <Smile size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{stats.satisfactionRate}</div>
            <div className={styles.statLabel}>Satisfação Média</div>
          </div>
        </div>
      </div>

      {/* Seção Principal de Conteúdo */}
      <div className={styles.contentGrid}>
        {/* Lado Esquerdo - Gráfico Simulado & Atividades */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <TrendingUp size={20} style={{ color: 'hsl(var(--primary))' }} />
              Balanço Financeiro Semanal
            </h2>
            
            {/* Gráfico Simulado Premium */}
            <div className={styles.chartContainer}>
              <div className={styles.chartBarContainer}>
                <div className={`${styles.chartBar} ${styles.chartBarIncome}`} style={{ height: '70%' }}></div>
                <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: '30%' }}></div>
                <span className={styles.chartLabel}>Seg</span>
              </div>
              <div className={styles.chartBarContainer}>
                <div className={`${styles.chartBar} ${styles.chartBarIncome}`} style={{ height: '80%' }}></div>
                <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: '40%' }}></div>
                <span className={styles.chartLabel}>Ter</span>
              </div>
              <div className={styles.chartBarContainer}>
                <div className={`${styles.chartBar} ${styles.chartBarIncome}`} style={{ height: '60%' }}></div>
                <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: '25%' }}></div>
                <span className={styles.chartLabel}>Qua</span>
              </div>
              <div className={styles.chartBarContainer}>
                <div className={`${styles.chartBar} ${styles.chartBarIncome}`} style={{ height: '90%' }}></div>
                <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: '35%' }}></div>
                <span className={styles.chartLabel}>Qui</span>
              </div>
              <div className={styles.chartBarContainer}>
                <div className={`${styles.chartBar} ${styles.chartBarIncome}`} style={{ height: '85%' }}></div>
                <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: '50%' }}></div>
                <span className={styles.chartLabel}>Sex</span>
              </div>
              <div className={styles.chartBarContainer}>
                {/* Hoje */}
                <div className={`${styles.chartBar} ${styles.chartBarIncome}`} style={{ height: '95%', boxShadow: '0 0 10px rgba(124,58,237,0.3)' }}></div>
                <div className={`${styles.chartBar} ${styles.chartBarExpense}`} style={{ height: '45%' }}></div>
                <span className={styles.chartLabel} style={{ fontWeight: '700', color: 'hsl(var(--primary))' }}>Sáb</span>
              </div>
            </div>
            
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
                <span>Entradas (R$ {(financials.income).toLocaleString('pt-BR')})</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'hsl(var(--danger))' }}></div>
                <span>Saídas (R$ {(financials.expense).toLocaleString('pt-BR')})</span>
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
