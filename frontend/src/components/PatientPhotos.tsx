import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Check,
  Pencil,
  Camera,
  Sparkles,
  Star,
  Plus,
  FolderOpen,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { formatDate } from '../lib/formatters';
import {
  PHOTO_CATEGORIES,
  createPatientCase,
  deletePatientCase,
  deletePatientPhoto,
  listPatientCases,
  listPatientPhotos,
  updatePatientCase,
  updatePatientPhoto,
  uploadPatientPhoto,
  type PatientCase,
  type PatientPhoto,
  type PhotoCategory,
} from '../lib/patientPhotos';
import {
  analyzePhoto,
  listPhotoAnalyses,
  ratePhotoAnalysis,
  revisePhotoAnalysis,
  type PhotoAnalysis,
} from '../lib/photoAnalysis';
import styles from './PatientPhotos.module.css';

interface PatientPhotosProps {
  patient: { id: string; name: string };
  onBack: () => void;
}

const categoryLabel = (c: PhotoCategory) => PHOTO_CATEGORIES.find((x) => x.value === c)?.label ?? c;
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD no fuso local

// Valor de `selectedCase` para o grupo de fotos que não pertencem a nenhum caso.
const NO_CASE = 'sem-caso';
// Capa do caso: a foto "Depois" mais recente; sem ela, a foto mais recente (a lista já vem da mais nova para a mais antiga).
const coverOf = (list: PatientPhoto[]) => list.find((p) => p.category === 'depois') ?? list[0];

// Uma linha por parágrafo; "Rótulo: texto" ganha o rótulo em negrito para a leitura ficar mais confortável.
function renderAnalysisText(text: string) {
  return text
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line, i) => {
      const m = line.match(/^\s*([^:\n]{3,40}):\s*(.*)$/);
      return m ? (
        <p key={i} className={styles.aiLine}>
          <strong>{m[1]}:</strong> {m[2]}
        </p>
      ) : (
        <p key={i} className={styles.aiLine}>
          {line}
        </p>
      );
    });
}

