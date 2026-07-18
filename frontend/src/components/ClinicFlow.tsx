import React, { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  ArrowRight, 
  Clock, 
  Check, 
  User, 
  Home, 
  Coffee, 
  Sparkles,
  Award
} from 'lucide-react';
import { API_URL } from '../config';
import styles from './ClinicFlow.module.css';

export default function ClinicFlow() {
  const [flowItems, setFlowItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFlow = () => {
    setLoading(true);
    fetch(`${API_URL}/api/clinic-flow`)
      .then(res => res.json())
      .then(data => {
        setFlowItems(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao buscar fluxo da clínica:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFlow();
    // Atualização em tempo real (simulação de pooling a cada 8 segundos)
    const interval = setInterval(fetchFlow, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    fetch(`${API_URL}/api/clinic-flow/${appointmentId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => res.json())
      .then(() => {
        fetchFlow();
      })
      .catch(err => console.error('Erro ao atualizar status:', err));
  };

  // Filtrar itens por coluna
  const checkedIn = flowItems.filter(item => item.status === 'checked_in');
  const waiting = flowItems.filter(item => item.status === 'waiting');
  const inConsultation = flowItems.filter(item => item.status === 'in_consultation');
  const checkedOut = flowItems.filter(item => item.status === 'checked_out');

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div>
          <h1 className={styles.title}>Fluxo na Clínica</h1>
          <p className={styles.subtitle}>Acompanhe o percurso dos pacientes em tempo real.</p>
        </div>
        <button 
          onClick={fetchFlow} 
          className={styles.actionBtn}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      </div>

      <div className={styles.flowGrid}>
        {/* COLUNA 1: RECEPCIONADO */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <Home size={18} style={{ color: 'hsl(var(--secondary))' }} />
              Recepção
            </span>
            <span className={styles.columnCount}>{checkedIn.length}</span>
          </div>
          <div className={styles.cardList}>
            {checkedIn.length > 0 ? (
              checkedIn.map(item => (
                <div key={item.id} className={styles.patientCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.patientName}>{item.appointment?.patient?.name}</span>
                    <span className={styles.timeInfo}>
                      <Clock size={12} />
                      {formatTime(item.checked_in_at)}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.dentistName}>
                      <User size={12} />
                      {item.appointment?.professional?.name}
                    </span>
                    <span className={styles.roomTag}>{item.appointment?.room}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button 
                      onClick={() => handleStatusChange(item.appointment_id, 'waiting')}
                      className={`${styles.actionBtn} ${styles.nextBtn}`}
                    >
                      <span>Enviar para Espera</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>Nenhum paciente na recepção</div>
            )}
          </div>
        </div>

        {/* COLUNA 2: SALA DE ESPERA */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <Coffee size={18} style={{ color: 'hsl(var(--warning))' }} />
              Sala de Espera
            </span>
            <span className={styles.columnCount}>{waiting.length}</span>
          </div>
          <div className={styles.cardList}>
            {waiting.length > 0 ? (
              waiting.map(item => (
                <div key={item.id} className={styles.patientCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.patientName}>{item.appointment?.patient?.name}</span>
                    <span className={styles.timeInfo}>
                      <Clock size={12} />
                      {formatTime(item.checked_in_at)}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.dentistName}>
                      <User size={12} />
                      {item.appointment?.professional?.name}
                    </span>
                    <span className={styles.roomTag}>{item.appointment?.room}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button 
                      onClick={() => handleStatusChange(item.appointment_id, 'in_consultation')}
                      className={`${styles.actionBtn} ${styles.nextBtn}`}
                    >
                      <span>Chamar</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>Sala de espera vazia</div>
            )}
          </div>
        </div>

        {/* COLUNA 3: EM CONSULTA */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} />
              Em Atendimento
            </span>
            <span className={styles.columnCount}>{inConsultation.length}</span>
          </div>
          <div className={styles.cardList}>
            {inConsultation.length > 0 ? (
              inConsultation.map(item => (
                <div key={item.id} className={styles.patientCard} style={{ boxShadow: 'var(--shadow-glow)' }}>
                  <div className={styles.cardHeader}>
                    <span className={styles.patientName}>{item.appointment?.patient?.name}</span>
                    <span className={styles.timeInfo} style={{ color: 'hsl(var(--primary))' }}>
                      <Clock size={12} />
                      {item.consultation_started_at ? formatTime(item.consultation_started_at) : ''}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.dentistName}>
                      <User size={12} />
                      {item.appointment?.professional?.name}
                    </span>
                    <span className={styles.roomTag}>{item.appointment?.room}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button 
                      onClick={() => handleStatusChange(item.appointment_id, 'checked_out')}
                      className={`${styles.actionBtn} ${styles.nextBtn}`}
                    >
                      <span>Finalizar Consulta</span>
                      <Check size={12} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>Nenhum atendimento em curso</div>
            )}
          </div>
        </div>

        {/* COLUNA 4: FINALIZADO */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <Award size={18} style={{ color: 'hsl(var(--success))' }} />
              Concluídos Hoje
            </span>
            <span className={styles.columnCount}>{checkedOut.length}</span>
          </div>
          <div className={styles.cardList}>
            {checkedOut.length > 0 ? (
              checkedOut.map(item => (
                <div key={item.id} className={styles.patientCard} style={{ opacity: 0.8 }}>
                  <div className={styles.cardHeader}>
                    <span className={styles.patientName}>{item.appointment?.patient?.name}</span>
                    <span className={styles.timeInfo}>
                      <Check size={12} style={{ color: 'hsl(var(--success))' }} />
                      Alta
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.dentistName}>
                      <User size={12} />
                      {item.appointment?.professional?.name}
                    </span>
                    <span className={styles.roomTag} style={{ backgroundColor: 'hsl(var(--success-light))', color: 'hsl(var(--success))' }}>
                      {item.appointment?.room}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>Nenhum checkout realizado hoje</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
