import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ClinicFlow from './components/ClinicFlow';
import Appointments from './components/Appointments';
import ZaiONe from './components/ZaiONe';
import Patients from './components/Patients';
import Financial from './components/Financial';
import AdminSettings from './components/AdminSettings';
import InventoryCosts from './components/InventoryCosts';
import Papelaria from './components/Papelaria';
import ErrorBoundary from './components/ErrorBoundary';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { AuthScreen } from './components/AuthScreen';
import { supabase } from './lib/supabaseClient';
import { Stethoscope } from 'lucide-react';

interface Unit {
  id: string;
  name: string;
  address: string;
}

function AppContent() {
  const { user, activeTenant, loading, logout, isReadOnly, role, activeUnitId, selectUnit } = useTenant();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Unidade selecionada derivada diretamente do contexto global (evita loops de re-renderização)
  const selectedUnit = activeUnitId || (units.length > 0 ? units[0].id : '');

  const fetchUnits = async () => {
    if (!activeTenant) return;
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
      if (data && data.length > 0 && !activeUnitId) {
        selectUnit(data[0].id);
      }
    } catch (err) {
      console.error('Erro ao buscar unidades:', err);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      fetchUnits();
    }
  }, [activeTenant]);

  // Validar permissão da aba ativa ao mudar de role ou tab
  useEffect(() => {
    if (!role) return;
    const tabRoles: Record<string, string[]> = {
      dashboard: ['clinic_owner', 'admin', 'dentist', 'receptionist', 'finance', 'super_admin'],
      flow: ['clinic_owner', 'admin', 'dentist', 'receptionist'],
      appointments: ['clinic_owner', 'admin', 'dentist', 'receptionist'],
      'zai-chat': ['clinic_owner', 'admin', 'dentist', 'receptionist', 'finance'],
      patients: ['clinic_owner', 'admin', 'dentist', 'receptionist'],
      financial: ['clinic_owner', 'admin', 'finance'],
      'inventory-costs': ['clinic_owner', 'admin', 'finance'],
      papelaria: ['clinic_owner', 'admin', 'dentist'],
      admin: ['clinic_owner', 'admin', 'super_admin']
    };
    
    const allowedRoles = tabRoles[currentTab];
    if (allowedRoles && !allowedRoles.includes(role)) {
      setCurrentTab('dashboard');
    }
  }, [role, currentTab]);

  // Tela de Carregamento
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
        gap: '16px',
        fontFamily: "'Outfit', sans-serif"
      }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Stethoscope size={48} style={{ color: '#14b8a6', animation: 'pulse 1.5s infinite' }} />
          <div style={{
            position: 'absolute',
            width: '64px',
            height: '64px',
            border: '2px solid rgba(20, 184, 166, 0.2)',
            borderTopColor: '#14b8a6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 500 }}>Carregando dados do consultório...</span>
        
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } }
        `}</style>
      </div>
    );
  }

  // Se o usuário não estiver autenticado, exibe a tela de login/signup
  if (!user) {
    return <AuthScreen />;
  }

  // Se o usuário estiver autenticado mas não estiver associado a nenhum tenant
  if (!activeTenant) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
        padding: '32px',
        textAlign: 'center',
        fontFamily: "'Outfit', sans-serif"
      }}>
        <Stethoscope size={64} style={{ color: '#ef4444', marginBottom: '24px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Nenhum Consultório Encontrado</h2>
        <p style={{ color: '#94a3b8', maxWidth: '400px', lineHeight: '1.6', marginBottom: '24px' }}>
          Sua conta foi criada, mas não identificamos nenhuma associação a clínicas ativas. Se você acabou de criar sua conta, por favor confirme seu e-mail de cadastro.
        </p>
        <button
          onClick={logout}
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 24px',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard selectedUnit={selectedUnit} />;
      case 'flow':
        return <ClinicFlow />;
      case 'appointments':
        return <Appointments selectedUnit={selectedUnit} />;
      case 'zai-chat':
        return <ZaiONe />;
      case 'patients':
        return <Patients searchTerm={searchTerm} />;
      case 'financial':
        return <Financial selectedUnit={selectedUnit} />;
      case 'inventory-costs':
        return <InventoryCosts selectedUnit={selectedUnit} />;
      case 'papelaria':
        return <Papelaria selectedUnit={units.find(u => u.id === selectedUnit)} />;
      case 'admin':
        return <AdminSettings units={units} fetchUnits={fetchUnits} />;
      default:
        return <Dashboard selectedUnit={selectedUnit} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
      />

      <div 
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: isSidebarCollapsed ? '80px' : '260px',
          transition: 'var(--transition-smooth)'
        }}
      >
        <Navbar 
          isSidebarCollapsed={isSidebarCollapsed} 
          selectedUnit={selectedUnit} 
          setSelectedUnit={selectUnit} 
          units={units} 
          onSearch={setSearchTerm} 
        />

        {isReadOnly && (
          <div style={{
            position: 'fixed',
            top: '80px',
            left: isSidebarCollapsed ? '80px' : '260px',
            right: 0,
            background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
            color: 'white',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 40,
            transition: 'var(--transition-smooth)'
          }}>
            <span>Atenção: A assinatura da clínica {activeTenant.nome_clinica} está atrasada ou suspensa. O painel opera em modo Somente Leitura.</span>
          </div>
        )}

        <main 
          style={{ 
            marginTop: isReadOnly ? '124px' : '80px', 
            padding: '32px', 
            minHeight: 'calc(100vh - 80px)',
            transition: 'var(--transition-smooth)'
          }}
        >
          <div className="fade-in-up">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  );
}
