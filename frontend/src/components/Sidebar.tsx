import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  CalendarDays, 
  MessageSquare, 
  Users, 
  CircleDollarSign, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Boxes
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { useTenant } from '../contexts/TenantContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ currentTab, setCurrentTab, isCollapsed, setIsCollapsed }: SidebarProps) {
  const { activeTenant, role } = useTenant();
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['clinic_owner', 'admin', 'dentist', 'receptionist', 'finance', 'super_admin'] },
    { id: 'flow', label: 'Fluxo na Clínica', icon: Activity, roles: ['clinic_owner', 'admin', 'dentist', 'receptionist'] },
    { id: 'appointments', label: 'Agendamentos', icon: CalendarDays, roles: ['clinic_owner', 'admin', 'dentist', 'receptionist'] },
    { id: 'zai-chat', label: 'Conversas ZaiONe', icon: MessageSquare, roles: ['clinic_owner', 'admin', 'dentist', 'receptionist', 'finance'] },
    { id: 'patients', label: 'Pacientes', icon: Users, roles: ['clinic_owner', 'admin', 'dentist', 'receptionist'] },
    { id: 'financial', label: 'Movimentações', icon: CircleDollarSign, roles: ['clinic_owner', 'admin', 'finance'] },
    { id: 'inventory-costs', label: 'Custos & Estoque', icon: Boxes, roles: ['clinic_owner', 'admin', 'finance'] },
    { id: 'admin', label: 'Administração', icon: Settings, roles: ['clinic_owner', 'admin', 'super_admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!role) return false;
    return item.roles.includes(role);
  });

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.logoIcon}>
          {activeTenant ? activeTenant.nome_clinica.substring(0, 2).toUpperCase() : 'OM'}
        </div>
        {!isCollapsed && (
          <span className={styles.logoText}>
            {activeTenant ? activeTenant.nome_clinica : 'OdontoManager'}
          </span>
        )}
      </div>

      <nav className={styles.navSection}>
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={20} />
              {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className={styles.toggleButton}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!isCollapsed && <span>Recolher Menu</span>}
        </button>
      </div>
    </aside>
  );
}
