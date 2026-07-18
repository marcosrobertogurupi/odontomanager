export interface Unit {
  id: string;
  name: string;
  address: string;
}

export interface Profile {
  id: string;
  name: string;
  role: 'admin' | 'dentist' | 'receptionist';
  email: string;
  phone: string;
  unit_id: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  cpf: string;
  satisfaction_score: number;
}

export interface Procedure {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface Appointment {
  id: string;
  patient_id: string;
  professional_id: string;
  unit_id: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'canceled' | 'missed';
  room: string;
  notes?: string;
  procedure_id?: string | null;
  patient?: Patient;
  professional?: Profile;
}

export interface ClinicFlow {
  id: string;
  appointment_id: string;
  status: 'checked_in' | 'waiting' | 'in_consultation' | 'checked_out';
  checked_in_at: string;
  consultation_started_at?: string | null;
  consultation_ended_at?: string | null;
  appointment?: Appointment;
}

export interface Transaction {
  id: string;
  unit_id: string;
  patient_id?: string | null;
  appointment_id?: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  estoque_minimo: number;
  categoria: string;
  status: 'ativo' | 'inativo';
}

export interface EstoqueUnidade {
  insumo_id: string;
  unit_id: string;
  quantidade_atual: number;
  custo_medio: number;
}

export interface CompraEstoque {
  id: string;
  insumo_id: string;
  unit_id: string;
  fornecedor: string;
  quantidade: number;
  valor_total: number;
  valor_unitario: number;
  data_compra: string;
  nota_fiscal?: string;
}

export interface MovimentacaoEstoque {
  id: string;
  insumo_id: string;
  unit_id: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'estorno';
  quantidade: number;
  origem: 'compra' | 'procedimento' | 'perda' | 'ajuste_manual';
  data: string;
  usuario_id?: string | null;
}

export interface CustoFixo {
  id: string;
  nome: string;
  tipo: 'fixo_mensal' | 'variavel' | 'recorrente';
  valor: number;
  competencia: string; // MM/YYYY
  unidade_id: string;
}

export interface ProcedimentoInsumo {
  procedimento_id: string;
  insumo_id: string;
  quantidade_padrao: number;
  insumo?: Insumo;
}

export interface ConsumoAtendimento {
  id: string;
  appointment_id: string;
  procedimento_id: string;
  insumo_id: string;
  quantidade_usada: number;
  custo_unitario_no_momento: number;
  custo_total: number;
}

export const mockUnits: Unit[] = [
  { id: 'b1f7313d-7938-417e-85fc-fa9ded098671', name: 'OdontoManager - Matriz Centro', address: 'Av. Paulista, 1000 - São Paulo, SP' },
  { id: 'b1f7313d-7938-417e-85fc-fa9ded098672', name: 'OdontoManager - Filial Jardins', address: 'Rua Augusta, 2500 - São Paulo, SP' }
];

export const mockProfiles: Profile[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Dra. Beatriz Santos', role: 'dentist', email: 'beatriz@odontomanager.com', phone: '(11) 98765-4321', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Dr. Thiago Oliveira', role: 'dentist', email: 'thiago@odontomanager.com', phone: '(11) 97654-3210', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Mariana Costa (Recepção)', role: 'receptionist', email: 'mariana@odontomanager.com', phone: '(11) 96543-2109', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Carlos Ramos (Admin)', role: 'admin', email: 'carlos@odontomanager.com', phone: '(11) 95432-1098', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' }
];

export const mockProcedures: Procedure[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Limpeza Completa e Profilaxia', description: 'Remoção de tártaro, placa bacteriana e polimento coronário.', price: 180.00 },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Restauração de Resina Fotopolimerizável', description: 'Restauração estética de dente com cárie.', price: 250.00 },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'Tratamento de Canal (Endodontia)', description: 'Tratamento de canal em dente anterior ou posterior.', price: 850.00 },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Clareamento Dental Caseiro', description: 'Kit de moldeiras e gel clareador para uso em casa.', price: 600.00 },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'Implante Dentário', description: 'Instalação de pino de titânio (sem prótese).', price: 2200.00 }
];

export const mockPatients: Patient[] = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Ana Júlia de Souza', email: 'ana.souza@email.com', phone: '(11) 91234-5678', birth_date: '1995-04-12', cpf: '123.456.789-00', satisfaction_score: 9.8 },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Lucas Pereira Lima', email: 'lucas.lima@email.com', phone: '(11) 92345-6789', birth_date: '1988-11-23', cpf: '234.567.890-11', satisfaction_score: 10.0 },
  { id: 'c0000000-0000-0000-0000-000000000003', name: 'Clara Nunes Dias', email: 'clara.dias@email.com', phone: '(11) 93456-7890', birth_date: '2001-08-05', cpf: '345.678.901-22', satisfaction_score: 9.5 },
  { id: 'c0000000-0000-0000-0000-000000000004', name: 'Roberto Silveira Neto', email: 'roberto.neto@email.com', phone: '(11) 94567-8901', birth_date: '1974-02-28', cpf: '456.789.012-33', satisfaction_score: 8.9 },
  { id: 'c0000000-0000-0000-0000-000000000005', name: 'Juliana Rezende Mello', email: 'juliana.mello@email.com', phone: '(11) 95678-9012', birth_date: '1992-06-15', cpf: '567.890.123-44', satisfaction_score: 10.0 }
];

