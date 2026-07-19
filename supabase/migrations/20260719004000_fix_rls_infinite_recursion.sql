-- Fix infinite recursion in RLS policies for users_tenants table

-- 1. Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Clinic owners can manage members of their tenant" ON public.users_tenants;
DROP POLICY IF EXISTS "Super admins can view all memberships" ON public.users_tenants;
DROP POLICY IF EXISTS "Super admins can manage all memberships" ON public.users_tenants;

-- 2. Create Security Definer helper functions to bypass RLS checks internally
CREATE OR REPLACE FUNCTION public.is_clinic_owner(user_uuid uuid, tenant_uuid uuid)
RETURNS boolean
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_tenants
    WHERE user_id = user_uuid AND tenant_id = tenant_uuid AND role = 'clinic_owner'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_tenants
    WHERE user_id = user_uuid AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Re-create policies using the security definer functions to prevent recursive checks
CREATE POLICY "Clinic owners can manage members of their tenant" ON public.users_tenants 
    FOR ALL TO authenticated 
    USING (public.is_clinic_owner(auth.uid(), tenant_id))
    WITH CHECK (public.is_clinic_owner(auth.uid(), tenant_id));

CREATE POLICY "Super admins can view all memberships" ON public.users_tenants 
    FOR SELECT TO authenticated 
    USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all memberships" ON public.users_tenants 
    FOR ALL TO authenticated 
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
