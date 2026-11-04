import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Calculator,
  Plus,
  Trash2,
  Printer,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  Edit,
  RotateCcw,
  Send,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import { formatDate as formatDateShort } from '../lib/formatters';
import { generateBudgetPdfBase64 } from '../lib/budgetPdfGenerator';
import styles from './PatientBudget.module.css';

export interface BudgetPatient {
  id: string;
  name: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  responsible_name?: string;
  weight_kg?: number;
}

interface ProcedureCatalogItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  preco_praticado?: number;
  categoria_especialidade?: string;
}

export interface BudgetLineItem {
  id: string;
  procedure_id: string | null;
  name: string;
  tooth_region: string;
  quantity: number;
  unit_price: number;
}

export type BudgetStatus = 'pending' | 'approved' | 'rejected';

export interface SavedBudgetContent {
  status: BudgetStatus;
  items: BudgetLineItem[];
  subtotal: number;
  discount_type: 'value' | 'percent';
  discount_input: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  entry_value: number;
  installments: number;
  payment_conditions: string;
  validity_days: number;
  observations: string;
  dentist_name: string;
  dentist_cro: string;
  financial_launched?: boolean;
  financial_launched_at?: string;
  patientName?: string;
}

interface SavedBudgetRecord {
  id: string;
  title: string;
  type: string;
  created_at: string;
  content_snapshot: SavedBudgetContent;
}

interface ProfileItem {
  id: string;
  name: string;
  cro?: string;
  role: string;
}

interface PatientBudgetProps {
  patient: BudgetPatient;
  selectedUnit?: { id: string; name: string; address?: string; phone?: string };
  onBack: () => void;
  onOpenPapelaria?: (patient: BudgetPatient) => void;
}

const CLINIC_DEFAULTS = {
  dentist_name: 'Dra. Talissa Iurko',
  cro: '3906 - TO',
  address: 'Avenida Goiás - Centro - Gurupi - Tocantins',
  phone: '(63)98452-3437',
  city: 'Gurupi',
};

