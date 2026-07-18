-- 1. INSERIR UNIDADES
INSERT INTO units (id, name, address) VALUES
('b1f7313d-7938-417e-85fc-fa9ded098671', 'OdontoManager - Matriz Centro', 'Av. Paulista, 1000 - São Paulo, SP'),
('b1f7313d-7938-417e-85fc-fa9ded098672', 'OdontoManager - Filial Jardins', 'Rua Augusta, 2500 - São Paulo, SP')
ON CONFLICT (id) DO NOTHING;

-- 2. INSERIR PERFIS DE TESTE (Usamos UUIDs estáticos para teste local e mock)
INSERT INTO profiles (id, name, role, email, phone, unit_id) VALUES
('00000000-0000-0000-0000-000000000001', 'Dra. Beatriz Santos', 'dentist', 'beatriz@odontomanager.com', '(11) 98765-4321', 'b1f7313d-7938-417e-85fc-fa9ded098671'),
('00000000-0000-0000-0000-000000000002', 'Dr. Thiago Oliveira', 'dentist', 'thiago@odontomanager.com', '(11) 97654-3210', 'b1f7313d-7938-417e-85fc-fa9ded098671'),
('00000000-0000-0000-0000-000000000003', 'Mariana Costa (Recepção)', 'receptionist', 'mariana@odontomanager.com', '(11) 96543-2109', 'b1f7313d-7938-417e-85fc-fa9ded098671'),
('00000000-0000-0000-0000-000000000004', 'Carlos Ramos (Admin)', 'admin', 'carlos@odontomanager.com', '(11) 95432-1098', 'b1f7313d-7938-417e-85fc-fa9ded098671')
ON CONFLICT (id) DO NOTHING;

-- 3. INSERIR PROCEDIMENTOS
INSERT INTO procedures (id, name, description, price) VALUES
('a0000000-0000-0000-0000-000000000001', 'Limpeza Completa e Profilaxia', 'Remoção de tártaro, placa bacteriana e polimento coronário.', 180.00),
('a0000000-0000-0000-0000-000000000002', 'Restauração de Resina Fotopolimerizável', 'Restauração estética de dente com cárie.', 250.00),
('a0000000-0000-0000-0000-000000000003', 'Tratamento de Canal (Endodontia)', 'Tratamento de canal em dente anterior ou posterior.', 850.00),
('a0000000-0000-0000-0000-000000000004', 'Clareamento Dental Caseiro', 'Kit de moldeiras e gel clareador para uso em casa.', 600.00),
('a0000000-0000-0000-0000-000000000005', 'Implante Dentário', 'Instalação de pino de titânio (sem prótese).', 2200.00)
ON CONFLICT (id) DO NOTHING;

-- 4. INSERIR PACIENTES
INSERT INTO patients (id, name, email, phone, birth_date, cpf, satisfaction_score) VALUES
('c0000000-0000-0000-0000-000000000001', 'Ana Júlia de Souza', 'ana.souza@email.com', '(11) 91234-5678', '1995-04-12', '123.456.789-00', 9.8),
('c0000000-0000-0000-0000-000000000002', 'Lucas Pereira Lima', 'lucas.lima@email.com', '(11) 92345-6789', '1988-11-23', '234.567.890-11', 10.0),
('c0000000-0000-0000-0000-000000000003', 'Clara Nunes Dias', 'clara.dias@email.com', '(11) 93456-7890', '2001-08-05', '345.678.901-22', 9.5),
('c0000000-0000-0000-0000-000000000004', 'Roberto Silveira Neto', 'roberto.neto@email.com', '(11) 94567-8901', '1974-02-28', '456.789.012-33', 8.9),
('c0000000-0000-0000-0000-000000000005', 'Juliana Rezende Mello', 'juliana.mello@email.com', '(11) 95678-9012', '1992-06-15', '567.890.123-44', 10.0)
ON CONFLICT (id) DO NOTHING;

-- 5. INSERIR AGENDAMENTOS (Calculando datas próximas a 2026-07-18)
INSERT INTO appointments (id, patient_id, professional_id, unit_id, start_time, end_time, status, room, notes) VALUES
-- Consultas de hoje (2026-07-18)
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T09:00:00-03:00', '2026-07-18T10:00:00-03:00', 'confirmed', 'Consultório A', 'Revisão pós-canal'),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T10:30:00-03:00', '2026-07-18T11:30:00-03:00', 'confirmed', 'Consultório A', 'Limpeza semestral'),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T11:00:00-03:00', '2026-07-18T12:00:00-03:00', 'scheduled', 'Consultório B', 'Ajuste de aparelho'),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T14:00:00-03:00', '2026-07-18T15:00:00-03:00', 'confirmed', 'Consultório B', 'Avaliação de implante'),
('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T16:30:00-03:00', '2026-07-18T17:30:00-03:00', 'scheduled', 'Consultório A', 'Clareamento moldagem')
ON CONFLICT (id) DO NOTHING;

-- 6. INSERIR FLUXO DA CLÍNICA (Status em tempo real de hoje)
INSERT INTO clinic_flow (id, appointment_id, status, checked_in_at, consultation_started_at, consultation_ended_at) VALUES
-- Paciente 1: Já terminou
('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'checked_out', '2026-07-18T08:50:00-03:00', '2026-07-18T09:05:00-03:00', '2026-07-18T09:55:00-03:00'),
-- Paciente 2: Está em atendimento
('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'in_consultation', '2026-07-18T10:15:00-03:00', '2026-07-18T10:35:00-03:00', NULL),
-- Paciente 3: Está na recepção esperando
('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'waiting', '2026-07-18T10:55:00-03:00', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. FINANCEIRO
INSERT INTO transactions (id, unit_id, patient_id, appointment_id, type, amount, description, date) VALUES
('f0000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'income', 180.00, 'Pagamento Limpeza - Ana Júlia', '2026-07-18'),
('f0000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', NULL, NULL, 'expense', 450.00, 'Compra de insumos descartáveis (Luvas/Máscaras)', '2026-07-18'),
('f0000000-0000-0000-0000-000000000003', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'income', 2200.00, 'Entrada Implante - Roberto Neto', '2026-07-18')
ON CONFLICT (id) DO NOTHING;
