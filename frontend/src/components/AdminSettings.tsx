import React, { useEffect, useState } from 'react';
import { 
  Building, 
  Settings, 
  ShieldCheck, 
  Activity, 
  Plus, 
  CheckCircle,
  FileText
} from 'lucide-react';
import { API_URL } from '../config';
import styles from './AdminSettings.module.css';

interface Unit {
  id: string;
  name: string;
  address: string;
}

interface Procedure {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface AdminSettingsProps {
  units: Unit[];
  fetchUnits: () => void;
}

export default function AdminSettings({ units, fetchUnits }: AdminSettingsProps) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  
  // Novo Procedimento
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');

  const fetchProcedures = () => {
    fetch(`${API_URL}/api/procedures`)
      .then(res => res.json())
      .then(data => setProcedures(data))
      .catch(err => console.error('Erro ao buscar procedimentos:', err));
  };

  useEffect(() => {
    fetchProcedures();
  }, []);

  const handleAddProcedure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) return alert('Por favor, preencha os campos obrigatórios.');

    const payload = {
      name: formName,
      description: formDesc,
      price: Number(formPrice)
    };

    fetch(`${API_URL}/api/procedures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {
        fetchProcedures();
        setFormName('');
        setFormDesc('');
        setFormPrice('');
        alert('Procedimento cadastrado com sucesso!');
      })
      .catch(err => console.error('Erro ao cadastrar procedimento:', err));
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div>
          <h1 className={styles.title}>Administração do Sistema</h1>
          <p className={styles.subtitle}>Gerencie unidades da clínica, procedimentos odontológicos e configurações gerais.</p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Unidades da Clínica */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Building size={20} style={{ color: 'hsl(var(--primary))' }} />
            Unidades de Atendimento
          </h2>
          <div className={styles.list}>
            {units.map(unit => (
              <div key={unit.id} className={styles.listItem}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{unit.name}</span>
                  <span className={styles.itemDesc}>{unit.address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Procedimentos Cadastrados & Novo Procedimento */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <ShieldCheck size={20} style={{ color: 'hsl(var(--success))' }} />
            Procedimentos e Tabela de Preços
          </h2>
          
          <div className={styles.list} style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {procedures.length > 0 ? (
              procedures.map(proc => (
                <div key={proc.id} className={styles.listItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{proc.name}</span>
                    <span className={styles.itemDesc}>{proc.description || 'Sem descrição'}</span>
                  </div>
                  <span className={styles.itemValue}>R$ {proc.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '13px' }}>Carregando tabela...</p>
            )}
          </div>

          <form className={styles.form} onSubmit={handleAddProcedure}>
            <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Cadastrar Novo Procedimento</h3>
            
            <div className={styles.formGroup}>
              <label>Nome do Procedimento</label>
              <input 
                type="text" 
                className={styles.input} 
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Ortodontia Manutenção"
                required 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Descrição</label>
              <input 
                type="text" 
                className={styles.input} 
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: Manutenção mensal do aparelho metálico"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Preço Base (R$)</label>
              <input 
                type="number" 
                className={styles.input} 
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                required 
              />
            </div>

            <button type="submit" className={styles.actionBtn}>
              <Plus size={16} />
              <span>Adicionar Procedimento</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
