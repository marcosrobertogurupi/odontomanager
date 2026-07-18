-- Alterar a constraint de role na tabela profiles para aceitar todos os papéis do SaaS
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'dentist', 'receptionist', 'finance', 'super_admin'));
