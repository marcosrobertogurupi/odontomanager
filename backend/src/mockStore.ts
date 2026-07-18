import { 
  mockPatients, 
  mockAppointments, 
  mockClinicFlow, 
  mockTransactions, 
  mockProcedures, 
  mockProfiles, 
  mockUnits,
  mockInsumos,
  mockEstoqueUnidade,
  mockComprasEstoque,
  mockMovimentacoesEstoque,
  mockCustosFixos,
  mockProcedimentoInsumos,
  mockConsumoAtendimento,
  Patient,
  Appointment,
  ClinicFlow,
  Transaction,
  Procedure,
  Profile,
  Unit,
  Insumo,
  EstoqueUnidade,
  CompraEstoque,
  MovimentacaoEstoque,
  CustoFixo,
  ProcedimentoInsumo,
  ConsumoAtendimento
} from './mockData.js';

class MockStore {
  patients: Patient[] = [...mockPatients];
  appointments: Appointment[] = [...mockAppointments];
  clinicFlow: ClinicFlow[] = [...mockClinicFlow];
  transactions: Transaction[] = [...mockTransactions];
  procedures: Procedure[] = [...mockProcedures];
  profiles: Profile[] = [...mockProfiles];
  units: Unit[] = [...mockUnits];

  // Estoque e Custos
  insumos: Insumo[] = [...mockInsumos];
  estoqueUnidade: EstoqueUnidade[] = [...mockEstoqueUnidade];
  comprasEstoque: CompraEstoque[] = [...mockComprasEstoque];
  movimentacoesEstoque: MovimentacaoEstoque[] = [...mockMovimentacoesEstoque];
  custosFixos: CustoFixo[] = [...mockCustosFixos];
  procedimentoInsumos: ProcedimentoInsumo[] = [...mockProcedimentoInsumos];
  consumoAtendimento: ConsumoAtendimento[] = [...mockConsumoAtendimento];