export const mockAppointments: Appointment[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    patient_id: 'c0000000-0000-0000-0000-000000000001',
    professional_id: '00000000-0000-0000-0000-000000000001',
    unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671',
    start_time: '2026-07-18T09:00:00-03:00',
    end_time: '2026-07-18T10:00:00-03:00',
    status: 'confirmed',
    room: 'Consultório A',
    notes: 'Revisão pós-canal',
    procedure_id: 'a0000000-0000-0000-0000-000000000003',
    patient: mockPatients[0],
    professional: mockProfiles[0]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    patient_id: 'c0000000-0000-0000-0000-000000000002',
    professional_id: '00000000-0000-0000-0000-000000000001',
    unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671',
    start_time: '2026-07-18T10:30:00-03:00',
    end_time: '2026-07-18T11:30:00-03:00',
    status: 'confirmed',
    room: 'Consultório A',
    notes: 'Limpeza semestral',
    procedure_id: 'a0000000-0000-0000-0000-000000000001',
    patient: mockPatients[1],
    professional: mockProfiles[0]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    patient_id: 'c0000000-0000-0000-0000-000000000003',
    professional_id: '00000000-0000-0000-0000-000000000002',
    unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671',
    start_time: '2026-07-18T11:00:00-03:00',
    end_time: '2026-07-18T12:00:00-03:00',
    status: 'scheduled',
    room: 'Consultório B',
    notes: 'Ajuste de aparelho',
    procedure_id: null,
    patient: mockPatients[2],
    professional: mockProfiles[1]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    patient_id: 'c0000000-0000-0000-0000-000000000004',
    professional_id: '00000000-0000-0000-0000-000000000002',
    unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671',
    start_time: '2026-07-18T14:00:00-03:00',
    end_time: '2026-07-18T15:00:00-03:00',
    status: 'confirmed',
    room: 'Consultório B',
    notes: 'Avaliação de implante',
    procedure_id: 'a0000000-0000-0000-0000-000000000005',
    patient: mockPatients[3],
    professional: mockProfiles[1]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    patient_id: 'c0000000-0000-0000-0000-000000000005',
    professional_id: '00000000-0000-0000-0000-000000000001',
    unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671',
    start_time: '2026-07-18T16:30:00-03:00',
    end_time: '2026-07-18T17:30:00-03:00',
    status: 'scheduled',
    room: 'Consultório A',
    notes: 'Clareamento moldagem',
    procedure_id: 'a0000000-0000-0000-0000-000000000004',
    patient: mockPatients[4],
    professional: mockProfiles[0]
  }
];

export const mockClinicFlow: ClinicFlow[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    appointment_id: 'd0000000-0000-0000-0000-000000000001',
    status: 'checked_out',
    checked_in_at: '2026-07-18T08:50:00-03:00',
    consultation_started_at: '2026-07-18T09:05:00-03:00',
    consultation_ended_at: '2026-07-18T09:55:00-03:00',
    appointment: mockAppointments[0]
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    appointment_id: 'd0000000-0000-0000-0000-000000000002',
    status: 'in_consultation',
    checked_in_at: '2026-07-18T10:15:00-03:00',
    consultation_started_at: '2026-07-18T10:35:00-03:00',
    consultation_ended_at: null,
    appointment: mockAppointments[1]
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    appointment_id: 'd0000000-0000-0000-0000-000000000003',
    status: 'waiting',
    checked_in_at: '2026-07-18T10:55:00-03:00',
    consultation_started_at: null,
    consultation_ended_at: null,
    appointment: mockAppointments[2]
  }
];

