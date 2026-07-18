import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/transactions - Listar
router.get('/', async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Transactions Route] Utilizando fallback de mock:', (err as Error).message);
    res.json(mockStore.getTransactions());
  }
});

// GET /api/transactions/summary - Resumo Financeiro
router.get('/summary', async (req, res, next) => {
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase.from('transactions').select('type, amount');
    if (error) throw error;

    let income = 0;
    let expense = 0;
    
    data.forEach((tx: any) => {
      if (tx.type === 'income') income += Number(tx.amount);
      else if (tx.type === 'expense') expense += Number(tx.amount);
    });

    res.json({ income, expense, net: income - expense });
  } catch (err) {
    console.warn('[Transactions Route Summary] Utilizando fallback de mock:', (err as Error).message);
    const txs = mockStore.getTransactions();
    let income = 0;
    let expense = 0;
    
    txs.forEach(tx => {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
    });

    res.json({ income, expense, net: income - expense });
  }
});

// POST /api/transactions - Criar
router.post('/', async (req, res, next) => {
  const { unit_id, patient_id, appointment_id, type, amount, description, date } = req.body;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('transactions')
      .insert([{ unit_id, patient_id, appointment_id, type, amount, description, date }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Transactions Route] Criando em mock:', (err as Error).message);
    const newTx = {
      id: Math.random().toString(36).substring(2),
      unit_id: unit_id || 'b1f7313d-7938-417e-85fc-fa9ded098671',
      patient_id,
      appointment_id,
      type,
      amount: Number(amount),
      description,
      date: date || new Date().toISOString().split('T')[0]
    };
    mockStore.addTransaction(newTx);
    res.status(201).json(newTx);
  }
});

export default router;
