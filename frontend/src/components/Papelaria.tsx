import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  ALL_TEMPLATES, TEMPLATES_BY_CATEGORY, CATEGORY_LABELS,
  type DocumentTemplate, type DocumentField, suggestTcleByProcedure
} from '../lib/documentTemplates';
import styles from './Papelaria.module.css';
import {
  FileText, Search, Printer, ChevronDown, ChevronUp,
  Clock, User, X, ArrowLeft, Check
} from 'lucide-react';

interface Patient {
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

interface Profile {
  id: string;
  name: string;
  cro?: string;
  role: string;
}

interface GeneratedDoc {
  id: string;
  type: string;
  title: string;
  created_at: string;
}

interface PapeleriaProps {
  selectedUnit?: { id: string; name: string; address?: string; phone?: string };
}

type Step = 'select_template' | 'fill_fields' | 'preview';

// Clinic config fallback (overridden by tenant settings when available)
const CLINIC_DEFAULTS = {
  dentist_name: 'Dra. Talissa Iurko',
  cro: '3906 - TO',
  address: 'Avenida Goiás - Centro - Gurupi - Tocantins',
  phone: '(63)98452-3437',
  city: 'Gurupi',
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) {
    const now = new Date();
    return `${now.getDate()} de ${now.toLocaleString('pt-BR', { month: 'long' })} de ${now.getFullYear()}`;
  }
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} de ${d.toLocaleString('pt-BR', { month: 'long' })} de ${d.getFullYear()}`;
};

export default function Papelaria({ selectedUnit }: PapeleriaProps) {
  const [step, setStep] = useState<Step>('select_template');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Patient
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

  // Dentist
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // History
  const [docHistory, setDocHistory] = useState<GeneratedDoc[]>([]);

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  // ── Load current profile ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, name, cro, role')
        .eq('id', user.id)
        .single();
      if (data) setCurrentProfile(data);
    });
  }, []);

  // ── Patient search ───────────────────────────────────────────
  useEffect(() => {
    if (patientSearch.length < 2) { setPatients([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, responsible_name, weight_kg')
        .ilike('name', `%${patientSearch}%`)
        .limit(10);
      setPatients(data || []);
      setPatientDropdownOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // ── Load doc history for selected patient ────────────────────
  useEffect(() => {
    if (!selectedPatient) { setDocHistory([]); return; }
    supabase
      .from('generated_documents')
      .select('id, type, title, created_at')
      .eq('patient_id', selectedPatient.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setDocHistory(data || []));
  }, [selectedPatient]);

  // ── Filtered templates ───────────────────────────────────────
  const filteredTemplates = ALL_TEMPLATES.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    return matchSearch && matchCat;
  });

  // ── Select template ──────────────────────────────────────────
  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    // Pre-populate fields from patient data
    const prefill: Record<string, any> = {};
    if (selectedPatient) {
      prefill.responsible_name = selectedPatient.responsible_name || '';
      prefill.weight_kg = selectedPatient.weight_kg || '';
      prefill.patient_rg = selectedPatient.rg || '';
      prefill.patient_address = selectedPatient.address || '';
      prefill.patient_city = selectedPatient.city || CLINIC_DEFAULTS.city;
      prefill.patient_cep = selectedPatient.zip_code || '';
    }
    setFieldValues(prefill);
    setStep('fill_fields');
  };

  // ── Resolve document HTML ────────────────────────────────────
  const resolveHtml = useCallback(() => {
    if (!selectedTemplate) return '';
    const dentistName = currentProfile?.name || CLINIC_DEFAULTS.dentist_name;
    const cro = currentProfile?.cro || CLINIC_DEFAULTS.cro;
    const address = selectedUnit?.address || CLINIC_DEFAULTS.address;
    const phone = selectedUnit?.phone || CLINIC_DEFAULTS.phone;

    let html = selectedTemplate.bodyTemplate(fieldValues);

    // Replace placeholders
    html = html
      .replace(/{{DENTIST_NAME}}/g, dentistName)
      .replace(/{{CRO}}/g, cro)
      .replace(/{{PATIENT_NAME}}/g, selectedPatient?.name || '___________________________')
      .replace(/{{PATIENT_CPF}}/g, selectedPatient?.cpf || '_______________')
      .replace(/{{CLINIC_ADDRESS}}/g, address)
      .replace(/{{CLINIC_PHONE}}/g, phone);

    return html;
  }, [selectedTemplate, fieldValues, selectedPatient, currentProfile, selectedUnit]);

  // ── Save to history ──────────────────────────────────────────
  const saveToHistory = async () => {
    if (!selectedTemplate || !selectedPatient) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, unit_id')
      .eq('id', user.id)
      .single();
    if (!profile) return;

    await supabase.from('generated_documents').insert({
      tenant_id: profile.tenant_id,
      patient_id: selectedPatient.id,
      professional_id: user.id,
      unit_id: selectedUnit?.id || profile.unit_id,
      type: selectedTemplate.id,
      title: selectedTemplate.name,
      content_snapshot: { fields: fieldValues, patientName: selectedPatient.name },
    });

    // Refresh history
    const { data } = await supabase
      .from('generated_documents')
      .select('id, type, title, created_at')
      .eq('patient_id', selectedPatient.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setDocHistory(data || []);
  };

  // ── Print ────────────────────────────────────────────────────
  const handlePrint = async () => {
    await saveToHistory();
    window.print();
  };

  // ── Reset ────────────────────────────────────────────────────
  const handleReset = () => {
    setStep('select_template');
    setSelectedTemplate(null);
    setFieldValues({});
  };

  const dentistName = currentProfile?.name || CLINIC_DEFAULTS.dentist_name;
  const cro = currentProfile?.cro || CLINIC_DEFAULTS.cro;
  const address = selectedUnit?.address || CLINIC_DEFAULTS.address;
  const phone = selectedUnit?.phone || CLINIC_DEFAULTS.phone;

  // ═══════════════════════════════════════════════════════════
  // RENDER — Step: Select Template
  // ═══════════════════════════════════════════════════════════
  const renderSelectTemplate = () => (
    <div className={styles.selectStep}>
      {/* Patient selector */}
      <div className={styles.patientBar}>
        <div className={styles.patientSearchWrapper}>
          <User size={16} />
          <input
            className={styles.patientSearchInput}
            placeholder="Buscar paciente para vincular ao documento..."
            value={patientSearch}
            onChange={e => { setPatientSearch(e.target.value); setPatientDropdownOpen(true); }}
            onFocus={() => patients.length > 0 && setPatientDropdownOpen(true)}
          />
          {selectedPatient && (
            <button className={styles.clearPatient} onClick={() => {
              setSelectedPatient(null); setPatientSearch(''); setPatients([]);
            }}><X size={14} /></button>
          )}
          {patientDropdownOpen && patients.length > 0 && (
            <div className={styles.patientDropdown}>
              {patients.map(p => (
                <div key={p.id} className={styles.patientOption} onClick={() => {
                  setSelectedPatient(p);
                  setPatientSearch(p.name);
                  setPatientDropdownOpen(false);
                }}>
                  <span className={styles.patientOptName}>{p.name}</span>
                  {p.cpf && <span className={styles.patientOptCpf}>CPF: {p.cpf}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedPatient && (
          <div className={styles.selectedPatientBadge}>
            <User size={13} />
            <span>{selectedPatient.name}</span>
          </div>
        )}
      </div>

      {/* Search & Category Tabs */}
      <div className={styles.templateControls}>
        <div className={styles.templateSearch}>
          <Search size={15} />
          <input
            placeholder="Buscar documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.categoryTabs}>
          <button
            className={`${styles.catTab} ${activeCategory === 'all' ? styles.catTabActive : ''}`}
            onClick={() => setActiveCategory('all')}
          >Todos ({ALL_TEMPLATES.length})</button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`${styles.catTab} ${activeCategory === key ? styles.catTabActive : ''}`}
              onClick={() => setActiveCategory(key)}
            >
              {label.split(' ').slice(1).join(' ')} ({TEMPLATES_BY_CATEGORY[key as keyof typeof TEMPLATES_BY_CATEGORY]?.length})
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className={styles.templateGrid}>
        {activeCategory === 'all'
          ? Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
              const cats = filteredTemplates.filter(t => t.category === catKey);
              if (cats.length === 0) return null;
              return (
                <div key={catKey} className={styles.categorySection}>
                  <h3 className={styles.catSectionTitle}>{catLabel}</h3>
                  <div className={styles.cardRow}>
                    {cats.map(t => (
                      <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
                    ))}
                  </div>
                </div>
              );
            })
          : (
            <div className={styles.cardRow}>
              {filteredTemplates.map(t => (
                <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
              ))}
            </div>
          )
        }
      </div>

      {/* History */}
      {selectedPatient && docHistory.length > 0 && (
        <div className={styles.historyPanel}>
          <h4 className={styles.historyTitle}><Clock size={14} /> Histórico de Documentos — {selectedPatient.name}</h4>
          <div className={styles.historyList}>
            {docHistory.map(doc => (
              <div key={doc.id} className={styles.historyItem}>
                <FileText size={13} />
                <span className={styles.historyDocName}>{doc.title}</span>
                <span className={styles.historyDate}>
                  {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER — Step: Fill Fields
  // ═══════════════════════════════════════════════════════════
  const renderFillFields = () => {
    if (!selectedTemplate) return null;
    return (
      <div className={styles.fillStep}>
        <button className={styles.backBtn} onClick={() => setStep('select_template')}>
          <ArrowLeft size={16} /> Escolher outro documento
        </button>
        <div className={styles.fillLayout}>
          <div className={styles.fillFormPanel}>
            <h2 className={styles.fillTitle}>{selectedTemplate.name}</h2>
            <p className={styles.fillDesc}>{selectedTemplate.description}</p>

            {selectedTemplate.fields.length === 0 ? (
              <div className={styles.noFieldsMsg}>
                <Check size={20} color="#4CAF50" />
                <p>Este documento não requer campos adicionais. Clique em "Pré-visualizar" para revisar.</p>
              </div>
            ) : (
              <div className={styles.formFields}>
                {selectedTemplate.fields.map(field => (
                  <div key={field.id} className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {field.label}
                      {field.required && <span className={styles.required}>*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className={styles.formTextarea}
                        rows={field.rows || 4}
                        placeholder={field.placeholder}
                        value={fieldValues[field.id] || ''}
                        onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className={styles.formSelect}
                        value={fieldValues[field.id] || ''}
                        onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        className={styles.formInput}
                        placeholder={field.placeholder}
                        value={fieldValues[field.id] || ''}
                        onChange={e => setFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className={styles.fillActions}>
              <button
                className={styles.previewBtn}
                onClick={() => setStep('preview')}
              >
                Pré-visualizar documento →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER — Step: Preview
  // ═══════════════════════════════════════════════════════════
  const renderPreview = () => {
    if (!selectedTemplate) return null;
    const docHtml = resolveHtml();

    return (
      <div className={styles.previewStep}>
        <div className={styles.previewToolbar}>
          <button className={styles.backBtn} onClick={() => setStep('fill_fields')}>
            <ArrowLeft size={16} /> Editar campos
          </button>
          <div className={styles.previewActions}>
            {selectedPatient ? (
              <span className={styles.patientBadgeSmall}><User size={13}/> {selectedPatient.name}</span>
            ) : (
              <span className={styles.noPatientWarn}>⚠ Nenhum paciente selecionado</span>
            )}
            <button className={styles.printBtn} onClick={handlePrint}>
              <Printer size={16} /> Imprimir / Salvar PDF
            </button>
            <button className={styles.newDocBtn} onClick={handleReset}>
              <FileText size={16} /> Novo Documento
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className={styles.printArea} ref={printRef} id="papelaria-print-area">
          <div className={styles.a4Page}>
            {/* Header */}
            <div className={styles.docHeader}>
              <div className={styles.docHeaderInfo}>
                <div className={styles.docClinicName}>{dentistName}</div>
                <div className={styles.docClinicDetail}>CRO: {cro}</div>
                <div className={styles.docClinicDetail}>{address}</div>
                <div className={styles.docClinicDetail}>{phone}</div>
              </div>
              {selectedPatient && (
                <div className={styles.docPatientInfo}>
                  <div className={styles.docPatientRow}><strong>Paciente:</strong> {selectedPatient.name}</div>
                  {selectedPatient.cpf && <div className={styles.docPatientRow}><strong>CPF:</strong> {selectedPatient.cpf}</div>}
                  {selectedPatient.birth_date && (
                    <div className={styles.docPatientRow}>
                      <strong>Nasc.:</strong> {new Date(selectedPatient.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.docDivider} />

            {/* Title */}
            <h1 className={styles.docTitle}>{selectedTemplate.name.replace('TCLE — ', 'Termo de Consentimento Livre e Esclarecido — ')}</h1>

            {/* Body */}
            <div
              className={styles.docBody}
              dangerouslySetInnerHTML={{ __html: docHtml }}
            />

            {/* Footer Signature */}
            <div className={styles.docFooter}>
              <div className={styles.footerDate}>
                {CLINIC_DEFAULTS.city}, {formatDate()}.
              </div>
              <div className={styles.footerSignatures}>
                <div className={styles.sigBlock}>
                  <div className={styles.sigLine} />
                  <div className={styles.sigLabel}>
                    {selectedPatient?.name || 'Assinatura do Paciente'}{selectedPatient?.responsible_name ? ` / ${selectedPatient.responsible_name} (Responsável)` : ''}
                  </div>
                </div>
                <div className={styles.sigBlock}>
                  <div className={styles.sigLine} />
                  <div className={styles.sigLabel}>{dentistName} — CRO: {cro}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <FileText size={22} />
          <h1>Papelaria</h1>
        </div>
        <p className={styles.headerSubtitle}>
          Gere, imprima e arquive documentos odontológicos profissionais
        </p>
        {step !== 'select_template' && (
          <div className={styles.stepIndicator}>
            <span className={step === 'fill_fields' || step === 'preview' ? styles.stepActive : ''}>1. Escolher</span>
            <span className={styles.stepArrow}>›</span>
            <span className={step === 'fill_fields' ? styles.stepActive : step === 'preview' ? styles.stepDone : ''}>2. Preencher</span>
            <span className={styles.stepArrow}>›</span>
            <span className={step === 'preview' ? styles.stepActive : ''}>3. Visualizar</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {step === 'select_template' && renderSelectTemplate()}
        {step === 'fill_fields' && renderFillFields()}
        {step === 'preview' && renderPreview()}
      </div>
    </div>
  );
}

// ── Template Card Component ──────────────────────────────────
function TemplateCard({ template, onSelect }: { template: DocumentTemplate; onSelect: (t: DocumentTemplate) => void }) {
  const iconMap: Record<string, string> = {
    Pill: '💊', ClipboardList: '📋', ClipboardEdit: '📝', Receipt: '🧾',
    FileText: '📄', ShieldCheck: '🛡️', Sparkles: '✨', Zap: '⚡',
    Scissors: '✂️', Baby: '👶', ArrowUp: '↑', Smile: '😁',
    Star: '⭐', FileSignature: '📝', XCircle: '🚫', CheckCircle: '✅',
    FolderOpen: '📂', Camera: '📷', FileSearch: '🔍', Send: '📩',
    AlertTriangle: '⚠️', Microscope: '🔬', AlertCircle: '⚠️',
    Info: '💡', Moon: '🌙',
  };

  return (
    <button className={styles.templateCard} onClick={() => onSelect(template)}>
      <span className={styles.cardIcon}>{iconMap[template.icon] || '📄'}</span>
      <span className={styles.cardName}>{template.name.replace('TCLE — ', '')}</span>
      <span className={styles.cardDesc}>{template.description}</span>
    </button>
  );
}