const formatCurrency = (val: number) =>
  val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatLongDate = (dateStr?: string) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${d.getDate()} de ${d.toLocaleString('pt-BR', { month: 'long' })} de ${d.getFullYear()}`;
};

export default function PatientBudget({
  patient,
  selectedUnit,
  onBack,
  onOpenPapelaria
}: PatientBudgetProps) {
  const { activeTenant, activeUnitId, user } = useTenant();

  const [viewMode, setViewMode] = useState<'builder' | 'preview'>('builder');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Catalog & Professionals
  const [procedures, setProcedures] = useState<ProcedureCatalogItem[]>([]);
  const [professionals, setProfessionals] = useState<ProfileItem[]>([]);
  const [selectedDentistName, setSelectedDentistName] = useState(CLINIC_DEFAULTS.dentist_name);
  const [selectedDentistCro, setSelectedDentistCro] = useState(CLINIC_DEFAULTS.cro);

  // Add Item Form
  const [selectedProcId, setSelectedProcId] = useState<string>('');
  const [customProcName, setCustomProcName] = useState<string>('');
  const [itemToothRegion, setItemToothRegion] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [itemUnitPrice, setItemUnitPrice] = useState<string>('');

  // Budget State
  const [items, setItems] = useState<BudgetLineItem[]>([]);
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<string>('À Vista (PIX / Dinheiro)');
  const [entryValue, setEntryValue] = useState<string>('0');
  const [installments, setInstallments] = useState<string>('1');
  const [paymentConditions, setPaymentConditions] = useState<string>('À Vista (PIX / Dinheiro)');
  const [validityDays, setValidityDays] = useState<string>('30');
  const [observations, setObservations] = useState<string>('');
  const [status, setStatus] = useState<BudgetStatus>('pending');
  const [financialLaunched, setFinancialLaunched] = useState<boolean>(false);

  // History of Budgets for this Patient
  const [budgetHistory, setBudgetHistory] = useState<SavedBudgetRecord[]>([]);

  // 1. Load Procedures & Dentists
  useEffect(() => {
    if (!activeTenant) return;

    supabase
      .from('procedures')
      .select('id, name, description, price, preco_praticado, categoria_especialidade')
      .eq('tenant_id', activeTenant.id)
      .order('name')
      .then(({ data }) => {
        setProcedures(data || []);
      });

    supabase
      .from('profiles')
      .select('id, name, cro, role')
      .eq('tenant_id', activeTenant.id)
      .order('name')
      .then(({ data }) => {
        const list = (data || []) as ProfileItem[];
        setProfessionals(list);
        if (user) {
          const current = list.find(p => p.id === user.id);
          if (current && current.name) {
            setSelectedDentistName(current.name);
            if (current.cro) setSelectedDentistCro(current.cro);
          }
        }
      });
  }, [activeTenant, user]);

  // 2. Load Patient Budget History
  const fetchBudgetHistory = async () => {
    if (!activeTenant || !patient?.id) return;
    const { data, error } = await supabase
      .from('generated_documents')
      .select('id, title, type, created_at, content_snapshot')
      .eq('tenant_id', activeTenant.id)
      .eq('patient_id', patient.id)
      .in('type', ['orcamento_estruturado', 'orcamento'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBudgetHistory(data as SavedBudgetRecord[]);
    }
  };

  useEffect(() => {
    fetchBudgetHistory();
  }, [activeTenant, patient.id]);

  // 3. Totals Calculation
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (acc, item) => acc + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    );
    const discRaw = Math.max(0, Number(discountInput || 0));
    const discountAmount =
      discountType === 'percent'
        ? Math.min(subtotal, (subtotal * Math.min(100, discRaw)) / 100)
        : Math.min(subtotal, discRaw);
    const total = Math.max(0, subtotal - discountAmount);

    return { subtotal, discountAmount, total };
  }, [items, discountType, discountInput]);

  // Auto-update paymentConditions text when paymentMethod, entryValue, installments or total change
  useEffect(() => {
    const entry = Math.max(0, Number(entryValue || 0));
    const numInst = Math.max(1, parseInt(installments || '1', 10));
    const remaining = Math.max(0, totals.total - entry);
    const instValue = numInst > 0 ? remaining / numInst : remaining;

    if (paymentMethod === 'À Vista (PIX / Dinheiro)') {
      setPaymentConditions(`À vista (PIX / Dinheiro): R$ ${formatCurrency(totals.total)}`);
    } else if (paymentMethod === 'Cartão de Crédito') {
      if (numInst > 1) {
        setPaymentConditions(
          `${numInst}x de R$ ${formatCurrency(totals.total / numInst)} no Cartão de Crédito (Total: R$ ${formatCurrency(totals.total)})`
        );
      } else {
        setPaymentConditions(`1x de R$ ${formatCurrency(totals.total)} no Cartão de Crédito`);
      }
    } else if (paymentMethod === 'Parcelado (Entrada + Parcelas)') {
      if (entry > 0) {
        setPaymentConditions(
          `Entrada de R$ ${formatCurrency(entry)} + ${numInst}x de R$ ${formatCurrency(instValue)}`
        );
      } else {
        setPaymentConditions(`${numInst}x de R$ ${formatCurrency(instValue)}`);
      }
    } else if (paymentMethod === 'Boleto / Carnê') {
      if (entry > 0) {
        setPaymentConditions(
          `Entrada de R$ ${formatCurrency(entry)} + ${numInst}x de R$ ${formatCurrency(instValue)} no Boleto`
        );
      } else {
        setPaymentConditions(`${numInst}x de R$ ${formatCurrency(instValue)} no Boleto`);
      }
    }
  }, [paymentMethod, entryValue, installments, totals.total]);

  // Handle Procedure Selection from Catalog
  const handleSelectProcedure = (procId: string) => {
    setSelectedProcId(procId);
    if (procId && procId !== '__custom__') {
      const found = procedures.find(p => p.id === procId);
      if (found) {
        const defaultPrice = Number(found.preco_praticado ?? found.price ?? 0);
        setItemUnitPrice(defaultPrice > 0 ? defaultPrice.toFixed(2) : '');
        setCustomProcName(found.name);
      }
    } else {
      setCustomProcName('');
      setItemUnitPrice('');
    }
  };

  // Add Item to List
  const handleAddItem = () => {
    const procName =
      selectedProcId && selectedProcId !== '__custom__'
        ? procedures.find(p => p.id === selectedProcId)?.name || customProcName.trim()
        : customProcName.trim();

    if (!procName) {
      alert('Selecione um procedimento ou digite a descrição do tratamento.');
      return;
    }

    const qty = Math.max(1, Number(itemQuantity || 1));
    const price = Math.max(0, Number(itemUnitPrice || 0));

    const newItem: BudgetLineItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      procedure_id: selectedProcId && selectedProcId !== '__custom__' ? selectedProcId : null,
      name: procName,
      tooth_region: itemToothRegion.trim() || 'Geral',
      quantity: qty,
      unit_price: price,
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProcId('');
    setCustomProcName('');
    setItemToothRegion('');
    setItemQuantity('1');
    setItemUnitPrice('');
  };

  // Update Item Inline
  const handleUpdateItem = (id: string, field: keyof BudgetLineItem, value: string | number) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Reset Form for a New Budget
  const handleResetForm = () => {
    setEditingBudgetId(null);
    setItems([]);
    setDiscountType('value');
    setDiscountInput('0');
    setPaymentMethod('À Vista (PIX / Dinheiro)');
    setEntryValue('0');
    setInstallments('1');
    setValidityDays('30');
    setObservations('');
    setStatus('pending');
    setFinancialLaunched(false);
    setViewMode('builder');
  };

  // Build Content Snapshot
  const buildSnapshot = (overrideStatus?: BudgetStatus, overrideLaunched?: boolean): SavedBudgetContent => ({
    status: overrideStatus || status,
    items,
    subtotal: totals.subtotal,
    discount_type: discountType,
    discount_input: Number(discountInput || 0),
    discount_amount: totals.discountAmount,
    total: totals.total,
    payment_method: paymentMethod,
    entry_value: Number(entryValue || 0),
    installments: Math.max(1, parseInt(installments || '1', 10)),
    payment_conditions: paymentConditions,
    validity_days: Math.max(1, parseInt(validityDays || '30', 10)),
    observations,
    dentist_name: selectedDentistName,
    dentist_cro: selectedDentistCro,
    financial_launched: overrideLaunched !== undefined ? overrideLaunched : financialLaunched,
    patientName: patient.name,
  });

  // Save Budget to Supabase
  const handleSaveBudget = async (
    openPreviewAfterSave = false,
    overrideStatus?: BudgetStatus
  ): Promise<string | null> => {
    if (!activeTenant) return null;
    if (items.length === 0) {
      alert('Adicione pelo menos 1 procedimento ao orçamento antes de salvar.');
      return null;
    }

    setSaving(true);
    try {
      const snapshot = buildSnapshot(overrideStatus);
      const summaryNames = items.slice(0, 2).map(i => i.name).join(', ');
      const extraCount = items.length > 2 ? ` +${items.length - 2}` : '';
      const docTitle = `Orçamento (${summaryNames}${extraCount}) — R$ ${formatCurrency(totals.total)}`;
      const unitIdToSave = selectedUnit?.id || activeUnitId || null;

      let savedId = editingBudgetId;

      if (editingBudgetId) {
        const { error } = await supabase
          .from('generated_documents')
          .update({
            title: docTitle,
            content_snapshot: snapshot,
            unit_id: unitIdToSave,
          })
          .eq('id', editingBudgetId)
          .eq('tenant_id', activeTenant.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('generated_documents')
          .insert({
            tenant_id: activeTenant.id,
            patient_id: patient.id,
            professional_id: user?.id || null,
            unit_id: unitIdToSave,
            type: 'orcamento_estruturado',
            title: docTitle,
            content_snapshot: snapshot,
          })
          .select('id')
          .single();

        if (error) throw error;
        savedId = data?.id || null;
        if (savedId) setEditingBudgetId(savedId);
      }

      if (overrideStatus) {
        setStatus(overrideStatus);
      }

      await fetchBudgetHistory();

      if (openPreviewAfterSave) {
        setViewMode('preview');
      } else {
        alert('Orçamento salvo com sucesso!');
      }

      return savedId;
    } catch (err: any) {
      console.error('Erro ao salvar orçamento:', err);
      alert('Erro ao salvar orçamento: ' + (err.message || err));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Launch Approved Budget into Financial (transactions table)
  const handleLaunchFinancial = async (record?: SavedBudgetRecord) => {
    if (!activeTenant) return;
    const unitId = selectedUnit?.id || activeUnitId;
    if (!unitId) {
      alert('Selecione uma unidade clínica no topo da página para lançar a receita no Financeiro.');
      return;
    }

    // If launching from the builder directly
    if (!record) {
      if (items.length === 0) {
        alert('Adicione pelo menos 1 procedimento ao orçamento.');
        return;
      }
      if (financialLaunched) {
        if (!confirm('Este orçamento já foi lançado no Financeiro anteriormente. Deseja lançar novamente?')) {
          return;
        }
      }

      setSaving(true);
      try {
        const summaryNames = items.map(i => `${i.name} (${i.tooth_region})`).join(', ');
        const description = `Orçamento Aprovado — ${patient.name}: ${summaryNames}`.slice(0, 240);

        const { error: txError } = await supabase.from('transactions').insert([
          {
            tenant_id: activeTenant.id,
            unit_id: unitId,
            patient_id: patient.id,
            type: 'income',
            amount: Number(totals.total.toFixed(2)),
            description,
            date: new Date().toISOString().split('T')[0],
          },
        ]);

        if (txError) throw txError;

        setStatus('approved');
        setFinancialLaunched(true);

        const snapshot = buildSnapshot('approved', true);
        snapshot.financial_launched_at = new Date().toISOString();
        const shortNames = items.slice(0, 2).map(i => i.name).join(', ');
        const extraCount = items.length > 2 ? ` +${items.length - 2}` : '';
        const docTitle = `Orçamento (${shortNames}${extraCount}) — R$ ${formatCurrency(totals.total)}`;

        if (editingBudgetId) {
          await supabase
            .from('generated_documents')
            .update({
              title: docTitle,
              content_snapshot: snapshot,
              unit_id: unitId,
            })
            .eq('id', editingBudgetId)
            .eq('tenant_id', activeTenant.id);
        } else {
          const { data } = await supabase
            .from('generated_documents')
            .insert({
              tenant_id: activeTenant.id,
              patient_id: patient.id,
              professional_id: user?.id || null,
              unit_id: unitId,
              type: 'orcamento_estruturado',
              title: docTitle,
              content_snapshot: snapshot,
            })
            .select('id')
            .single();
          if (data?.id) setEditingBudgetId(data.id);
        }

        await fetchBudgetHistory();
        alert(`Orçamento aprovado e receita de R$ ${formatCurrency(totals.total)} lançada no Financeiro!`);
      } catch (err: any) {
        console.error('Erro ao aprovar e lançar orçamento:', err);
        alert('Erro ao lançar no Financeiro: ' + (err.message || err));
      } finally {
        setSaving(false);
      }
      return;
    }

    // Launching from a saved history card
    const snap = record.content_snapshot;
    if (!snap || !snap.total) {
      alert('Este registro não possui valor estruturado para lançamento automático.');
      return;
    }
    if (snap.financial_launched) {
      if (!confirm('Este orçamento já consta como lançado no Financeiro. Deseja lançar novamente?')) {
        return;
      }
    }

    try {
      const summaryNames = (snap.items || []).map(i => i.name).join(', ');
      const description = `Orçamento Aprovado — ${patient.name}: ${summaryNames}`.slice(0, 240);

      const { error: txError } = await supabase.from('transactions').insert([
        {
          tenant_id: activeTenant.id,
          unit_id: unitId,
          patient_id: patient.id,
          type: 'income',
          amount: Number(Number(snap.total).toFixed(2)),
          description,
          date: new Date().toISOString().split('T')[0],
        },
      ]);

      if (txError) throw txError;

      const updatedSnap: SavedBudgetContent = {
        ...snap,
        status: 'approved',
        financial_launched: true,
        financial_launched_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from('generated_documents')
        .update({ content_snapshot: updatedSnap })
        .eq('id', record.id)
        .eq('tenant_id', activeTenant.id);

      if (updErr) throw updErr;

      if (editingBudgetId === record.id) {
        setStatus('approved');
        setFinancialLaunched(true);
      }

      await fetchBudgetHistory();
      alert(`Receita de R$ ${formatCurrency(Number(snap.total))} lançada com sucesso no Fluxo de Caixa!`);
    } catch (err: any) {
      console.error('Erro ao lançar receita:', err);
      alert('Erro ao lançar receita: ' + (err.message || err));
    }
  };

  // Load a Saved Budget into Builder or Preview
  const handleLoadSavedBudget = (record: SavedBudgetRecord, openPreview = false) => {
    const snap = record.content_snapshot;
    if (!snap || !Array.isArray(snap.items)) {
      alert('Este orçamento foi gerado no formato textual antigo da Papelaria.');
      return;
    }

    setEditingBudgetId(record.id);
    setItems(snap.items);
    setDiscountType(snap.discount_type || 'value');
    setDiscountInput(String(snap.discount_input ?? 0));
    setPaymentMethod(snap.payment_method || 'Personalizado');
    setEntryValue(String(snap.entry_value ?? 0));
    setInstallments(String(snap.installments ?? 1));
    setPaymentConditions(snap.payment_conditions || '');
    setValidityDays(String(snap.validity_days ?? 30));
    setObservations(snap.observations || '');
    setStatus(snap.status || 'pending');
    setFinancialLaunched(Boolean(snap.financial_launched));
    if (snap.dentist_name) setSelectedDentistName(snap.dentist_name);
    if (snap.dentist_cro) setSelectedDentistCro(snap.dentist_cro);

    setViewMode(openPreview ? 'preview' : 'builder');
  };

  // Quick Change Status on Saved Budget
  const handleQuickStatusChange = async (record: SavedBudgetRecord, newStatus: BudgetStatus) => {
    if (!activeTenant) return;
    try {
      const updatedSnap: SavedBudgetContent = {
        ...record.content_snapshot,
        status: newStatus,
      };
      const { error } = await supabase
        .from('generated_documents')
        .update({ content_snapshot: updatedSnap })
        .eq('id', record.id)
        .eq('tenant_id', activeTenant.id);

      if (error) throw error;
      if (editingBudgetId === record.id) {
        setStatus(newStatus);
      }
      await fetchBudgetHistory();
    } catch (err: any) {
      alert('Erro ao atualizar status do orçamento: ' + (err.message || err));
    }
  };

  // Delete Saved Budget
  const handleDeleteBudget = async (id: string) => {
    if (!activeTenant) return;
    if (!confirm('Deseja realmente excluir este orçamento do histórico do paciente?')) return;
    try {
      const { error } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', id)
        .eq('tenant_id', activeTenant.id);

      if (error) throw error;
      if (editingBudgetId === id) {
        handleResetForm();
      }
      await fetchBudgetHistory();
    } catch (err: any) {
      alert('Erro ao excluir orçamento: ' + (err.message || err));
    }
  };

  const clinicAddress =
    selectedUnit?.address ||
    (activeTenant?.logradouro
      ? `${activeTenant.logradouro}${activeTenant.numero ? `, ${activeTenant.numero}` : ''}${activeTenant.bairro ? ` - ${activeTenant.bairro}` : ''} - ${activeTenant.cidade || CLINIC_DEFAULTS.city}/${activeTenant.estado || 'TO'}`
      : CLINIC_DEFAULTS.address);

  const clinicPhone =
    selectedUnit?.phone || activeTenant?.telefone_whatsapp || CLINIC_DEFAULTS.phone;

  const clinicCity = activeTenant?.cidade || patient.city || CLINIC_DEFAULTS.city;

  // Generate PDF object from current builder state or a saved record
  const createPdfData = (record?: SavedBudgetRecord) => {
    const snap = record?.content_snapshot;
    const pdfItems = snap?.items || items;
    const pdfSubtotal = snap ? Number(snap.subtotal || 0) : totals.subtotal;
    const pdfDiscountType = snap?.discount_type || discountType;
    const pdfDiscountInput = snap ? Number(snap.discount_input || 0) : Number(discountInput || 0);
    const pdfDiscountAmount = snap ? Number(snap.discount_amount || 0) : totals.discountAmount;
    const pdfTotal = snap ? Number(snap.total || 0) : totals.total;
    const pdfPaymentConditions = snap?.payment_conditions || paymentConditions || paymentMethod;
    const pdfValidityDays = snap ? Number(snap.validity_days || 30) : Number(validityDays || 30);
    const pdfObservations = snap ? snap.observations : observations;
    const pdfStatus = snap?.status || status;
    const pdfDentistName = snap?.dentist_name || selectedDentistName;
    const pdfDentistCro = snap?.dentist_cro || selectedDentistCro;

    return {
      pdf: generateBudgetPdfBase64({
        clinicName: activeTenant?.nome_clinica || pdfDentistName,
        dentistName: pdfDentistName,
        dentistCro: pdfDentistCro,
        clinicAddress,
        clinicPhone,
        clinicCity,
        patient,
        items: pdfItems,
        subtotal: pdfSubtotal,
        discountType: pdfDiscountType,
        discountInput: pdfDiscountInput,
        discountAmount: pdfDiscountAmount,
        total: pdfTotal,
        paymentConditions: pdfPaymentConditions,
        validityDays: pdfValidityDays,
        observations: pdfObservations,
        status: pdfStatus,
        createdAt: record?.created_at,
      }),
      pdfTotal,
      pdfPaymentConditions,
      pdfValidityDays,
      pdfItems,
    };
  };

  // Direct PDF Download helper
  const handleDownloadPdf = (record?: SavedBudgetRecord) => {
    const targetItems = record?.content_snapshot?.items || items;
    if (!targetItems || targetItems.length === 0) {
      alert('Adicione pelo menos 1 procedimento ao orçamento para gerar o PDF.');
      return;
    }
    const { pdf } = createPdfData(record);
    const link = document.createElement('a');
    link.href = pdf.dataUri;
    link.download = pdf.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Send Budget PDF via WhatsApp (UAZAPI)
  const handleSendWhatsAppPdf = async (record?: SavedBudgetRecord) => {
    if (!activeTenant) return;

    const targetItems = record?.content_snapshot?.items || items;
    if (!targetItems || targetItems.length === 0) {
      alert('Adicione pelo menos 1 procedimento ao orçamento antes de enviar por WhatsApp.');
      return;
    }

    let targetPhone = (patient.phone || '').trim();
    if (!targetPhone) {
      const prompted = prompt(
        `O paciente ${patient.name} não possui telefone cadastrado.\nInforme o número de WhatsApp com DDD para enviar o PDF:`,
        ''
      );
      if (!prompted || !prompted.trim()) return;
      targetPhone = prompted.trim();
    }

    let cleanNumber = targetPhone.replace(/\D/g, '');
    if (cleanNumber.length === 10 || cleanNumber.length === 11) {
      cleanNumber = '55' + cleanNumber;
    }

    if (cleanNumber.length < 10) {
      alert('Número de telefone inválido para envio via WhatsApp.');
      return;
    }

    setSendingWhatsApp(true);
    try {
      // Se estiver enviando do construtor e ainda não tiver salvo, salva automaticamente no histórico
      if (!record && !editingBudgetId) {
        await handleSaveBudget(false);
      }

      const { pdf, pdfTotal, pdfPaymentConditions, pdfValidityDays } = createPdfData(record);
      const clinicDisplayName = activeTenant.nome_clinica || selectedDentistName;

      const caption =
        `Olá, *${patient.name}*! 🦷✨\n` +
        `Segue em anexo o seu *Orçamento e Plano de Tratamento Odontológico* (${clinicDisplayName}).\n\n` +
        `• *Valor Total:* R$ ${formatCurrency(pdfTotal)}\n` +
        `• *Condições:* ${pdfPaymentConditions}\n` +
        `• *Validade:* ${pdfValidityDays} dias\n\n` +
        `Ficamos à disposição para qualquer dúvida!`;

      // Buscar credenciais da UAZAPI do tenant
      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('uazapi_server_url, uazapi_instance_id, uazapi_token, whatsapp_conectado')
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();

      const hasUazapiToken = Boolean(integration && integration.uazapi_token);

      if (!hasUazapiToken) {
        // Fallback: baixa o PDF e abre WhatsApp Web caso o token ainda não esteja preenchido
        handleDownloadPdf(record);
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(caption)}`;
        window.open(waUrl, '_blank');
        alert(
          'O Token da UAZAPI ainda não está configurado em Configurações > Integrações.\nO PDF foi baixado automaticamente e o WhatsApp Web foi aberto para você anexá-lo.'
        );
        return;
      }

      const serverUrl = (integration?.uazapi_server_url || 'https://api.uazapi.com').replace(/\/$/, '');
      let sentDirectly = false;

      // 1. Tenta enviar o PDF diretamente para o endpoint /send/media da UAZAPI
      try {
        const directRes = await fetch(`${serverUrl}/send/media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            token: integration!.uazapi_token,
          },
          body: JSON.stringify({
            number: cleanNumber,
            type: 'document',
            file: pdf.dataUri,
            docName: pdf.fileName,
            text: caption,
          }),
        });

        if (directRes.ok) {
          sentDirectly = true;
        } else {
          const errBody = await directRes.text();
          console.warn('Resposta UAZAPI /send/media direta:', directRes.status, errBody);
        }
      } catch (directErr) {
        console.warn('Tentativa direta UAZAPI /send/media falhou, tentando via Edge Function:', directErr);
      }

      // 2. Se a chamada direta encontrou bloqueio CORS ou erro, usa a Edge Function send-message
      if (!sentDirectly) {
        const { error: fnError } = await supabase.functions.invoke('send-message', {
          body: {
            tenant_id: activeTenant.id,
            phone: cleanNumber,
            message: caption,
            channel: 'whatsapp',
            file_base64: pdf.dataUri,
            doc_name: pdf.fileName,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || 'Falha ao enviar documento via UAZAPI.');
        }
      }

      // 3. Registrar no histórico de chat do paciente (zai_chats / zai_messages)
      try {
        const { data: existingChat } = await supabase
          .from('zai_chats')
          .select('id')
          .eq('tenant_id', activeTenant.id)
          .eq('patient_id', patient.id)
          .maybeSingle();

        let chatId = existingChat?.id;
        if (!chatId) {
          const { data: newChat } = await supabase
            .from('zai_chats')
            .insert({
              tenant_id: activeTenant.id,
              type: 'patient',
              title: `${patient.name} (Paciente)`,
              patient_id: patient.id,
            })
            .select('id')
            .single();
          chatId = newChat?.id;
        }

        if (chatId) {
          await supabase.from('zai_messages').insert({
            chat_id: chatId,
            tenant_id: activeTenant.id,
            sender_id: user?.id || null,
            sender_name: selectedDentistName,
            sender_role: 'staff',
            text: `[WhatsApp PDF — ${pdf.fileName}] Orçamento enviado no valor de R$ ${formatCurrency(pdfTotal)}`,
          });
        }
      } catch (chatLogErr) {
        console.warn('Aviso ao registrar log no chat:', chatLogErr);
      }

      alert(`Orçamento em PDF (${pdf.fileName}) enviado com sucesso para o WhatsApp de ${patient.name}!`);
    } catch (err: any) {
      console.error('Erro ao enviar orçamento via WhatsApp:', err);
      alert('Erro ao enviar PDF no WhatsApp via UAZAPI: ' + (err.message || err));
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // =========================================================================
  // RENDER PREVIEW (A4 PRINTABLE VIEW)
  // =========================================================================
  if (viewMode === 'preview') {
    return (
      <div className={styles.container}>
        <div className={styles.previewToolbar}>
          <button className={styles.backToPatientsBtn} onClick={() => setViewMode('builder')}>
            <ArrowLeft size={16} /> Voltar para Edição do Orçamento
          </button>

          <div className={styles.previewToolbarActions}>
            <button
              type="button"
              className={styles.whatsappActionBtn}
              onClick={() => handleSendWhatsAppPdf()}
              disabled={sendingWhatsApp || saving}
            >
              <Send size={16} />
              <span>{sendingWhatsApp ? 'Enviando PDF...' : 'Enviar PDF via WhatsApp'}</span>
            </button>
            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={() => handleDownloadPdf()}
            >
              <Download size={16} /> Baixar PDF
            </button>
            {!financialLaunched && (
              <button
                className={styles.successActionBtn}
                onClick={() => handleLaunchFinancial()}
                disabled={saving}
              >
                <DollarSign size={16} /> Aprovar e Lançar no Financeiro
              </button>
            )}
            <button className={styles.primaryActionBtn} onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </button>
          </div>
        </div>

        <div className={styles.printArea} id="orcamento-print-area">
          <div className={styles.a4Page}>
            {/* Cabeçalho da Clínica e Dentista */}
            <div className={styles.docHeader}>
              <div>
                {activeTenant?.logo_url && (
                  <img
                    src={activeTenant.logo_url}
                    alt={activeTenant.nome_clinica}
                    style={{ maxHeight: '48px', marginBottom: '6px', objectFit: 'contain' }}
                  />
                )}
                <div className={styles.docClinicName}>
                  {activeTenant?.nome_clinica || selectedDentistName}
                </div>
                <div className={styles.docClinicDetail}>
                  Profissional Responsável: <strong>{selectedDentistName}</strong> — CRO: {selectedDentistCro}
                </div>
                <div className={styles.docClinicDetail}>{clinicAddress}</div>
                <div className={styles.docClinicDetail}>Tel / WhatsApp: {clinicPhone}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11.5px', color: '#374151' }}>
                <div><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
                <div><strong>Validade:</strong> {validityDays || 30} dias</div>
                <div>
                  <strong>Status:</strong>{' '}
                  {status === 'approved'
                    ? 'APROVADO'
                    : status === 'rejected'
                    ? 'RECUSADO'
                    : 'EM AVALIAÇÃO'}
                </div>
              </div>
            </div>

            <div className={styles.docDivider} />

            <h1 className={styles.docTitle}>Orçamento e Plano de Tratamento Odontológico</h1>

            {/* Dados Completos do Paciente */}
            <div className={styles.docPatientBox}>
              <div><strong>Paciente:</strong> {patient.name}</div>
              <div><strong>CPF:</strong> {patient.cpf || ' Não informado'}</div>
              <div><strong>RG:</strong> {patient.rg || ' Não informado'}</div>
              <div>
                <strong>Data de Nasc.:</strong>{' '}
                {patient.birth_date ? formatDateShort(patient.birth_date) : ' Não informada'}
              </div>
              <div><strong>Telefone:</strong> {patient.phone || ' Não informado'}</div>
              <div><strong>E-mail:</strong> {patient.email || ' Não informado'}</div>
              {(patient.address || patient.city || patient.zip_code) && (
                <div className={styles.docPatientFullRow}>
                  <strong>Endereço:</strong>{' '}
                  {[
                    patient.address,
                    patient.city ? `${patient.city}/${patient.state || 'TO'}` : '',
                    patient.zip_code ? `CEP: ${patient.zip_code}` : '',
                  ]
                    .filter(Boolean)
                    .join(' — ')}
                </div>
              )}
              {patient.responsible_name && (
                <div className={styles.docPatientFullRow}>
                  <strong>Responsável Legal:</strong> {patient.responsible_name}
                </div>
              )}
            </div>

            {/* Tabela de Procedimentos */}
            <table className={styles.docTable}>
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>#</th>
                  <th>Procedimento / Tratamento Proposto</th>
                  <th style={{ width: '130px' }}>Dente / Região</th>
                  <th style={{ width: '55px', textAlign: 'center' }}>Qtd</th>
                  <th style={{ width: '105px', textAlign: 'right' }}>Valor Unit.</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.tooth_region || 'Geral'}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>R$ {formatCurrency(item.unit_price)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      R$ {formatCurrency(item.quantity * item.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resumo de Valores */}
            <div className={styles.docTotalsBox}>
              <div className={styles.docTotalLine}>
                <span>Subtotal Bruto:</span>
                <strong>R$ {formatCurrency(totals.subtotal)}</strong>
              </div>
              {totals.discountAmount > 0 && (
                <div className={styles.docTotalLine} style={{ color: '#15803d' }}>
                  <span>
                    Desconto {discountType === 'percent' ? `(${discountInput}%)` : ''}:
                  </span>
                  <strong>- R$ {formatCurrency(totals.discountAmount)}</strong>
                </div>
              )}
              <div className={styles.docTotalFinal}>
                <span>VALOR TOTAL:</span>
                <span>R$ {formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Condições de Pagamento */}
            <div className={styles.docSectionBox}>
              <div>
                <strong>Forma e Condições de Pagamento:</strong>{' '}
                {paymentConditions || paymentMethod}
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#4b5563' }}>
                * Este orçamento tem validade de <strong>{validityDays || 30} dias</strong> a contar da data de sua emissão.
              </div>
            </div>

            {/* Observações */}
            {observations && (
              <div className={styles.docSectionBox}>
                <strong>Observações Clínicas / Recomendações:</strong>
                <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{observations}</div>
              </div>
            )}

            {/* Declaração de Ciência */}
            <p style={{ fontSize: '11px', textAlign: 'justify', color: '#374151', marginTop: '12px' }}>
              Declaro que fui devidamente esclarecido(a) sobre o diagnóstico, plano de tratamento odontológico acima descrito, seus custos, alternativas e orientações clínicas, estando de acordo com as condições apresentadas.
            </p>

            {/* Rodapé e Assinaturas */}
            <div className={styles.docFooter}>
              <div>
                {clinicCity}, {formatLongDate()}.
              </div>

              <div className={styles.docSignatures}>
                <div className={styles.docSigBlock}>
                  <div className={styles.docSigLine} />
                  <div className={styles.docSigLabel}>
                    <strong>{patient.name}</strong>
                    {patient.responsible_name ? ` / ${patient.responsible_name} (Responsável)` : ''}
                    <br />
                    {patient.cpf ? `CPF: ${patient.cpf}` : 'Assinatura do Paciente / Responsável'}
                  </div>
                </div>

                <div className={styles.docSigBlock}>
                  <div className={styles.docSigLine} />
                  <div className={styles.docSigLabel}>
                    <strong>{selectedDentistName}</strong>
                    <br />
                    CRO: {selectedDentistCro}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER BUILDER + HISTORY
  // =========================================================================
  return (
    <div className={styles.container}>
      {/* Header + Patient Full Summary */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backToPatientsBtn} onClick={onBack}>
            <ArrowLeft size={16} /> Voltar para Pacientes
          </button>

          <div className={styles.headerRightActions}>
            {editingBudgetId && (
              <button className={styles.openPapelariaBtn} onClick={handleResetForm}>
                <RotateCcw size={15} /> Novo Orçamento em Branco
              </button>
            )}
            {onOpenPapelaria && (
              <button
                className={styles.openPapelariaBtn}
                onClick={() => onOpenPapelaria(patient)}
              >
                <FileText size={15} /> Abrir Papelaria do Paciente
              </button>
            )}
          </div>
        </div>

        <div className={styles.headerTitleRow}>
          <div>
            <div className={styles.headerTitle}>
              <Calculator size={24} style={{ color: 'hsl(var(--primary))' }} />
              <h1>
                {editingBudgetId ? 'Editando Orçamento' : 'Orçamento e Plano de Tratamento'} — {patient.name}
              </h1>
            </div>
            <p className={styles.headerSubtitle}>
              Selecione os procedimentos da clínica, defina condições de pagamento, imprima o plano de tratamento ou lance a receita no Financeiro.
            </p>
          </div>
        </div>

        {/* Dados Automáticos do Paciente */}
        <div className={styles.patientBanner}>
          <div className={styles.patientField}>
            <span className={styles.patientFieldLabel}>Paciente</span>
            <span className={styles.patientFieldValue}>{patient.name}</span>
          </div>
          <div className={styles.patientField}>
            <span className={styles.patientFieldLabel}>CPF / RG</span>
            <span className={styles.patientFieldValue}>
              {patient.cpf || '—'} {patient.rg ? ` / RG: ${patient.rg}` : ''}
            </span>
          </div>
          <div className={styles.patientField}>
            <span className={styles.patientFieldLabel}>Telefone / WhatsApp</span>
            <span className={styles.patientFieldValue}>{patient.phone || '—'}</span>
          </div>
          <div className={styles.patientField}>
            <span className={styles.patientFieldLabel}>Data de Nascimento</span>
            <span className={styles.patientFieldValue}>
              {patient.birth_date ? formatDateShort(patient.birth_date) : '—'}
            </span>
          </div>
          <div className={styles.patientField}>
            <span className={styles.patientFieldLabel}>Endereço / Cidade</span>
            <span className={styles.patientFieldValue}>
              {[patient.address, patient.city].filter(Boolean).join(' — ') || '—'}
            </span>
          </div>
          {patient.responsible_name && (
            <div className={styles.patientField}>
              <span className={styles.patientFieldLabel}>Responsável Legal</span>
              <span className={styles.patientFieldValue}>{patient.responsible_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column: Procedures & Items Table */}
        <div className={styles.card}>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>
              <Calculator size={18} style={{ color: 'hsl(var(--primary))' }} />
              Procedimentos do Plano de Tratamento
            </span>
            <span style={{ fontSize: '12.5px', color: 'hsl(var(--text-muted))' }}>
              {items.length} {items.length === 1 ? 'item adicionado' : 'itens adicionados'}
            </span>
          </div>

          {/* Add Procedure Box */}
          <div className={styles.addProcBox}>
            <div className={styles.addProcGrid}>
              <div className={styles.formGroup}>
                <label>Procedimento Cadastrado</label>
                <select
                  className={styles.select}
                  value={selectedProcId}
                  onChange={e => handleSelectProcedure(e.target.value)}
                >
                  <option value="">Selecione um procedimento da clínica...</option>
                  {procedures.map(p => {
                    const pPrice = Number(p.preco_praticado ?? p.price ?? 0);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.categoria_especialidade ? `(${p.categoria_especialidade})` : ''} — R$ {formatCurrency(pPrice)}
                      </option>
                    );
                  })}
                  <option value="__custom__">+ Digitar procedimento manualmente...</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Dente / Região</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Dente 36, Arcada Sup."
                  value={itemToothRegion}
                  onChange={e => setItemToothRegion(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Qtd / Sessões</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={styles.input}
                  value={itemQuantity}
                  onChange={e => setItemQuantity(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Valor Unitário (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.input}
                  placeholder="0,00"
                  value={itemUnitPrice}
                  onChange={e => setItemUnitPrice(e.target.value)}
                />
              </div>

              <button type="button" className={styles.addBtn} onClick={handleAddItem}>
                <Plus size={16} />
                <span>Adicionar</span>
              </button>
            </div>

            {selectedProcId === '__custom__' && (
              <div className={styles.formGroup}>
                <label>Nome / Descrição do Procedimento Personalizado</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Reabilitação protética provisória..."
                  value={customProcName}
                  onChange={e => setCustomProcName(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className={styles.itemsTableWrapper}>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Procedimento / Tratamento</th>
                  <th style={{ width: '150px' }}>Dente / Região</th>
                  <th style={{ width: '80px' }}>Qtd</th>
                  <th style={{ width: '130px' }}>Valor Unit. (R$)</th>
                  <th style={{ width: '120px' }}>Subtotal</th>
                  <th style={{ width: '48px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="text"
                          className={styles.inlineInput}
                          style={{ fontWeight: 600 }}
                          value={item.name}
                          onChange={e => handleUpdateItem(item.id, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={styles.inlineInput}
                          value={item.tooth_region}
                          onChange={e => handleUpdateItem(item.id, 'tooth_region', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className={styles.inlineInput}
                          value={item.quantity}
                          onChange={e =>
                            handleUpdateItem(item.id, 'quantity', Math.max(1, Number(e.target.value || 1)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={styles.inlineInput}
                          value={item.unit_price}
                          onChange={e =>
                            handleUpdateItem(item.id, 'unit_price', Math.max(0, Number(e.target.value || 0)))
                          }
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        R$ {formatCurrency(item.quantity * item.unit_price)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.removeItemBtn}
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remover item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: 'center',
                        padding: '32px',
                        color: 'hsl(var(--text-muted))',
                      }}
                    >
                      Nenhum procedimento adicionado ainda. Selecione um procedimento acima e clique em "Adicionar".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Observations & Dentist Info */}
          <div className={styles.installmentGrid}>
            <div className={styles.formGroup}>
              <label>Profissional Responsável pelo Orçamento</label>
              <select
                className={styles.select}
                value={selectedDentistName}
                onChange={e => {
                  const name = e.target.value;
                  setSelectedDentistName(name);
                  const found = professionals.find(p => p.name === name);
                  if (found?.cro) setSelectedDentistCro(found.cro);
                }}
              >
                <option value={CLINIC_DEFAULTS.dentist_name}>
                  {CLINIC_DEFAULTS.dentist_name} (CRO: {CLINIC_DEFAULTS.cro})
                </option>
                {professionals
                  .filter(p => p.name && p.name !== CLINIC_DEFAULTS.dentist_name)
                  .map(p => (
                    <option key={p.id} value={p.name}>
                      {p.name} {p.cro ? `(CRO: ${p.cro})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>CRO do Profissional</label>
              <input
                type="text"
                className={styles.input}
                value={selectedDentistCro}
                onChange={e => setSelectedDentistCro(e.target.value)}
                placeholder="Ex: 3906 - TO"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Observações Clínicas / Recomendações ao Paciente (Opcional)</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Ex: Planejamento sujeito a avaliação radiográfica complementar. Recomendado iniciar pela adequação do meio bucal..."
              value={observations}
              onChange={e => setObservations(e.target.value)}
            />
          </div>
        </div>

        {/* Right Column: Financial Summary & Payment Conditions */}
        <div className={styles.card}>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>
              <DollarSign size={18} style={{ color: 'hsl(var(--success))' }} />
              Resumo e Pagamento
            </span>
          </div>

          <div className={styles.summaryRow}>
            <span>Subtotal Bruto:</span>
            <strong>R$ {formatCurrency(totals.subtotal)}</strong>
          </div>

          <div className={styles.discountRow}>
            <div className={styles.formGroup}>
              <label>Desconto</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={styles.input}
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Tipo</label>
              <select
                className={styles.select}
                value={discountType}
                onChange={e => setDiscountType(e.target.value as 'value' | 'percent')}
              >
                <option value="value">R$</option>
                <option value="percent">%</option>
              </select>
            </div>
          </div>

          {totals.discountAmount > 0 && (
            <div className={styles.summaryRow} style={{ color: 'hsl(var(--success))' }}>
              <span>Desconto Aplicado:</span>
              <strong style={{ color: 'hsl(var(--success))' }}>
                - R$ {formatCurrency(totals.discountAmount)}
              </strong>
            </div>
          )}

          <div className={styles.totalBox}>
            <span className={styles.totalLabel}>Total Líquido</span>
            <span className={styles.totalValue}>R$ {formatCurrency(totals.total)}</span>
          </div>

          <div className={styles.formGroup}>
            <label>Modalidade de Pagamento</label>
            <select
              className={styles.select}
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
            >
              <option value="À Vista (PIX / Dinheiro)">À Vista (PIX / Dinheiro)</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Parcelado (Entrada + Parcelas)">Parcelado (Entrada + Parcelas)</option>
              <option value="Boleto / Carnê">Boleto / Carnê</option>
              <option value="Personalizado">Personalizado</option>
            </select>
          </div>

          {(paymentMethod === 'Cartão de Crédito' ||
            paymentMethod === 'Parcelado (Entrada + Parcelas)' ||
            paymentMethod === 'Boleto / Carnê') && (
            <div className={styles.installmentGrid}>
              {paymentMethod !== 'Cartão de Crédito' && (
                <div className={styles.formGroup}>
                  <label>Entrada (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.input}
                    value={entryValue}
                    onChange={e => setEntryValue(e.target.value)}
                  />
                </div>
              )}
              <div className={styles.formGroup}>
                <label>Nº de Parcelas</label>
                <select
                  className={styles.select}
                  value={installments}
                  onChange={e => setInstallments(e.target.value)}
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={String(n)}>
                      {n}x
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Descrição das Condições de Pagamento</label>
            <textarea
              className={styles.textarea}
              rows={2}
              value={paymentConditions}
              onChange={e => setPaymentConditions(e.target.value)}
              placeholder="Ex: Entrada de R$ 500,00 + 3x de R$ 300,00"
            />
          </div>

          <div className={styles.installmentGrid}>
            <div className={styles.formGroup}>
              <label>Validade (dias)</label>
              <input
                type="number"
                min="1"
                className={styles.input}
                value={validityDays}
                onChange={e => setValidityDays(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Status do Orçamento</label>
              <select
                className={styles.select}
                value={status}
                onChange={e => setStatus(e.target.value as BudgetStatus)}
              >
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Recusado</option>
              </select>
            </div>
          </div>

          <div className={styles.actionButtonsStack}>
            <button
              type="button"
              className={styles.whatsappActionBtn}
              onClick={() => handleSendWhatsAppPdf()}
              disabled={sendingWhatsApp || saving}
            >
              <Send size={16} />
              <span>{sendingWhatsApp ? 'Enviando PDF no WhatsApp...' : 'Enviar PDF via WhatsApp (UAZAPI)'}</span>
            </button>

            <button
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => handleSaveBudget(true)}
              disabled={saving}
            >
              <Printer size={16} />
              <span>{saving ? 'Salvando...' : 'Salvar e Visualizar Impressão / PDF'}</span>
            </button>

            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={() => handleSaveBudget(false)}
              disabled={saving}
            >
              <Save size={16} />
              <span>{editingBudgetId ? 'Atualizar Orçamento' : 'Apenas Salvar no Histórico'}</span>
            </button>

            <button
              type="button"
              className={styles.successActionBtn}
              onClick={() => handleLaunchFinancial()}
              disabled={saving}
            >
              <CheckCircle2 size={16} />
              <span>Aprovar e Lançar Receita no Financeiro</span>
            </button>
          </div>
        </div>
      </div>

      {/* Histórico de Orçamentos do Paciente */}
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>
            <Clock size={18} style={{ color: 'hsl(var(--primary))' }} />
            Histórico de Orçamentos de {patient.name}
          </span>
          <span style={{ fontSize: '12.5px', color: 'hsl(var(--text-muted))' }}>
            {budgetHistory.length} {budgetHistory.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {budgetHistory.length > 0 ? (
          <div className={styles.historyGrid}>
            {budgetHistory.map(rec => {
              const snap = rec.content_snapshot || ({} as SavedBudgetContent);
              const recStatus: BudgetStatus = snap.status || 'pending';
              const isStructured = Array.isArray(snap.items);

              return (
                <div key={rec.id} className={styles.historyCard}>
                  <div className={styles.historyInfo}>
                    <div className={styles.historyTitleLine}>
                      <span className={styles.historyTitleText}>{rec.title}</span>

                      <span
                        className={`${styles.statusBadge} ${
                          recStatus === 'approved'
                            ? styles.statusApproved
                            : recStatus === 'rejected'
                            ? styles.statusRejected
                            : styles.statusPending
                        }`}
                      >
                        {recStatus === 'approved' && <CheckCircle2 size={12} />}
                        {recStatus === 'rejected' && <XCircle size={12} />}
                        {recStatus === 'pending' && <Clock size={12} />}
                        {recStatus === 'approved'
                          ? 'Aprovado'
                          : recStatus === 'rejected'
                          ? 'Recusado'
                          : 'Pendente'}
                      </span>

                      {snap.financial_launched && (
                        <span className={styles.financialBadge}>
                          <DollarSign size={11} /> Receita Lançada no Financeiro
                        </span>
                      )}
                    </div>

                    <div className={styles.historyMeta}>
                      Criado em {new Date(rec.created_at).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(rec.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {snap.payment_conditions ? ` • Pagamento: ${snap.payment_conditions}` : ''}
                      {snap.dentist_name ? ` • Profissional: ${snap.dentist_name}` : ''}
                    </div>
                  </div>

                  <div className={styles.historyActions}>
                    {isStructured && (
                      <>
                        <button
                          type="button"
                          className={`${styles.smallBtn} ${styles.smallBtnWhatsapp}`}
                          onClick={() => handleSendWhatsAppPdf(rec)}
                          disabled={sendingWhatsApp}
                          title="Enviar PDF deste orçamento via WhatsApp (UAZAPI)"
                        >
                          <Send size={13} /> Enviar PDF WhatsApp
                        </button>

                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => handleDownloadPdf(rec)}
                          title="Baixar arquivo PDF deste orçamento"
                        >
                          <Download size={13} /> PDF
                        </button>

                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => handleLoadSavedBudget(rec, true)}
                          title="Visualizar e imprimir"
                        >
                          <Printer size={13} /> Imprimir
                        </button>

                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => handleLoadSavedBudget(rec, false)}
                          title="Editar este orçamento"
                        >
                          <Edit size={13} /> Editar
                        </button>

                        {recStatus !== 'approved' && (
                          <button
                            type="button"
                            className={`${styles.smallBtn} ${styles.smallBtnSuccess}`}
                            onClick={() => handleQuickStatusChange(rec, 'approved')}
                            title="Marcar como Aprovado"
                          >
                            <CheckCircle2 size={13} /> Aprovar
                          </button>
                        )}

                        {recStatus !== 'rejected' && (
                          <button
                            type="button"
                            className={styles.smallBtn}
                            onClick={() => handleQuickStatusChange(rec, 'rejected')}
                            title="Marcar como Recusado"
                          >
                            <XCircle size={13} /> Recusar
                          </button>
                        )}

                        {!snap.financial_launched && (
                          <button
                            type="button"
                            className={`${styles.smallBtn} ${styles.smallBtnSuccess}`}
                            onClick={() => handleLaunchFinancial(rec)}
                            title="Lançar valor como Receita no Fluxo de Caixa"
                          >
                            <DollarSign size={13} /> Lançar no Financeiro
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.smallBtnDanger}`}
                      onClick={() => handleDeleteBudget(rec.id)}
                      title="Excluir orçamento"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--text-muted))', fontSize: '13.5px' }}>
            Nenhum orçamento registrado para este paciente até o momento.
          </div>
        )}
      </div>
    </div>
  );
}

