import { 
  mockPatients, 
  mockAppointments, 
  mockClinicFlow, 
  mockTransactions, 
  mockProcedures, 
  mockProfiles, 
  mockUnits,
  Patient,
  Appointment,
  ClinicFlow,
  Transaction,
  Procedure,
  Profile,
  Unit
} from './mockData.js';

class MockStore {
  patients: Patient[] = [...mockPatients];
  appointments: Appointment[] = [...mockAppointments];
  clinicFlow: ClinicFlow[] = [...mockClinicFlow];
  transactions: Transaction[] = [...mockTransactions];
  procedures: Procedure[] = [...mockProcedures];
  profiles: Profile[] = [...mockProfiles];
  units: Unit[] = [...mockUnits];

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
}

export const mockStore = new MockStore();
