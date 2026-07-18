import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface Tenant {
  id: string;
  nome_clinica: string;
  plano: 'Básico' | 'Pro' | 'Multi-unidade';
  status_assinatura: 'ativo' | 'inadimplente' | 'cancelado';
  limite_usuarios: number;
  limite_unidades: number;
}

export interface UserTenantAssociation {
  tenant_id: string;
  unit_id: string | null;
  role: 'super_admin' | 'clinic_owner' | 'dentist' | 'receptionist' | 'finance';
  tenants: Tenant;
}

export interface Profile {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
  unit_id: string | null;
}

interface TenantContextType {
  user: User | null;
  profile: Profile | null;
  userTenants: UserTenantAssociation[];
  activeTenant: Tenant | null;
  activeUnitId: string | null;
  role: string | null;
  isReadOnly: boolean;
  loading: boolean;
  selectTenant: (tenantId: string) => Promise<void>;
  selectUnit: (unitId: string) => void;
  logout: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userTenants, setUserTenants] = useState<UserTenantAssociation[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Carrega os dados relacionados ao usuário logado
  const loadUserData = async (currentUser: User) => {
    try {
      setLoading(true);

      // 1. Buscar perfil do profissional
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      } else {
        setProfile(profileData);
      }

      // 2. Buscar associações de tenant
      const { data: associations, error: assocError } = await supabase
        .from('users_tenants')
        .select('tenant_id, unit_id, role, tenants (*)')
        .eq('user_id', currentUser.id);

      if (assocError) {
        console.error('Erro ao buscar associações de clínicas:', assocError);
        setUserTenants([]);
        return;
      }

      const typedAssoc = (associations || []) as unknown as UserTenantAssociation[];
      setUserTenants(typedAssoc);

      if (typedAssoc.length > 0) {
        // Restaurar o tenant selecionado anteriormente ou escolher o primeiro
        const savedTenantId = localStorage.getItem('odontomanager_active_tenant_id');
        const defaultAssoc = typedAssoc.find(a => a.tenant_id === savedTenantId) || typedAssoc[0];

        setActiveTenant(defaultAssoc.tenants);
        setRole(defaultAssoc.role);
        setActiveUnitId(defaultAssoc.unit_id || localStorage.getItem('odontomanager_active_unit_id'));
        setIsReadOnly(defaultAssoc.tenants.status_assinatura !== 'ativo');
        
        localStorage.setItem('odontomanager_active_tenant_id', defaultAssoc.tenant_id);
        if (defaultAssoc.unit_id) {
          localStorage.setItem('odontomanager_active_unit_id', defaultAssoc.unit_id);
        }
      } else {
        setActiveTenant(null);
        setRole(null);
        setActiveUnitId(null);
        setIsReadOnly(false);
      }
    } catch (err) {
      console.error('Erro geral ao carregar dados do usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  // Alterna o tenant ativo
  const selectTenant = async (tenantId: string) => {
    const assoc = userTenants.find((t) => t.tenant_id === tenantId);
    if (assoc) {
      setActiveTenant(assoc.tenants);
      setRole(assoc.role);
      setActiveUnitId(assoc.unit_id);
      setIsReadOnly(assoc.tenants.status_assinatura !== 'ativo');
      localStorage.setItem('odontomanager_active_tenant_id', tenantId);
      if (assoc.unit_id) {
        localStorage.setItem('odontomanager_active_unit_id', assoc.unit_id);
      } else {
        localStorage.removeItem('odontomanager_active_unit_id');
      }
    }
  };

  // Alterna a unidade ativa
  const selectUnit = (unitId: string) => {
    setActiveUnitId(unitId);
    localStorage.setItem('odontomanager_active_unit_id', unitId);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setUserTenants([]);
    setActiveTenant(null);
    setActiveUnitId(null);
    setRole(null);
    setIsReadOnly(false);
    localStorage.removeItem('odontomanager_active_tenant_id');
    localStorage.removeItem('odontomanager_active_unit_id');
  };

  useEffect(() => {
    // 1. Obter sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser);
      } else {
        setLoading(false);
      }
    });

    // 2. Escutar mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          loadUserData(currentUser);
        } else {
          setProfile(null);
          setUserTenants([]);
          setActiveTenant(null);
          setRole(null);
          setActiveUnitId(null);
          setIsReadOnly(false);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <TenantContext.Provider
      value={{
        user,
        profile,
        userTenants,
        activeTenant,
        activeUnitId,
        role,
        isReadOnly,
        loading,
        selectTenant,
        selectUnit,
        logout,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider');
  }
  return context;
};