  // Métodos auxiliares
  getPatients() { return this.patients; }
  addPatient(patient: Patient) { this.patients.push(patient); return patient; }
  updatePatient(id: string, data: Partial<Patient>) {
    const idx = this.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.patients[idx] = { ...this.patients[idx], ...data };
      return this.patients[idx];
    }
    return null;
  }
  deletePatient(id: string) {
    const idx = this.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      const removed = this.patients[idx];
      this.patients.splice(idx, 1);
      return removed;
    }
    return null;
  }

  getAppointments() {
    return this.appointments.map(app => ({
      ...app,
      patient: this.patients.find(p => p.id === app.patient_id),
      professional: this.profiles.find(prof => prof.id === app.professional_id)
    }));
  }
  addAppointment(app: Appointment) {
    this.appointments.push(app);
    return app;
  }
  updateAppointment(id: string, data: Partial<Appointment>) {
    const idx = this.appointments.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.appointments[idx] = { ...this.appointments[idx], ...data };
      return this.appointments[idx];
    }
    return null;
  }

  getClinicFlow() {
    return this.clinicFlow.map(flow => {
      const app = this.appointments.find(a => a.id === flow.appointment_id);
      return {
        ...flow,
        appointment: app ? {
          ...app,
          patient: this.patients.find(p => p.id === app.patient_id),
          professional: this.profiles.find(prof => prof.id === app.professional_id)
        } : undefined
      };
    });
  }
  updateClinicFlow(appointmentId: string, status: ClinicFlow['status']) {
    let flow = this.clinicFlow.find(f => f.appointment_id === appointmentId);
    const nowStr = new Date().toISOString();
    if (!flow) {
      flow = {
        id: Math.random().toString(36).substring(2),
        appointment_id: appointmentId,
        status,
        checked_in_at: nowStr,
        consultation_started_at: status === 'in_consultation' ? nowStr : null,
        consultation_ended_at: status === 'checked_out' ? nowStr : null
      };
      this.clinicFlow.push(flow);
    } else {
      flow.status = status;
      if (status === 'in_consultation') {
        flow.consultation_started_at = nowStr;
      } else if (status === 'checked_out') {
        flow.consultation_ended_at = nowStr;
      }
    }
    return flow;
  }

  getTransactions() { return this.transactions; }
  addTransaction(tx: Transaction) { this.transactions.push(tx); return tx; }

  getProcedures() { return this.procedures; }
  addProcedure(proc: Procedure) { this.procedures.push(proc); return proc; }

  getProfiles() { return this.profiles; }

  // Métodos do módulo de Estoque & Custos
  getInsumos(unitId: string) {
    return this.insumos.map(insumo => {
      const est = this.estoqueUnidade.find(e => e.insumo_id === insumo.id && e.unit_id === unitId);
      return {
        ...insumo,
        quantidade_atual: est ? est.quantidade_atual : 0,
        custo_medio: est ? est.custo_medio : 0
      };
    });
  }

  addInsumo(insumo: Insumo) {
    this.insumos.push(insumo);
    return insumo;
  }

  getMovimentacoes(unitId: string) {
    return this.movimentacoesEstoque
      .filter(m => m.unit_id === unitId)
      .map(m => ({
        ...m,
        insumo: this.insumos.find(i => i.id === m.insumo_id)
      }))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  addCompraEstoque(compra: CompraEstoque) {
    const id = Math.random().toString(36).substring(2);
    const newCompra = { ...compra, id };
    this.comprasEstoque.push(newCompra);

    // Atualizar estoque e custo médio ponderado
    let est = this.estoqueUnidade.find(e => e.insumo_id === compra.insumo_id && e.unit_id === compra.unit_id);
    if (!est) {
      est = {
        insumo_id: compra.insumo_id,
        unit_id: compra.unit_id,
        quantidade_atual: 0,
        custo_medio: 0
      };
      this.estoqueUnidade.push(est);
    }

    const prevQty = est.quantidade_atual;
    const prevCost = est.custo_medio;
    const newQty = compra.quantidade;
    const newCost = compra.valor_unitario;

    if (prevQty <= 0) {
      est.custo_medio = newCost;
    } else {
      est.custo_medio = ((prevQty * prevCost) + (newQty * newCost)) / (prevQty + newQty);
    }
    est.quantidade_atual += newQty;

    // Registrar movimentação
    this.movimentacoesEstoque.push({
      id: Math.random().toString(36).substring(2),
      insumo_id: compra.insumo_id,
      unit_id: compra.unit_id,
      tipo: 'entrada',
      quantidade: newQty,
      origem: 'compra',
      data: new Date().toISOString()
    });

    return newCompra;
  }

  getCustosFixos(unitId: string, competencia: string) {
    return this.custosFixos.filter(c => c.unidade_id === unitId && c.competencia === competencia);
  }

  addCustoFixo(custo: CustoFixo) {
    const id = Math.random().toString(36).substring(2);
    const newCusto = { ...custo, id };
    this.custosFixos.push(newCusto);
    return newCusto;
  }

  getProcedimentoInsumos(procedimentoId: string) {
    return this.procedimentoInsumos
      .filter(pi => pi.procedimento_id === procedimentoId)
      .map(pi => ({
        ...pi,
        insumo: this.insumos.find(i => i.id === pi.insumo_id)
      }));
  }

  updateProcedimentoInsumos(procedimentoId: string, list: { insumo_id: string; quantidade_padrao: number }[]) {
    // Remover antigos
    this.procedimentoInsumos = this.procedimentoInsumos.filter(pi => pi.procedimento_id !== procedimentoId);
    
    // Inserir novos
    const added = list.map(item => {
      const pi: ProcedimentoInsumo = {
        procedimento_id: procedimentoId,
        insumo_id: item.insumo_id,
        quantidade_padrao: item.quantidade_padrao
      };
      this.procedimentoInsumos.push(pi);
      return pi;
    });

    return added;
  }

  addConsumosAtendimento(appointmentId: string, unitId: string, procedimentoId: string, consumos: { insumo_id: string; quantidade_usada: number }[]) {
    const now = new Date().toISOString();
    const result = consumos.map(c => {
      // Obter custo médio do momento
      const est = this.estoqueUnidade.find(e => e.insumo_id === c.insumo_id && e.unit_id === unitId);
      const custo_unitario = est ? est.custo_medio : 0;
      
      const newConsumo: ConsumoAtendimento = {
        id: Math.random().toString(36).substring(2),
        appointment_id: appointmentId,
        procedimento_id: procedimentoId,
        insumo_id: c.insumo_id,
        quantidade_usada: c.quantidade_usada,
        custo_unitario_no_momento: custo_unitario,
        custo_total: c.quantidade_usada * custo_unitario
      };

      this.consumoAtendimento.push(newConsumo);

      // Debitar do estoque
      if (est) {
        est.quantidade_atual -= c.quantidade_usada;
      } else {
        this.estoqueUnidade.push({
          insumo_id: c.insumo_id,
          unit_id: unitId,
          quantidade_atual: -c.quantidade_usada,
          custo_medio: 0
        });
      }

      // Criar movimentação de saída
      this.movimentacoesEstoque.push({
        id: Math.random().toString(36).substring(2),
        insumo_id: c.insumo_id,
        unit_id: unitId,
        tipo: 'saida',
        quantidade: c.quantidade_usada,
        origem: 'procedimento',
        data: now
      });

      return newConsumo;
    });

    return result;
  }

  revertConsumosAtendimento(appointmentId: string, unitId: string) {
    const consumos = this.consumoAtendimento.filter(c => c.appointment_id === appointmentId);
    if (consumos.length === 0) return;

    const now = new Date().toISOString();
    consumos.forEach(c => {
      // Devolver ao estoque
      const est = this.estoqueUnidade.find(e => e.insumo_id === c.insumo_id && e.unit_id === unitId);
      if (est) {
        est.quantidade_atual += c.quantidade_usada;
      }

      // Criar movimentação de estorno
      this.movimentacoesEstoque.push({
        id: Math.random().toString(36).substring(2),
        insumo_id: c.insumo_id,
        unit_id: unitId,
        tipo: 'estorno',
        quantidade: c.quantidade_usada,
        origem: 'procedimento',
        data: now
      });
    });

    // Remover consumos
    this.consumoAtendimento = this.consumoAtendimento.filter(c => c.appointment_id !== appointmentId);
  }
}

export const mockStore = new MockStore();

