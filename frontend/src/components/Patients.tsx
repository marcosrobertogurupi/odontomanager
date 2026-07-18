import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Star,
  Phone,
  Mail,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './Patients.module.css';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  cpf: string;
  satisfaction_score: number;
}

interface PatientsProps {
  searchTerm: string;
}

export default function Patients({ searchTerm }: PatientsProps) {
  const { activeTenant } = useTenant();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editPatientId, setEditPatientId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formSatisfaction, setFormSatisfaction] = useState('10.0');

  const fetchPatients = async () => {
    if (!activeTenant) return;
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('name');

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPatients(data || []);
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      fetchPatients();
    }
  }, [searchTerm, activeTenant]);

  const handleOpenCreate = () => {
    setEditPatientId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormBirthDate('');
    setFormCpf('');
    setFormSatisfaction('10.0');
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (p: Patient) => {
    setEditPatientId(p.id);
    setFormName(p.name);
    setFormEmail(p.email || '');
    setFormPhone(p.phone || '');
    setFormBirthDate(p.birth_date || '');
    setFormCpf(p.cpf || '');
    setFormSatisfaction(p.satisfaction_score ? p.satisfaction_score.toString() : '10.0');
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;

    const payload: any = {
      name: formName,
      email: formEmail || null,
      phone: formPhone || null,
      birth_date: formBirthDate || null,
      cpf: formCpf || null,
      satisfaction_score: Number(formSatisfaction),
      tenant_id: activeTenant.id
    };

    try {
      if (editPatientId) {
        const { error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', editPatientId)
          .eq('tenant_id', activeTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('patients')
          .insert([payload]);
        if (error) throw error;
      }
      setIsDrawerOpen(false);
      fetchPatients();
    } catch (err: any) {
      console.error('Erro ao salvar paciente:', err);
      alert('Erro ao salvar paciente: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeTenant) return;
    if (!confirm('Deseja realmente excluir este paciente? Esta ação é irreversível.')) return;

    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id)
        .eq('tenant_id', activeTenant.id);
      if (error) throw error;
      fetchPatients();
    } catch (err: any) {
      console.error('Erro ao excluir paciente:', err);
      alert('Erro ao excluir paciente: ' + err.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div>
          <h1 className={styles.title}>Pacientes</h1>
          <p className={styles.subtitle}>Gerencie fichas cadastrais, contatos e histórico de satisfação.</p>
        </div>
        <button onClick={handleOpenCreate} className={styles.actionBtn}>
          <Plus size={16} />
          <span>Cadastrar Paciente</span>
        </button>
      </div>

      {/* Tabela de Pacientes */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Data Nasc.</th>
              <th>Satisfação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? (
              patients.map(p => (
                <tr key={p.id}>
                  <td className={styles.patientName}>{p.name}</td>
                  <td>{p.cpf || '-'}</td>
                  <td>{p.phone || '-'}</td>
                  <td>{p.email || '-'}</td>
                  <td>{p.birth_date ? new Date(p.birth_date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>
                    <span className={`${styles.satisfactionBadge} ${p.satisfaction_score >= 9.0 ? styles.highScore : styles.lowScore}`}>
                      <Star size={12} fill="currentColor" />
                      {p.satisfaction_score ? p.satisfaction_score.toFixed(1) : '10.0'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button onClick={() => handleOpenEdit(p)} className={styles.btnIcon} title="Editar paciente">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className={styles.btnIcon} style={{ color: 'hsl(var(--danger))' }} title="Excluir paciente">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                  Nenhum paciente cadastrado ou encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de Cadastro / Edição */}
      <div className={`${styles.overlay} ${isDrawerOpen ? styles.overlayActive : ''}`} onClick={() => setIsDrawerOpen(false)} />
      <div className={`${styles.drawer} ${isDrawerOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>{editPatientId ? 'Editar Cadastro' : 'Novo Paciente'}</h3>
          <button className={styles.closeBtn} onClick={() => setIsDrawerOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Nome Completo</label>
            <input 
              type="text" 
              className={styles.input} 
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Ana Souza"
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label>CPF</label>
            <input 
              type="text" 
              className={styles.input} 
              value={formCpf}
              onChange={(e) => setFormCpf(e.target.value)}
              placeholder="000.000.000-00" 
            />
          </div>

          <div className={styles.formGroup}>
            <label>Telefone</label>
            <input 
              type="text" 
              className={styles.input} 
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="(11) 99999-9999" 
            />
          </div>

          <div className={styles.formGroup}>
            <label>E-mail</label>
            <input 
              type="email" 
              className={styles.input} 
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="ana.souza@email.com" 
            />
          </div>

          <div className={styles.formGroup}>
            <label>Data de Nascimento</label>
            <input 
              type="date" 
              className={styles.input} 
              value={formBirthDate}
              onChange={(e) => setFormBirthDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Nota de Satisfação (0.0 a 10.0)</label>
            <input 
              type="number" 
              step="0.1" 
              min="0" 
              max="10"
              className={styles.input} 
              value={formSatisfaction}
              onChange={(e) => setFormSatisfaction(e.target.value)}
            />
          </div>

          <button type="submit" className={styles.actionBtn} style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            {editPatientId ? 'Salvar Alterações' : 'Concluir Cadastro'}
          </button>
        </form>
      </div>
    </div>
  );
}
