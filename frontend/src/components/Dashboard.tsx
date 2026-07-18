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
import { API_URL } from '../config';
import styles from './Dashboard.module.css';

interface DashboardProps {
  selectedUnit: string;
}

export default function Dashboard({ selectedUnit }: DashboardProps) {
  const [stats, setStats] = useState({
    appointmentsCount: 0,
    waitingRoomCount: 0,
    monthlyIncome: 0,
    satisfactionRate: 9.8
  });
  const [financials, setFinancials] = useState({ income: 0, expense: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    // 1. Carregar resumo financeiro
    fetch(`${API_URL}/api/transactions/summary`)
      .then(res => res.json())
      .then(data => {
        setFinancials({ income: data.income || 0, expense: data.expense || 0 });
      })
      .catch(err => console.error('Erro ao buscar financeiro:', err));

    // 2. Carregar agendamentos de hoje
    const todayStr = new Date().toISOString().split('T')[0];
    fetch(`${API_URL}/api/appointments?date=${todayStr}&unit_id=${selectedUnit}`)
      .then(res => res.json())
      .then(data => {
        setStats(prev => ({
          ...prev,
          appointmentsCount: data.length || 0
        }));
      })
      .catch(err => console.error('Erro ao buscar agendamentos:', err));

    // 3. Carregar fila de espera ativa
    fetch(`${API_URL}/api/clinic-flow`)
      .then(res => res.json())
      .then(data => {
        const activeFlow = data.filter((f: any) => f.status === 'waiting' || f.status === 'checked_in');
        setStats(prev => ({
          ...prev,
          waitingRoomCount: activeFlow.length || 0
        }));

        // Gerar atividades baseadas no fluxo da clínica
        const activities = data.map((flowItem: any) => {
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
      })
      .catch(err => console.error('Erro ao buscar fluxo:', err));

  }, [selectedUnit]);

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
              <div className={styles.noticeItem}>
                <div className={styles.noticeHeader}>
                  <span className={styles.noticeTag} style={{ backgroundColor: 'hsl(var(--danger-light))', color: 'hsl(var(--danger))' }}>Urgente</span>
                  <span className={styles.activityTime}>Hoje</span>
                </div>
                <h4 className={styles.noticeTitle}>Manutenção de Equipamento</h4>
                <p className={styles.noticeBody}>O autoclave do Consultório B passará por calibração obrigatória às 14h.</p>
              </div>

              <div className={styles.noticeItem}>
                <div className={styles.noticeHeader}>
                  <span className={styles.noticeTag} style={{ backgroundColor: 'hsl(var(--primary-light))', color: 'hsl(var(--primary))' }}>Novidade</span>
                  <span className={styles.activityTime}>Ontem</span>
                </div>
                <h4 className={styles.noticeTitle}>Nova Versão ZaiONe</h4>
                <p className={styles.noticeBody}>O assistente Zai agora avisa via WhatsApp quando o paciente chega na clínica!</p>
              </div>

              <div className={styles.noticeItem}>
                <div className={styles.noticeHeader}>
                  <span className={styles.noticeTag} style={{ backgroundColor: 'hsl(var(--success-light))', color: 'hsl(var(--success))' }}>Geral</span>
                  <span className={styles.activityTime}>15 Jul</span>
                </div>
                <h4 className={styles.noticeTitle}>Férias Dra. Beatriz</h4>
                <p className={styles.noticeBody}>Lembramos que a Dra. Beatriz estará ausente no período de 01 a 10 de Agosto.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
