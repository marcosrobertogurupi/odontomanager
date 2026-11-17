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
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { formatDate } from '../lib/formatters';
import {
  PHOTO_CATEGORIES,
  deletePatientPhoto,
  listPatientPhotos,
  updatePatientPhoto,
  uploadPatientPhoto,
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

export default function PatientPhotos({ patient, onBack }: PatientPhotosProps) {
  const { isReadOnly, role } = useTenant();
  const [photos, setPhotos] = useState<PatientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<PhotoCategory | 'todas'>('todas');

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
      setPhotos(await listPatientPhotos(patient.id));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar as fotos.');
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = filter === 'todas' ? photos : photos.filter((p) => p.category === filter);
  const viewerIndex = viewerId ? visible.findIndex((p) => p.id === viewerId) : -1;
  const viewerPhoto = viewerIndex >= 0 ? visible[viewerIndex] : null;

  const countOf = (c: PhotoCategory | 'todas') =>
    c === 'todas' ? photos.length : photos.filter((p) => p.category === c).length;

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadErrors([]);
    setUploading({ done: 0, total: files.length });
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadPatientPhoto(patient.id, files[i], { category, caption: caption.trim(), takenOn });
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
    setEditing(true);
  };

  const saveEdit = async (p: PatientPhoto) => {
    try {
      await updatePatientPhoto(p.id, { category: editCategory, caption: editCaption.trim(), taken_on: editDate });
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
    setCompareMode((v) => !v);
    setSelected([]);
  };

  const selectedPhotos = selected.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as PatientPhoto[];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} /> Voltar para Pacientes
        </button>
        <div>
          <h1 className={styles.title}>Fotos e Radiografias</h1>
          <p className={styles.subtitle}>{patient.name}</p>
        </div>
      </div>

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
        {photos.length >= 2 && (
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

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <div className={styles.empty}>Carregando fotos...</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          {photos.length === 0
            ? 'Nenhuma foto cadastrada para este paciente ainda.'
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
          <div className={styles.lightboxBody} onClick={(e) => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={() => setViewerId(null)} aria-label="Fechar">
              <X size={20} />
            </button>
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
            <img className={`${styles.lightboxImg} ${showAnalysisPanel ? styles.lightboxImgSmall : ''}`} src={viewerPhoto.urls.grande} alt={viewerPhoto.caption || categoryLabel(viewerPhoto.category)} />
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
            {showAnalysisPanel && (
              <div className={styles.analysisPanel}>
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
                          rows={7}
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
                        <p className={styles.aiText}>{a.revised_summary ?? a.summary}</p>
                        {a.revised_summary && (
                          <details className={styles.originalDetails}>
                            <summary>Ver texto original da IA</summary>
                            <p className={styles.aiText}>{a.summary}</p>
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
    </div>
  );
}
