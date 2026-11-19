import React, { useEffect, useState, useMemo } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  X,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import styles from './Financial.module.css';
import { formatDate } from '../lib/formatters';

interface Transaction {
  id: string;
  unit_id: string;
  patient_id?: string | null;
  appointment_id?: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'paid';
  paid_at?: string | null;
  patient_name?: string | null;
}

interface FinancialProps {
  selectedUnit: string;
}

export default function Financial({ selectedUnit }: FinancialProps) {
  const { activeTenant } = useTenant();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Form Fields
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Calcula o resumo sempre que transactions mudar — sem estado separado.
  // Receita e despesa contam só o que foi efetivamente pago; o que está pendente vai em "A Receber".
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pending = 0;
    transactions.forEach((tx) => {
      const amt = Number(tx.amount);
      if (tx.status === 'pending') {
        if (tx.type === 'income') pending += amt;
        return;
      }
      if (tx.type === 'income') income += amt;
      else if (tx.type === 'expense') expense += amt;
    });
    return { income, expense, pending, net: income - expense };
  }, [transactions]);

  const handleMarkAsPaid = async (tx: Transaction) => {
    if (!activeTenant) return;
    if (!confirm(`Confirmar o recebimento de R$ ${Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`)) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'paid', paid_at: new Date().toISOString().split('T')[0] })
        .eq('id', tx.id)
        .eq('tenant_id', activeTenant.id);
      if (error) throw error;
      fetchFinancialData();
    } catch (err: any) {
      console.error('Erro ao marcar lançamento como pago:', err);
      alert('Erro ao marcar como pago: ' + err.message);
    }
  };

  const fetchFinancialData = async () => {
    if (!activeTenant || !selectedUnit) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .eq('unit_id', selectedUnit)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Erro ao buscar dados financeiros:', err);
    }
  };

  useEffect(() => {
    if (activeTenant && selectedUnit) {
      fetchFinancialData();
    }
  }, [selectedUnit, activeTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedUnit) return;
    if (!formDescription || !formAmount) return alert('Preencha os campos obrigatórios.');

    const payload = {
      unit_id: selectedUnit,
      type: formType,
      amount: Number(formAmount),
      description: formDescription,
      date: formDate,
      status: 'paid' as const,
      paid_at: formDate,
      tenant_id: activeTenant.id
    };

    try {
      const { error } = await supabase
        .from('transactions')
        .insert([payload]);

      if (error) throw error;

      setIsDrawerOpen(false);
      fetchFinancialData();
      // Reset
      setFormDescription('');
      setFormAmount('');
    } catch (err: any) {
      console.error('Erro ao salvar transação:', err);
      alert('Erro ao salvar transação: ' + err.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div>
          <h1 className={styles.title}>Fluxo de Caixa</h1>
          <p className={styles.subtitle}>Gerencie receitas, despesas operacionais e lucros líquidos.</p>
        </div>
        <button onClick={() => setIsDrawerOpen(true)} className={styles.actionBtn}>
          <Plus size={16} />
          <span>Registrar Movimentação</span>
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className={styles.summaryCards}>
        <div className={styles.cardSummary}>
          <div className={styles.cardSummaryTitle} style={{ color: 'hsl(var(--success))' }}>
            <ArrowUpRight size={18} />
            <span>Entradas / Receitas</span>
          </div>
          <div className={styles.cardSummaryValue}>
            R$ {summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className={styles.cardSummary}>
          <div className={styles.cardSummaryTitle} style={{ color: 'hsl(var(--warning))' }}>
            <Calendar size={18} />
            <span>A Receber (pendente)</span>
          </div>
          <div className={styles.cardSummaryValue}>
            R$ {summary.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className={styles.cardSummary}>
          <div className={styles.cardSummaryTitle} style={{ color: 'hsl(var(--danger))' }}>
            <ArrowDownRight size={18} />
            <span>Saídas / Despesas</span>
          </div>
          <div className={styles.cardSummaryValue}>
            R$ {summary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className={styles.cardSummary}>
          <div className={styles.cardSummaryTitle} style={{ color: summary.net >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--danger))' }}>
            <DollarSign size={18} />
            <span>Saldo Líquido</span>
          </div>
          <div className={styles.cardSummaryValue}>
            R$ {summary.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>Histórico de Transações</h2>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Situação</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length > 0 ? (
              transactions.map(tx => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.date)}</td>
                  <td style={{ fontWeight: '500' }}>
                    {tx.description}
                    {!tx.patient_id && tx.patient_name && (
                      <div style={{ fontSize: '12px', fontWeight: 400, color: 'hsl(var(--text-muted))' }}>
                        Paciente excluído: {tx.patient_name}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.typeBadge} ${styles[tx.type]}`}>
                      {tx.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td>
                    {tx.status === 'pending' ? (
                      <button
                        type="button"
                        className={styles.typeBadge}
                        style={{
                          background: 'hsl(var(--warning-light, var(--bg-card)))',
                          color: 'hsl(var(--warning))',
                          border: '1px solid hsl(var(--warning))',
                          cursor: 'pointer',
                        }}
                        title="Clique para marcar como pago"
                        onClick={() => handleMarkAsPaid(tx)}
                      >
                        Pendente · marcar pago
                      </button>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'hsl(var(--text-muted))' }}>
                        Pago{tx.paid_at ? ` em ${formatDate(tx.paid_at)}` : ''}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: '600', color: tx.type === 'income' ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                    {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                  Nenhuma transação financeira registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de Registro de Transação */}
      <div className={`${styles.overlay} ${isDrawerOpen ? styles.overlayActive : ''}`} onClick={() => setIsDrawerOpen(false)} />
      <div className={`${styles.drawer} ${isDrawerOpen ? styles.drawerActive : ''}`}>
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>Registrar Movimentação</h3>
          <button className={styles.closeBtn} onClick={() => setIsDrawerOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input 
              type="text" 
              className={styles.input} 
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Ex: Compra de luvas descartáveis"
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label>Tipo de Lançamento</label>
            <select 
              className={styles.select}
              value={formType}
              onChange={(e) => setFormType(e.target.value as 'income' | 'expense')}
            >
              <option value="income">Receita (Entrada)</option>
              <option value="expense">Despesa (Saída)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Valor (R$)</label>
            <input 
              type="number" 
              className={styles.input} 
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label>Data</label>
            <input 
              type="date" 
              className={styles.input} 
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.actionBtn} style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            Confirmar Lançamento
          </button>
        </form>
      </div>
    </div>
  );
}
