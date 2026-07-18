-- Adicionar políticas para super_admin gerenciar a plataforma globalmente

-- tenants
CREATE POLICY "Super admins can view all tenants" ON tenants 
    FOR SELECT TO authenticated 
    USING (EXISTS (SELECT 1 FROM users_tenants WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can manage all tenants" ON tenants 
    FOR UPDATE TO authenticated 
    USING (EXISTS (SELECT 1 FROM users_tenants WHERE user_id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM users_tenants WHERE user_id = auth.uid() AND role = 'super_admin'));

-- users_tenants
CREATE POLICY "Super admins can view all memberships" ON users_tenants 
    FOR SELECT TO authenticated 
    USING (EXISTS (SELECT 1 FROM users_tenants WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can manage all memberships" ON users_tenants 
    FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM users_tenants WHERE user_id = auth.uid() AND role = 'super_admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM users_tenants WHERE user_id = auth.uid() AND role = 'super_admin'));
