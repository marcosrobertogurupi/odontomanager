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
import { API_URL } from './config';

interface Unit {
  id: string;
  name: string;
  address: string;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUnits = () => {
    fetch(`${API_URL}/api/units`)
      .then((res) => res.json())
      .then((data) => {
        setUnits(data);
        if (data.length > 0) {
          setSelectedUnit(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar unidades:', err);
        // Fallback local se a API demorar
        const mockUnitsList = [
          { id: 'b1f7313d-7938-417e-85fc-fa9ded098671', name: 'OdontoManager - Matriz Centro', address: 'Av. Paulista, 1000 - São Paulo, SP' },
          { id: 'b1f7313d-7938-417e-85fc-fa9ded098672', name: 'OdontoManager - Filial Jardins', address: 'Rua Augusta, 2500 - São Paulo, SP' }
        ];
        setUnits(mockUnitsList);
        setSelectedUnit(mockUnitsList[0].id);
      });
  };

  useEffect(() => {
    fetchUnits();
  }, []);

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
          setSelectedUnit={setSelectedUnit} 
          units={units} 
          onSearch={setSearchTerm} 
        />

        <main 
          style={{ 
            marginTop: '80px', 
            padding: '32px', 
            minHeight: 'calc(100vh - 80px)',
            transition: 'var(--transition-smooth)'
          }}
        >
          <div className="fade-in-up">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
