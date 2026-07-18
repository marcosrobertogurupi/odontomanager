-- Habilitar a extensão uuid-ossp se necessário (já vem habilitada no Supabase por padrão)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- HABILITAR RLS (Row Level Security) - Para simplificar neste MVP, criaremos políticas de acesso irrestrito para perfis autenticados, mas estruturados de forma segura.
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS simples: Usuários autenticados podem ler/gravar.
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
