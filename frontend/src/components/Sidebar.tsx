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
  ChevronRight
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ currentTab, setCurrentTab, isCollapsed, setIsCollapsed }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'flow', label: 'Fluxo na Clínica', icon: Activity },
    { id: 'appointments', label: 'Agendamentos', icon: CalendarDays },
    { id: 'zai-chat', label: 'Conversas ZaiONe', icon: MessageSquare },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'financial', label: 'Movimentações', icon: CircleDollarSign },
    { id: 'admin', label: 'Administração', icon: Settings },
  ];

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.logoIcon}>OM</div>
        {!isCollapsed && <span className={styles.logoText}>OdontoManager</span>}
      </div>

      <nav className={styles.navSection}>
        {menuItems.map((item) => {
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
