import { Router } from 'express';
import { supabase } from '../supabase.js';
import { mockStore } from '../mockStore.js';

const router = Router();

// GET /api/patients - Listar ou buscar
router.get('/', async (req, res, next) => {
  const { search } = req.query;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    let query = supabase.from('patients').select('*');
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Patients Route] Utilizando fallback de mock:', (err as Error).message);
    let list = mockStore.getPatients();
    if (search) {
      const s = (search as string).toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s));
    }
    res.json(list);
  }
});

function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === Number(digits[10]);
}

function formatCPF(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// POST /api/patients - Criar
router.post('/', async (req, res, next) => {
  const { name, email, phone, birth_date, cpf, rg, address, city, state, zip_code, responsible_name, weight_kg, satisfaction_score, tenant_id } = req.body;
  const rawCpf = typeof cpf === 'string' ? cpf.trim() : '';
  const cpfDigits = rawCpf.replace(/\D/g, '');
  if (cpfDigits.length > 0 && !isValidCPF(cpfDigits)) {
    return res.status(400).json({ error: 'CPF inválido. Informe um CPF válido com 11 dígitos ou deixe em branco.' });
  }
  const normalizedCpf = cpfDigits.length === 11 ? formatCPF(cpfDigits) : null;

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('patients')
      .insert([{
        name,
        email: email || null,
        phone: phone || null,
        birth_date: birth_date || null,
        cpf: normalizedCpf,
        rg: rg || null,
        address: address || null,
        city: city || null,
        state: state || 'TO',
        zip_code: zip_code || null,
        responsible_name: responsible_name || null,
        weight_kg: weight_kg ? Number(weight_kg) : null,
        satisfaction_score: satisfaction_score !== undefined ? Number(satisfaction_score) : 10.0,
        tenant_id: tenant_id || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.warn('[Patients Route] Criando em mock:', (err as Error).message);
    const newPatient = {
      id: Math.random().toString(36).substring(2),
      name,
      email,
      phone,
      birth_date,
      cpf: normalizedCpf || '',
      satisfaction_score: 10.0
    };
    mockStore.addPatient(newPatient);
    res.status(201).json(newPatient);
  }
});

// PUT /api/patients/:id - Atualizar
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { name, email, phone, birth_date, cpf, rg, address, city, state, zip_code, responsible_name, weight_kg, satisfaction_score } = req.body;
  const rawCpf = typeof cpf === 'string' ? cpf.trim() : '';
  const cpfDigits = rawCpf.replace(/\D/g, '');
  if (cpfDigits.length > 0 && !isValidCPF(cpfDigits)) {
    return res.status(400).json({ error: 'CPF inválido. Informe um CPF válido com 11 dígitos ou deixe em branco.' });
  }
  const normalizedCpf = cpfDigits.length === 11 ? formatCPF(cpfDigits) : null;

  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('patients')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        birth_date: birth_date || null,
        cpf: normalizedCpf,
        rg: rg || null,
        address: address || null,
        city: city || null,
        state: state || 'TO',
        zip_code: zip_code || null,
        responsible_name: responsible_name || null,
        weight_kg: weight_kg ? Number(weight_kg) : null,
        satisfaction_score
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.warn('[Patients Route] Atualizando em mock:', (err as Error).message);
    const updated = mockStore.updatePatient(id, { name, email, phone, birth_date, cpf, satisfaction_score });
    if (!updated) return res.status(404).json({ error: 'Patient not found' });
    res.json(updated);
  }
});

// DELETE /api/patients/:id - Deletar
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!process.env.SUPABASE_URL) throw new Error('Supabase not configured');

    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.warn('[Patients Route] Deletando em mock:', (err as Error).message);
    const removed = mockStore.deletePatient(id);
    if (!removed) return res.status(404).json({ error: 'Patient not found' });
    res.json({ success: true, removed });
  }
});

export default router;
