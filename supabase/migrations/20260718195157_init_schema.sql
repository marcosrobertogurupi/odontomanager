-- 1. TABELA DE UNIDADES (CLÍNICAS)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE PERFIS DE PROFISSIONAIS (vinculado ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- Será o id do auth.users correspondente
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'dentist', 'receptionist')),
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE PACIENTES
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    birth_date DATE,
    cpf TEXT UNIQUE,
    satisfaction_score NUMERIC(3,1) DEFAULT 10.0 CHECK (satisfaction_score >= 0 AND satisfaction_score <= 10.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA DE PROCEDIMENTOS
CREATE TABLE IF NOT EXISTS procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABELA DE AGENDAMENTOS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'confirmed', 'canceled', 'missed')),
    room TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABELA DE FLUXO DA CLÍNICA (Recepcionado -> Em Atendimento -> Finalizado)
CREATE TABLE IF NOT EXISTS clinic_flow (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('checked_in', 'waiting', 'in_consultation', 'checked_out')),
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    consultation_started_at TIMESTAMP WITH TIME ZONE,
    consultation_ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABELA DE MOVIMENTAÇÕES FINANCEIRAS
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR RLS (Row Level Security)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS simples
CREATE POLICY "Acesso total a usuários autenticados" ON units FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON procedures FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON clinic_flow FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total a usuários autenticados" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Criar trigger para criar perfil automaticamente na tabela 'profiles' quando um novo usuário se cadastrar no auth.users do Supabase
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, email, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Novo Profissional'),
    COALESCE(new.raw_user_meta_data->>'role', 'dentist'),
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- SEED DATA
-- =========================================================================

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

-- 5. INSERIR AGENDAMENTOS (datas fixas para o MVP)
INSERT INTO appointments (id, patient_id, professional_id, unit_id, start_time, end_time, status, room, notes) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T09:00:00-03:00', '2026-07-18T10:00:00-03:00', 'confirmed', 'Consultório A', 'Revisão pós-canal'),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T10:30:00-03:00', '2026-07-18T11:30:00-03:00', 'confirmed', 'Consultório A', 'Limpeza semestral'),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T11:00:00-03:00', '2026-07-18T12:00:00-03:00', 'scheduled', 'Consultório B', 'Ajuste de aparelho'),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T14:00:00-03:00', '2026-07-18T15:00:00-03:00', 'confirmed', 'Consultório B', 'Avaliação de implante'),
('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', '2026-07-18T16:30:00-03:00', '2026-07-18T17:30:00-03:00', 'scheduled', 'Consultório A', 'Clareamento moldagem')
ON CONFLICT (id) DO NOTHING;

-- 6. INSERIR FLUXO DA CLÍNICA
INSERT INTO clinic_flow (id, appointment_id, status, checked_in_at, consultation_started_at, consultation_ended_at) VALUES
('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'checked_out', '2026-07-18T08:50:00-03:00', '2026-07-18T09:05:00-03:00', '2026-07-18T09:55:00-03:00'),
('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'in_consultation', '2026-07-18T10:15:00-03:00', '2026-07-18T10:35:00-03:00', NULL),
('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'waiting', '2026-07-18T10:55:00-03:00', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. FINANCEIRO
INSERT INTO transactions (id, unit_id, patient_id, appointment_id, type, amount, description, date) VALUES
('f0000000-0000-0000-0000-000000000001', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'income', 180.00, 'Pagamento Limpeza - Ana Júlia', '2026-07-18'),
('f0000000-0000-0000-0000-000000000002', 'b1f7313d-7938-417e-85fc-fa9ded098671', NULL, NULL, 'expense', 450.00, 'Compra de insumos descartáveis (Luvas/Máscaras)', '2026-07-18'),
('f0000000-0000-0000-0000-000000000003', 'b1f7313d-7938-417e-85fc-fa9ded098671', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'income', 2200.00, 'Entrada Implante - Roberto Neto', '2026-07-18')
ON CONFLICT (id) DO NOTHING;
