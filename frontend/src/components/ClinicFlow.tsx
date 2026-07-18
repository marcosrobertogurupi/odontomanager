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
  Award,
  X,
  Boxes
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './ClinicFlow.module.css';

export default function ClinicFlow() {
  const { activeTenant, activeUnitId } = useTenant();
  const [flowItems, setFlowItems] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para modal de checkout (finalização de atendimento e insumos)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<any>(null);
  const [checkoutProcedureId, setCheckoutProcedureId] = useState('');
  const [checkoutConsumos, setCheckoutConsumos] = useState<any[]>([]);

  const fetchFlow = async () => {
    if (!activeTenant || !activeUnitId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinic_flow')
        .select(`
          *,
          appointment:appointments!inner(
            *,
            patient:patients(*),
            professional:profiles(*)
          )
        `)
        .eq('tenant_id', activeTenant.id)
        .eq('appointment.unit_id', activeUnitId)
        .order('checked_in_at', { ascending: false });

      if (error) throw error;
      setFlowItems(data || []);
    } catch (err) {
      console.error('Erro ao buscar fluxo da clínica:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProcedures = async () => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');
      if (error) throw error;
      setProcedures(data || []);
    } catch (err) {
      console.error('Erro ao carregar procedimentos:', err);
    }
  };

  useEffect(() => {
    if (activeTenant && activeUnitId) {
      fetchFlow();
      fetchProcedures();
      
      const interval = setInterval(fetchFlow, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTenant, activeUnitId]);

  const handleStatusChange = async (appointmentId: string, newStatus: string, extraBody: any = {}) => {
    if (!activeTenant || !activeUnitId) return;
    const now = new Date().toISOString();

    try {
      // 1. Tratamento específico se for checked_out ou revertendo checked_out
      if (newStatus === 'checked_out') {
        const { procedure_id, consumos } = extraBody;
        if (procedure_id && consumos && consumos.length > 0) {
          const { error: rpcError } = await supabase.rpc('registrar_consumo_atendimento', {
            p_appointment_id: appointmentId,
            p_procedimento_id: procedure_id,
            p_unit_id: activeUnitId,
            p_tenant_id: activeTenant.id,
            p_consumos: consumos
          });
          if (rpcError) throw rpcError;
        }

        // Atualiza status do agendamento para confirmado
        const { error: appError } = await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appointmentId)
          .eq('tenant_id', activeTenant.id);
        if (appError) throw appError;
      } else {
        // Se for alterado de checked_out para outro status, estorna os insumos
        const { data: currentFlow, error: getFlowError } = await supabase
          .from('clinic_flow')
          .select('status')
          .eq('appointment_id', appointmentId)
          .maybeSingle();

        if (getFlowError) throw getFlowError;

        if (currentFlow && currentFlow.status === 'checked_out') {
          const { error: revertError } = await supabase.rpc('estornar_consumo_atendimento', {
            p_appointment_id: appointmentId,
            p_unit_id: activeUnitId,
            p_tenant_id: activeTenant.id
          });
          if (revertError) throw revertError;

          // Se estornou, o status do agendamento deve voltar para 'scheduled'
          const { error: appError } = await supabase
            .from('appointments')
            .update({ status: 'scheduled' })
            .eq('id', appointmentId)
            .eq('tenant_id', activeTenant.id);
          if (appError) throw appError;
        }
      }

      // 2. Tenta ver se já existe registro de fluxo
      const { data: existingFlow, error: selectFlowError } = await supabase
        .from('clinic_flow')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (selectFlowError) throw selectFlowError;

      if (!existingFlow) {
        // Cria novo fluxo
        const insertData: any = {
          appointment_id: appointmentId,
          status: newStatus,
          checked_in_at: now,
          tenant_id: activeTenant.id
        };
        if (newStatus === 'in_consultation') insertData.consultation_started_at = now;
        if (newStatus === 'checked_out') insertData.consultation_ended_at = now;

        const { error: insertError } = await supabase
          .from('clinic_flow')
          .insert([insertData]);
        if (insertError) throw insertError;
      } else {
        // Atualiza fluxo existente
        const updateData: any = { status: newStatus };
        if (newStatus === 'in_consultation') updateData.consultation_started_at = now;
        if (newStatus === 'checked_out') updateData.consultation_ended_at = now;

        const { error: updateError } = await supabase
          .from('clinic_flow')
          .update(updateData)
          .eq('appointment_id', appointmentId)
          .eq('tenant_id', activeTenant.id);
        if (updateError) throw updateError;
      }

      fetchFlow();
    } catch (err: any) {
      console.error('Erro ao atualizar status do fluxo:', err);
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  const handleOpenCheckout = (item: any) => {
    setCheckoutItem(item);
    const procId = item.appointment?.procedure_id || '';
    setCheckoutProcedureId(procId);
    setIsCheckoutOpen(true);

    if (procId) {
      loadBOM(procId);
    } else {
      setCheckoutConsumos([]);
    }
  };

  const loadBOM = async (procId: string) => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('procedimento_insumos')
        .select(`
          procedimento_id,
          insumo_id,
          quantidade_padrao,
          insumo:insumos(*)
        `)
        .eq('procedimento_id', procId)
        .eq('tenant_id', activeTenant.id);

      if (error) throw error;
      setCheckoutConsumos((data || []).map((item: any) => ({
        insumo_id: item.insumo_id,
        nome: item.insumo?.nome || 'Insumo',
        unidade_medida: item.insumo?.unidade_medida || 'unidade',
        quantidade_padrao: item.quantidade_padrao,
        quantidade_usada: item.quantidade_padrao
      })));
    } catch (err) {
      console.error('Erro ao buscar BOM:', err);
    }
  };

  const handleProcedureChange = (procId: string) => {
    setCheckoutProcedureId(procId);
    if (procId) {
      loadBOM(procId);
    } else {
      setCheckoutConsumos([]);
    }
  };

  const handleConsumoChange = (idx: number, val: string) => {
    const updated = [...checkoutConsumos];
    updated[idx].quantidade_usada = Number(val);
    setCheckoutConsumos(updated);
  };

  const handleConfirmCheckout = () => {
    if (!checkoutItem) return;

    const payload = {
      procedure_id: checkoutProcedureId || null,
      consumos: checkoutConsumos.map(c => ({
        insumo_id: c.insumo_id,
        quantidade_usada: c.quantidade_usada
      }))
    };

    handleStatusChange(checkoutItem.appointment_id, 'checked_out', payload);
    setIsCheckoutOpen(false);
    setCheckoutItem(null);
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
                      onClick={() => handleOpenCheckout(item)}
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

      {/* MODAL DE CHECKOUT (CONSUMO DE INSUMOS NO ATENDIMENTO) */}
      {isCheckoutOpen && checkoutItem && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Finalização de Atendimento e Baixa de Insumos</h3>
              <button className={styles.closeBtn} onClick={() => setIsCheckoutOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <p><strong>Paciente:</strong> {checkoutItem.appointment?.patient?.name}</p>
              <p><strong>Profissional:</strong> {checkoutItem.appointment?.professional?.name}</p>
            </div>

            <div className={styles.formGroup}>
              <label>Procedimento Realizado</label>
              <select 
                className={styles.select}
                value={checkoutProcedureId}
                onChange={(e) => handleProcedureChange(e.target.value)}
              >
                <option value="">Nenhum procedimento associado...</option>
                {procedures.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {checkoutProcedureId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Boxes size={16} />
                  Insumos Utilizados (BOM)
                </h4>
                
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Insumo</th>
                        <th>Qtd Padrão</th>
                        <th>Qtd Real Usada</th>
                        <th>Unidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkoutConsumos.length > 0 ? (
                        checkoutConsumos.map((c, idx) => (
                          <tr key={c.insumo_id}>
                            <td style={{ fontWeight: '500' }}>{c.nome}</td>
                            <td>{c.quantidade_padrao}</td>
                            <td>
                              <input 
                                type="number" 
                                step="0.01" 
                                className={styles.input} 
                                style={{ width: '80px', padding: '4px 8px' }}
                                value={c.quantidade_usada}
                                onChange={(e) => handleConsumoChange(idx, e.target.value)}
                              />
                            </td>
                            <td>{c.unidade_medida}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'hsl(var(--text-muted))' }}>
                            Nenhum insumo configurado na Ficha Técnica deste procedimento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setIsCheckoutOpen(false)}>
                Cancelar
              </button>
              <button className={styles.primaryBtn} onClick={handleConfirmCheckout} style={{ background: 'hsl(var(--success))' }}>
                Confirmar Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