export default function PatientPhotos({ patient, onBack }: PatientPhotosProps) {
  const { isReadOnly, role } = useTenant();
  const [photos, setPhotos] = useState<PatientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<PhotoCategory | 'todas'>('todas');

  // Casos: null = lista de casos; NO_CASE = fotos sem caso; senão o id do caso aberto.
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTooth, setNewTooth] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);
  const [editingCase, setEditingCase] = useState(false);
  const [caseTitleDraft, setCaseTitleDraft] = useState('');
  const [caseToothDraft, setCaseToothDraft] = useState('');
  const [caseNotesDraft, setCaseNotesDraft] = useState('');
  const [savingCase, setSavingCase] = useState(false);

  // Envio
  const [category, setCategory] = useState<PhotoCategory>('radiografia');
  const [caption, setCaption] = useState('');
  const [takenOn, setTakenOn] = useState(today());
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Visualização / edição / comparação
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<PhotoCategory>('outra');
  const [editCaption, setEditCaption] = useState('');
  const [editDate, setEditDate] = useState(today());
  const [editCaseId, setEditCaseId] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  // Análise por IA: só roda quando o dentista clica no botão (cada clique tem custo).
  const canAnalyze = !isReadOnly && ['clinic_owner', 'dentist', 'super_admin'].includes(role || '');
  const [analyses, setAnalyses] = useState<PhotoAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([]);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [revisionDraft, setRevisionDraft] = useState('');
  const [savingRevision, setSavingRevision] = useState(false);
  const showAnalysisPanel = analyzing || analyses.length > 0 || analysisErrors.length > 0;
  const viewerIdRef = useRef<string | null>(null);
  viewerIdRef.current = viewerId;

  useEffect(() => {
    setAnalyses([]);
    setAnalysisErrors([]);
    if (!viewerId) return;
    let cancelled = false;
    listPhotoAnalyses(viewerId)
      .then((list) => {
        if (!cancelled) setAnalyses(list);
      })
      .catch(() => {
        /* sem análises ou tabela indisponível: o painel simplesmente não aparece */
      });
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  const handleAnalyze = async (p: PatientPhoto) => {
    if (
      analyses.length > 0 &&
      !confirm('Esta foto já tem análise. Analisar de novo gera um novo custo de IA. Continuar?')
    ) {
      return;
    }
    setAnalyzing(true);
    setAnalysisErrors([]);
    try {
      const res = await analyzePhoto(p.id);
      const failures = res.errors.map((e) => `${e.label ?? 'IA'}: ${e.error}`);
      const list = await listPhotoAnalyses(p.id);
      if (viewerIdRef.current === p.id) {
        setAnalysisErrors(failures);
        setAnalyses(list);
      }
    } catch (err: any) {
      if (viewerIdRef.current === p.id) setAnalysisErrors([err.message || 'Erro ao analisar a imagem.']);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRate = async (a: PhotoAnalysis, changes: { rating?: number; note?: string }) => {
    try {
      await ratePhotoAnalysis(a.id, changes);
      setAnalyses((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? {
                ...x,
                rating: changes.rating ?? x.rating,
                rating_note: changes.note !== undefined ? changes.note.trim() || null : x.rating_note,
              }
            : x
        )
      );
    } catch (err: any) {
      alert('Erro ao salvar a avaliação: ' + err.message);
    }
  };

  const startRevision = (a: PhotoAnalysis) => {
    setRevisingId(a.id);
    setRevisionDraft(a.revised_summary ?? a.summary);
  };

  // O dentista corrige o texto da IA. O original fica guardado; a diferença entre os dois mede o acerto.
  const saveRevision = async (a: PhotoAnalysis, text: string) => {
    setSavingRevision(true);
    try {
      const { revised } = await revisePhotoAnalysis(a.id, text);
      setAnalyses((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? { ...x, revised_summary: revised ? text.trim() : null, revised_at: revised ? new Date().toISOString() : null }
            : x
        )
      );
      setRevisingId(null);
    } catch (err: any) {
      alert('Erro ao salvar a correção: ' + err.message);
    } finally {
      setSavingRevision(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setError('');
      const [photoList, caseList] = await Promise.all([listPatientPhotos(patient.id), listPatientCases(patient.id)]);
      setPhotos(photoList);
      setCases(caseList);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar as fotos.');
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCase = selectedCase && selectedCase !== NO_CASE ? cases.find((c) => c.id === selectedCase) ?? null : null;
  // Fotos do caso aberto (ou as sem caso). Na lista de casos nenhuma foto está "aberta".
  const casePhotos =
    selectedCase === null
      ? []
      : selectedCase === NO_CASE
        ? photos.filter((p) => !p.case_id)
        : photos.filter((p) => p.case_id === selectedCase);
  const photosOfCase = (id: string) => photos.filter((p) => p.case_id === id);
  const orphanPhotos = photos.filter((p) => !p.case_id);

  const visible = filter === 'todas' ? casePhotos : casePhotos.filter((p) => p.category === filter);
  const viewerIndex = viewerId ? visible.findIndex((p) => p.id === viewerId) : -1;
  const viewerPhoto = viewerIndex >= 0 ? visible[viewerIndex] : null;

  const countOf = (c: PhotoCategory | 'todas') =>
    c === 'todas' ? casePhotos.length : casePhotos.filter((p) => p.category === c).length;

  const resetCaseView = () => {
    setFilter('todas');
    setCompareMode(false);
    setSelected([]);
    setViewerId(null);
    setComparing(false);
    setEditing(false);
    setEditingCase(false);
    setUploadErrors([]);
  };

  const openCase = (id: string) => {
    resetCaseView();
    setSelectedCase(id);
  };

  const closeCase = () => {
    resetCaseView();
    setSelectedCase(null);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creatingCase) return;
    setCreatingCase(true);
    try {
      const created = await createPatientCase(patient.id, { title: newTitle, tooth: newTooth, notes: newNotes });
      setCases((prev) => [created, ...prev]);
      setShowNewCase(false);
      setNewTitle('');
      setNewTooth('');
      setNewNotes('');
      openCase(created.id);
    } catch (err: any) {
      alert('Erro ao criar o caso: ' + err.message);
    } finally {
      setCreatingCase(false);
    }
  };

  const startEditCase = (c: PatientCase) => {
    setCaseTitleDraft(c.title);
    setCaseToothDraft(c.tooth ?? '');
    setCaseNotesDraft(c.notes ?? '');
    setEditingCase(true);
  };

  const saveCase = async (c: PatientCase) => {
    if (!caseTitleDraft.trim() || savingCase) return;
    setSavingCase(true);
    try {
      await updatePatientCase(c.id, { title: caseTitleDraft, tooth: caseToothDraft, notes: caseNotesDraft });
      setEditingCase(false);
      await load();
    } catch (err: any) {
      alert('Erro ao salvar o caso: ' + err.message);
    } finally {
      setSavingCase(false);
    }
  };

  const toggleCaseStatus = async (c: PatientCase) => {
    try {
      await updatePatientCase(c.id, { status: c.status === 'concluido' ? 'em_andamento' : 'concluido' });
      await load();
    } catch (err: any) {
      alert('Erro ao atualizar o caso: ' + err.message);
    }
  };

  const handleDeleteCase = async (c: PatientCase) => {
    if (!confirm(`Excluir o caso "${c.title}"? As fotos dele NÃO serão apagadas: voltam para "Sem caso".`)) return;
    try {
      await deletePatientCase(c.id);
      closeCase();
      await load();
    } catch (err: any) {
      alert('Erro ao excluir o caso: ' + err.message);
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadErrors([]);
    setUploading({ done: 0, total: files.length });
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadPatientPhoto(patient.id, files[i], {
          category,
          caption: caption.trim(),
          takenOn,
          caseId: activeCase?.id ?? null,
        });
      } catch (err: any) {
        errors.push(`${files[i].name}: ${err.message}`);
      }
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
    setUploadErrors(errors);
    if (errors.length < files.length) setCaption('');
    await load();
  };

  const openViewer = (p: PatientPhoto) => {
    if (compareMode) {
      setSelected((prev) =>
        prev.includes(p.id) ? prev.filter((id) => id !== p.id) : prev.length >= 2 ? [prev[1], p.id] : [...prev, p.id]
      );
      return;
    }
    setEditing(false);
    setViewerId(p.id);
  };

  const step = (dir: 1 | -1) => {
    if (visible.length === 0 || viewerIndex < 0) return;
    setEditing(false);
    setViewerId(visible[(viewerIndex + dir + visible.length) % visible.length].id);
  };

  // Navegação por teclado no visualizador
  useEffect(() => {
    if (!viewerPhoto && !comparing) return;
    const onKey = (e: KeyboardEvent) => {
      // Digitando (descrição, observação do dentista): as setas movem o cursor, não trocam de foto.
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        setViewerId(null);
        setComparing(false);
      } else if (viewerPhoto && !editing && !typing && e.key === 'ArrowLeft') step(-1);
      else if (viewerPhoto && !editing && !typing && e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startEdit = (p: PatientPhoto) => {
    setEditCategory(p.category);
    setEditCaption(p.caption || '');
    setEditDate(p.taken_on);
    setEditCaseId(p.case_id ?? '');
    setEditing(true);
  };

  const saveEdit = async (p: PatientPhoto) => {
    try {
      await updatePatientPhoto(p.id, {
        category: editCategory,
        caption: editCaption.trim(),
        taken_on: editDate,
        // Só manda o caso se mudou: mover a foto a tira da tela deste caso.
        ...(editCaseId !== (p.case_id ?? '') ? { case_id: editCaseId || null } : {}),
      });
      setEditing(false);
      await load();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDelete = async (p: PatientPhoto) => {
    if (deletingId) return;
    if (
      !confirm(
        'Excluir esta foto definitivamente? As análises de IA dela também serão apagadas. Esta ação é irreversível.'
      )
    ) {
      return;
    }
    setDeletingId(p.id);
    try {
      const nextIndex = Math.min(viewerIndex, visible.length - 2);
      await deletePatientPhoto(p.id);
      setSelected((prev) => prev.filter((id) => id !== p.id));
      setViewerId(nextIndex >= 0 ? visible.filter((x) => x.id !== p.id)[nextIndex]?.id ?? null : null);
      await load();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleCompare = () => {
    if (compareMode) {
      setCompareMode(false);
      setSelected([]);
      return;
    }
    // Já deixa marcados o "Antes" e o "Depois" mais recentes do caso (a lista vem da mais nova para a mais
    // antiga): na maioria das vezes basta clicar em "Ver lado a lado". Dá para trocar clicando em outras fotos.
    const before = casePhotos.find((p) => p.category === 'antes');
    const after = casePhotos.find((p) => p.category === 'depois');
    setSelected(before && after ? [before.id, after.id] : []);
    setCompareMode(true);
  };

  const selectedPhotos = selected.map((id) => casePhotos.find((p) => p.id === id)).filter(Boolean) as PatientPhoto[];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={selectedCase === null ? onBack : closeCase}>
          <ArrowLeft size={16} /> {selectedCase === null ? 'Voltar para Pacientes' : 'Voltar aos casos'}
        </button>
        <div>
          <h1 className={styles.title}>
            {selectedCase === null ? 'Fotos e Radiografias' : activeCase ? activeCase.title : 'Sem caso'}
          </h1>
          <p className={styles.subtitle}>
            {patient.name}
            {activeCase?.tooth ? ` · ${activeCase.tooth}` : ''}
          </p>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {selectedCase === null ? (
        /* ------------------------- Lista de casos ------------------------- */
        <>
          {!isReadOnly && (
            <div className={styles.casesBar}>
              <button type="button" className={styles.uploadBtn} onClick={() => setShowNewCase((v) => !v)}>
                <Plus size={16} /> Novo caso
              </button>
            </div>
          )}

          {showNewCase && !isReadOnly && (
            <form className={styles.uploadCard} onSubmit={handleCreateCase}>
              <div className={styles.uploadFields}>
                <div className={`${styles.field} ${styles.fieldGrow}`}>
                  <label>Título do caso</label>
                  <input
                    type="text"
                    className={styles.input}
                    maxLength={120}
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Implantes 11 e 21, Canal dente 36, Clareamento..."
                  />
                </div>
                <div className={styles.field}>
                  <label>Dente / região (opcional)</label>
                  <input
                    type="text"
                    className={styles.input}
                    maxLength={60}
                    value={newTooth}
                    onChange={(e) => setNewTooth(e.target.value)}
                    placeholder="Ex: 36, 11 e 21"
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldGrow}`}>
                  <label>Observação (opcional)</label>
                  <input
                    type="text"
                    className={styles.input}
                    maxLength={2000}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                  />
                </div>
                <button type="submit" className={styles.uploadBtn} disabled={!newTitle.trim() || creatingCase}>
                  {creatingCase ? 'Criando...' : 'Criar caso'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={() => setShowNewCase(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className={styles.empty}>Carregando casos...</div>
          ) : cases.length === 0 && orphanPhotos.length === 0 ? (
            <div className={styles.empty}>
              Nenhum caso cadastrado para este paciente ainda.
              {!isReadOnly && ' Clique em "Novo caso" para começar a organizar as fotos e radiografias por tratamento.'}
            </div>
          ) : (
            <div className={styles.caseGrid}>
              {cases.map((c) => {
                const list = photosOfCase(c.id);
                const cover = coverOf(list);
                return (
                  <button key={c.id} type="button" className={styles.caseCard} onClick={() => openCase(c.id)}>
                    <span className={styles.caseCover}>
                      {cover ? (
                        <img src={cover.urls.media} alt={c.title} loading="lazy" />
                      ) : (
                        <span className={styles.caseCoverEmpty}>
                          <FolderOpen size={32} />
                          Sem fotos ainda
                        </span>
                      )}
                      <span
                        className={`${styles.badge} ${c.status === 'concluido' ? styles.badge_depois : styles.badge_antes}`}
                      >
                        {c.status === 'concluido' ? 'Concluído' : 'Em andamento'}
                      </span>
                    </span>
                    <span className={styles.caseInfo}>
                      <strong>{c.title}</strong>
                      {c.tooth && <em>{c.tooth}</em>}
                      <span className={styles.caseMeta}>
                        {formatDate(c.opened_on)}
                        {c.closed_on ? ` → ${formatDate(c.closed_on)}` : ''} · {list.length}{' '}
                        {list.length === 1 ? 'foto' : 'fotos'}
                      </span>
                    </span>
                  </button>
                );
              })}
              {orphanPhotos.length > 0 && (
                <button type="button" className={styles.caseCard} onClick={() => openCase(NO_CASE)}>
                  <span className={styles.caseCover}>
                    <img src={coverOf(orphanPhotos).urls.media} alt="Sem caso" loading="lazy" />
                    <span className={`${styles.badge} ${styles.badge_outra}`}>Avulsas</span>
                  </span>
                  <span className={styles.caseInfo}>
                    <strong>Sem caso</strong>
                    <em>Fotos ainda não organizadas</em>
                    <span className={styles.caseMeta}>
                      {orphanPhotos.length} {orphanPhotos.length === 1 ? 'foto' : 'fotos'}
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
      {activeCase && (
        <div className={styles.caseHeader}>
          {editingCase ? (
            <div className={styles.editRow}>
              <input
                type="text"
                className={`${styles.input} ${styles.fieldGrow}`}
                maxLength={120}
                value={caseTitleDraft}
                onChange={(e) => setCaseTitleDraft(e.target.value)}
                placeholder="Título do caso"
              />
              <input
                type="text"
                className={styles.input}
                maxLength={60}
                value={caseToothDraft}
                onChange={(e) => setCaseToothDraft(e.target.value)}
                placeholder="Dente / região"
              />
              <input
                type="text"
                className={`${styles.input} ${styles.fieldGrow}`}
                maxLength={2000}
                value={caseNotesDraft}
                onChange={(e) => setCaseNotesDraft(e.target.value)}
                placeholder="Observação"
              />
              <button
                className={styles.uploadBtn}
                disabled={!caseTitleDraft.trim() || savingCase}
                onClick={() => saveCase(activeCase)}
              >
                {savingCase ? 'Salvando...' : 'Salvar'}
              </button>
              <button className={styles.ghostBtn} onClick={() => setEditingCase(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <div className={styles.caseHeaderInfo}>
                <span
                  className={`${styles.badgeInline} ${activeCase.status === 'concluido' ? styles.badge_depois : styles.badge_antes}`}
                >
                  {activeCase.status === 'concluido' ? 'Concluído' : 'Em andamento'}
                </span>
                <span>
                  Aberto em {formatDate(activeCase.opened_on)}
                  {activeCase.closed_on ? ` · concluído em ${formatDate(activeCase.closed_on)}` : ''}
                </span>
                {activeCase.notes && <span className={styles.caseNotes}>{activeCase.notes}</span>}
              </div>
              {!isReadOnly && (
                <div className={styles.lightboxActions}>
                  <button className={styles.ghostBtn} onClick={() => toggleCaseStatus(activeCase)}>
                    {activeCase.status === 'concluido' ? (
                      <>
                        <RotateCcw size={14} /> Reabrir caso
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} /> Concluir caso
                      </>
                    )}
                  </button>
                  <button className={styles.ghostBtn} onClick={() => startEditCase(activeCase)}>
                    <Pencil size={14} /> Editar caso
                  </button>
                  <button className={`${styles.ghostBtn} ${styles.danger}`} onClick={() => handleDeleteCase(activeCase)}>
                    <Trash2 size={14} /> Excluir caso
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isReadOnly && (
        <div className={styles.uploadCard}>
          <div className={styles.uploadFields}>
            <div className={styles.field}>
              <label>Tipo</label>
              <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value as PhotoCategory)}>
                {PHOTO_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Data</label>
              <input type="date" className={styles.input} value={takenOn} max={today()} onChange={(e) => setTakenOn(e.target.value)} />
            </div>
            <div className={`${styles.field} ${styles.fieldGrow}`}>
              <label>Descrição (opcional)</label>
              <input
                type="text"
                className={styles.input}
                maxLength={200}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ex: Panorâmica inicial, dente 36, após clareamento..."
              />
            </div>
            <button
              type="button"
              className={styles.uploadBtn}
              disabled={!!uploading || !takenOn}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? <Camera size={16} /> : <Upload size={16} />}
              {uploading ? `Enviando ${uploading.done}/${uploading.total}...` : 'Adicionar fotos'}
            </button>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
          </div>
          {uploadErrors.length > 0 && (
            <ul className={styles.errorList}>
              {uploadErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {(['todas', ...PHOTO_CATEGORIES.map((c) => c.value)] as const).map((c) => (
            <button
              key={c}
              className={`${styles.tab} ${filter === c ? styles.tabActive : ''}`}
              onClick={() => setFilter(c)}
            >
              {c === 'todas' ? 'Todas' : categoryLabel(c)} <span className={styles.tabCount}>{countOf(c)}</span>
            </button>
          ))}
        </div>
        {casePhotos.length >= 2 && (
          <div className={styles.compareControls}>
            {compareMode && (
              <button className={styles.compareGo} disabled={selected.length !== 2} onClick={() => setComparing(true)}>
                Ver lado a lado ({selected.length}/2)
              </button>
            )}
            <button className={`${styles.tab} ${compareMode ? styles.tabActive : ''}`} onClick={toggleCompare}>
              <Columns2 size={14} /> {compareMode ? 'Cancelar comparação' : 'Comparar antes e depois'}
            </button>
          </div>
        )}
      </div>

      {compareMode && (
        <p className={styles.compareHint}>
          {selected.length === 2
            ? 'Pronto! Clique em "Ver lado a lado". Para trocar, clique em outra foto.'
            : selected.length === 1
              ? 'Escolha mais uma foto para comparar.'
              : 'Clique em duas fotos para compará-las lado a lado.'}
        </p>
      )}

      {loading ? (
        <div className={styles.empty}>Carregando fotos...</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          {casePhotos.length === 0
            ? selectedCase === NO_CASE
              ? 'Nenhuma foto sem caso.'
              : 'Nenhuma foto neste caso ainda. Use "Adicionar fotos" acima.'
            : 'Nenhuma foto nesta categoria.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((p) => {
            const order = selected.indexOf(p.id);
            return (
              <div key={p.id} className={styles.thumbWrap}>
              <button
                className={`${styles.thumb} ${order >= 0 ? styles.thumbSelected : ''}`}
                onClick={() => openViewer(p)}
                title={p.caption || categoryLabel(p.category)}
              >
                <img src={p.urls.mini} alt={p.caption || categoryLabel(p.category)} loading="lazy" />
                <span className={`${styles.badge} ${styles[`badge_${p.category}`]}`}>{categoryLabel(p.category)}</span>
                {order >= 0 && (
                  <span className={styles.selectMark}>
                    <Check size={12} /> {order + 1}
                  </span>
                )}
                <span className={styles.thumbInfo}>
                  <strong>{formatDate(p.taken_on)}</strong>
                  {p.caption && <em>{p.caption}</em>}
                </span>
              </button>
              {!isReadOnly && !compareMode && (
                <button
                  type="button"
                  className={styles.thumbDelete}
                  title="Excluir foto"
                  aria-label="Excluir foto"
                  disabled={deletingId === p.id}
                  onClick={() => handleDelete(p)}
                >
                  <Trash2 size={14} />
                </button>
              )}
              </div>
            );
          })}
        </div>
      )}

      {/* Visualizador */}
      {viewerPhoto && (
        <div className={styles.lightbox} onClick={() => setViewerId(null)}>
          <div
            className={`${styles.lightboxBody} ${showAnalysisPanel ? styles.lightboxBodySplit : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles.lightboxClose} onClick={() => setViewerId(null)} aria-label="Fechar">
              <X size={20} />
            </button>
            <div className={styles.viewerMain}>
            {visible.length > 1 && (
              <>
                <button className={`${styles.nav} ${styles.navPrev}`} onClick={() => step(-1)} aria-label="Anterior">
                  <ChevronLeft size={28} />
                </button>
                <button className={`${styles.nav} ${styles.navNext}`} onClick={() => step(1)} aria-label="Próxima">
                  <ChevronRight size={28} />
                </button>
              </>
            )}
            <img className={styles.lightboxImg} src={viewerPhoto.urls.grande} alt={viewerPhoto.caption || categoryLabel(viewerPhoto.category)} />
            <div className={styles.lightboxBar}>
              {editing ? (
                <div className={styles.editRow}>
                  <select className={styles.input} value={editCategory} onChange={(e) => setEditCategory(e.target.value as PhotoCategory)}>
                    {PHOTO_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select className={styles.input} value={editCaseId} onChange={(e) => setEditCaseId(e.target.value)} title="Caso">
                    <option value="">Sem caso</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <input type="date" className={styles.input} value={editDate} max={today()} onChange={(e) => setEditDate(e.target.value)} />
                  <input
                    type="text"
                    className={`${styles.input} ${styles.fieldGrow}`}
                    maxLength={200}
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Descrição"
                  />
                  <button className={styles.uploadBtn} onClick={() => saveEdit(viewerPhoto)}>
                    Salvar
                  </button>
                  <button className={styles.ghostBtn} onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.lightboxMeta}>
                    <span className={`${styles.badgeInline} ${styles[`badge_${viewerPhoto.category}`]}`}>
                      {categoryLabel(viewerPhoto.category)}
                    </span>
                    <strong>{formatDate(viewerPhoto.taken_on)}</strong>
                    {viewerPhoto.caption && <span>{viewerPhoto.caption}</span>}
                  </div>
                  {!isReadOnly && (
                    <div className={styles.lightboxActions}>
                      {canAnalyze && (
                        <button
                          className={`${styles.ghostBtn} ${styles.aiBtn}`}
                          onClick={() => handleAnalyze(viewerPhoto)}
                          disabled={analyzing}
                        >
                          <Sparkles size={14} />{' '}
                          {analyzing ? 'Analisando...' : analyses.length > 0 ? 'Analisar novamente' : 'Analisar foto/radiografia'}
                        </button>
                      )}
                      <button className={styles.ghostBtn} onClick={() => startEdit(viewerPhoto)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        className={`${styles.ghostBtn} ${styles.danger}`}
                        disabled={deletingId === viewerPhoto.id}
                        onClick={() => handleDelete(viewerPhoto)}
                      >
                        <Trash2 size={14} /> {deletingId === viewerPhoto.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            </div>
            {showAnalysisPanel && (
              <div className={styles.analysisPanel}>
                <h3 className={styles.analysisTitle}>
                  <Sparkles size={16} /> Análise por IA
                </h3>
                <p className={styles.aiDisclaimer}>
                  Descrição gerada por IA como apoio à avaliação. Não é laudo nem diagnóstico: confirme sempre com a
                  avaliação clínica do dentista.
                </p>
                {analyzing && <p className={styles.aiLoading}>Analisando a imagem... pode levar até 1 minuto.</p>}
                {analysisErrors.map((m) => (
                  <p key={m} className={styles.aiError}>
                    {m}
                  </p>
                ))}
                {analyses.map((a) => (
                  <div key={a.id} className={styles.analysisItem}>
                    <div className={styles.analysisHead}>
                      {a.label && <span className={styles.aiLabel}>{a.label}</span>}
                      <span className={styles.aiDate}>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                      {canAnalyze && (
                        <span className={styles.stars} role="group" aria-label="Nota do dentista">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`${styles.starBtn} ${a.rating && n <= a.rating ? styles.starOn : ''}`}
                              onClick={() => handleRate(a, { rating: n })}
                              aria-label={`Nota ${n}`}
                            >
                              <Star size={16} />
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                    {revisingId === a.id ? (
                      <div className={styles.reviseArea}>
                        <textarea
                          className={styles.reviseText}
                          value={revisionDraft}
                          maxLength={4000}
                          rows={14}
                          onChange={(e) => setRevisionDraft(e.target.value)}
                        />
                        <div className={styles.reviseActions}>
                          <button
                            type="button"
                            className={styles.uploadBtn}
                            disabled={savingRevision}
                            onClick={() => saveRevision(a, revisionDraft)}
                          >
                            {savingRevision ? 'Salvando...' : 'Salvar correção'}
                          </button>
                          <button type="button" className={styles.ghostBtn} onClick={() => setRevisingId(null)}>
                            Cancelar
                          </button>
                          {a.revised_summary && (
                            <button
                              type="button"
                              className={`${styles.ghostBtn} ${styles.danger}`}
                              disabled={savingRevision}
                              onClick={() => saveRevision(a, '')}
                            >
                              Desfazer correção
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {a.revised_summary && <span className={styles.revisedBadge}>Revisado pelo dentista</span>}
                        <div className={styles.aiText}>{renderAnalysisText(a.revised_summary ?? a.summary)}</div>
                        {a.revised_summary && (
                          <details className={styles.originalDetails}>
                            <summary>Ver texto original da IA</summary>
                            <div className={styles.aiText}>{renderAnalysisText(a.summary)}</div>
                          </details>
                        )}
                        {canAnalyze && (
                          <button type="button" className={styles.reviseBtn} onClick={() => startRevision(a)}>
                            <Pencil size={12} /> {a.revised_summary ? 'Editar correção' : 'Corrigir texto'}
                          </button>
                        )}
                      </>
                    )}
                    {canAnalyze && (
                      <input
                        type="text"
                        className={styles.noteInput}
                        defaultValue={a.rating_note ?? ''}
                        maxLength={300}
                        placeholder="Observação do dentista (ex.: não percebeu a lesão no dente 36)"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (a.rating_note ?? '')) handleRate(a, { note: e.target.value });
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparação lado a lado */}
      {comparing && selectedPhotos.length === 2 && (
        <div className={styles.lightbox} onClick={() => setComparing(false)}>
          <div className={`${styles.lightboxBody} ${styles.compareBody}`} onClick={(e) => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={() => setComparing(false)} aria-label="Fechar">
              <X size={20} />
            </button>
            <div className={styles.compareGrid}>
              {[...selectedPhotos]
                .sort((a, b) => a.taken_on.localeCompare(b.taken_on))
                .map((p) => (
                  <figure key={p.id} className={styles.compareItem}>
                    <img src={p.urls.grande} alt={p.caption || categoryLabel(p.category)} />
                    <figcaption>
                      <span className={`${styles.badgeInline} ${styles[`badge_${p.category}`]}`}>{categoryLabel(p.category)}</span>
                      <strong>{formatDate(p.taken_on)}</strong>
                      {p.caption && <span>{p.caption}</span>}
                    </figcaption>
                  </figure>
                ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
