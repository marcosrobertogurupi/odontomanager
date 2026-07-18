import React, { useState } from 'react';
import { 
  Search, 
  Mic, 
  Bell, 
  MessageSquare, 
  Sparkles,
  Building,
  ChevronDown,
  Star,
  LogOut
} from 'lucide-react';
import styles from './Navbar.module.css';
import { useTenant } from '../contexts/TenantContext';

interface NavbarProps {
  isSidebarCollapsed: boolean;
  selectedUnit: string;
  setSelectedUnit: (unit: string) => void;
  units: Array<{ id: string; name: string }>;
  onSearch: (term: string) => void;
}

export default function Navbar({ 
  isSidebarCollapsed, 
  selectedUnit, 
  setSelectedUnit, 
  units, 
  onSearch 
}: NavbarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { profile, role, logout } = useTenant();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onSearch(val);
  };

  const activeUnitName = units.find(u => u.id === selectedUnit)?.name || 'Matriz';

  const getUserInitials = () => {
    if (!profile?.name) return 'U';
    const parts = profile.name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return profile.name.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    if (role === 'clinic_owner') return 'Proprietário';
    if (role === 'admin') return 'Administrador';
    if (role === 'dentist') return 'Dentista';
    if (role === 'receptionist') return 'Recepção';
    if (role === 'finance') return 'Financeiro';
    if (role === 'super_admin') return 'Super Admin';
    return 'Profissional';
  };

  return (
    <header className={`${styles.navbar} ${isSidebarCollapsed ? styles.fullWidth : ''}`}>
      <div className={styles.searchContainer}>
        <Search size={18} className={styles.searchIcon} />
        <input 
          type="text" 
          placeholder="Pesquisar pacientes..." 
          className={styles.searchInput}
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      <div className={styles.rightSection}>
        {/* Nota de Satisfação dos Pacientes */}
        <div className={styles.satisfactionBadge}>
          <Star size={16} fill="currentColor" />
          <span>Pacientes: 9.8/10</span>
        </div>

        {/* Atalhos */}
        <div className={styles.shortcuts}>
          <button className={styles.shortcutBtn} title="Comando de voz Zai">
            <Mic size={18} />
          </button>
          <button className={styles.shortcutBtn} title="Mensagens de equipe">
            <MessageSquare size={18} />
            <span className={styles.notificationBadge} />
          </button>
          <button className={styles.shortcutBtn} title="Notificações e Alertas">
            <Bell size={18} />
          </button>
          <button className={styles.shortcutBtn} title="Gestão da Excelência (ZaiONe)">
            <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} />
          </button>
        </div>

        {/* Seletor de Unidade */}
        <div className={styles.unitSelector}>
          <Building size={16} />
          <span>{activeUnitName.replace('OdontoManager - ', '')}</span>
          <ChevronDown size={14} />
          <select 
            value={selectedUnit} 
            onChange={(e) => setSelectedUnit(e.target.value)}
            style={{
              position: 'absolute',
              opacity: 0,
              cursor: 'pointer',
              width: '100%',
              height: '100%'
            }}
          >
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Perfil */}
        <div className={styles.profileContainer}>
          <div className={styles.avatar}>{getUserInitials()}</div>
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>{profile ? profile.name : 'Carregando...'}</span>
            <span className={styles.profileRole}>{getRoleLabel()}</span>
          </div>
          <button 
            onClick={logout}
            className={styles.shortcutBtn} 
            title="Sair da Conta"
            style={{ marginLeft: '12px', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <LogOut size={18} style={{ color: 'hsl(var(--danger))' }} />
          </button>
        </div>
      </div>
    </header>
  );
}