export const mockTransactions: Transaction[] = [
  { id: 'f0000000-0000-0000-0000-000000000001', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', patient_id: 'c0000000-0000-0000-0000-000000000001', appointment_id: 'd0000000-0000-0000-0000-000000000001', type: 'income', amount: 180.00, description: 'Pagamento Limpeza - Ana Júlia', date: '2026-07-18' },
  { id: 'f0000000-0000-0000-0000-000000000002', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', patient_id: null, appointment_id: null, type: 'expense', amount: 450.00, description: 'Compra de insumos descartáveis (Luvas/Máscaras)', date: '2026-07-18' },
  { id: 'f0000000-0000-0000-0000-000000000003', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', patient_id: 'c0000000-0000-0000-0000-000000000004', appointment_id: 'd0000000-0000-0000-0000-000000000004', type: 'income', amount: 2200.00, description: 'Entrada Implante - Roberto Neto', date: '2026-07-18' }
];

export const mockInsumos: Insumo[] = [
  { id: '10000000-0000-0000-0000-000000000001', nome: 'Luva de Procedimento Látex (Par)', unidade_medida: 'unidade', estoque_minimo: 100, categoria: 'Descartáveis', status: 'ativo' },
  { id: '10000000-0000-0000-0000-000000000002', nome: 'Máscara Descartável Tripla', unidade_medida: 'unidade', estoque_minimo: 50, categoria: 'Descartáveis', status: 'ativo' },
  { id: '10000000-0000-0000-0000-000000000003', nome: 'Anestésico Mepivacaína 2% (Tubete)', unidade_medida: 'unidade', estoque_minimo: 30, categoria: 'Anestésicos', status: 'ativo' },
  { id: '10000000-0000-0000-0000-000000000004', nome: 'Resina Composta A2 (Seringa)', unidade_medida: 'unidade', estoque_minimo: 5, categoria: 'Dentística', status: 'ativo' },
  { id: '10000000-0000-0000-0000-000000000005', nome: 'Agulha Gengival Descartável', unidade_medida: 'unidade', estoque_minimo: 40, categoria: 'Descartáveis', status: 'ativo' }
];

export const mockEstoqueUnidade: EstoqueUnidade[] = [
  // Matriz Centro
  { insumo_id: '10000000-0000-0000-0000-000000000001', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', quantidade_atual: 150, custo_medio: 1.20 },
  { insumo_id: '10000000-0000-0000-0000-000000000002', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', quantidade_atual: 80, custo_medio: 0.80 },
  { insumo_id: '10000000-0000-0000-0000-000000000003', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', quantidade_atual: 45, custo_medio: 3.50 },
  { insumo_id: '10000000-0000-0000-0000-000000000004', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', quantidade_atual: 8, custo_medio: 45.00 },
  { insumo_id: '10000000-0000-0000-0000-000000000005', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', quantidade_atual: 60, custo_medio: 0.50 },
  // Filial Jardins
  { insumo_id: '10000000-0000-0000-0000-000000000001', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098672', quantidade_atual: 120, custo_medio: 1.25 },
  { insumo_id: '10000000-0000-0000-0000-000000000002', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098672', quantidade_atual: 60, custo_medio: 0.85 }
];

export const mockComprasEstoque: CompraEstoque[] = [];
export const mockMovimentacoesEstoque: MovimentacaoEstoque[] = [
  { id: 'm1', insumo_id: '10000000-0000-0000-0000-000000000001', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', tipo: 'entrada', quantidade: 150, origem: 'ajuste_manual', data: '2026-07-18T08:00:00Z' },
  { id: 'm2', insumo_id: '10000000-0000-0000-0000-000000000002', unit_id: 'b1f7313d-7938-417e-85fc-fa9ded098671', tipo: 'entrada', quantidade: 80, origem: 'ajuste_manual', data: '2026-07-18T08:00:00Z' }
];

export const mockCustosFixos: CustoFixo[] = [
  { id: 'cf1', nome: 'Aluguel Comercial', tipo: 'fixo_mensal', valor: 3500.00, competencia: '07/2026', unidade_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' },
  { id: 'cf2', nome: 'Energia Elétrica', tipo: 'variavel', valor: 450.00, competencia: '07/2026', unidade_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' },
  { id: 'cf3', nome: 'Folha de Pagamento (Secretária/Faxina)', tipo: 'recorrente', valor: 2800.00, competencia: '07/2026', unidade_id: 'b1f7313d-7938-417e-85fc-fa9ded098671' }
];

export const mockProcedimentoInsumos: ProcedimentoInsumo[] = [
  // Profilaxia (Limpeza): 2 pares de luvas, 1 mascara, 1 anestesico (tubete), 1 agulha
  { procedimento_id: 'a0000000-0000-0000-0000-000000000001', insumo_id: '10000000-0000-0000-0000-000000000001', quantidade_padrao: 2 },
  { procedimento_id: 'a0000000-0000-0000-0000-000000000001', insumo_id: '10000000-0000-0000-0000-000000000002', quantidade_padrao: 1 },
  // Restauração: 2 pares de luvas, 1 mascara, 1 tubete anestesico, 1 agulha, 0.2 resina (20% de uma seringa)
  { procedimento_id: 'a0000000-0000-0000-0000-000000000002', insumo_id: '10000000-0000-0000-0000-000000000001', quantidade_padrao: 2 },
  { procedimento_id: 'a0000000-0000-0000-0000-000000000002', insumo_id: '10000000-0000-0000-0000-000000000002', quantidade_padrao: 1 },
  { procedimento_id: 'a0000000-0000-0000-0000-000000000002', insumo_id: '10000000-0000-0000-0000-000000000003', quantidade_padrao: 1 },
  { procedimento_id: 'a0000000-0000-0000-0000-000000000002', insumo_id: '10000000-0000-0000-0000-000000000004', quantidade_padrao: 0.2 },
  { procedimento_id: 'a0000000-0000-0000-0000-000000000002', insumo_id: '10000000-0000-0000-0000-000000000005', quantidade_padrao: 1 }
];

export const mockConsumoAtendimento: ConsumoAtendimento[] = [];
