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
import styles from './PatientPhotos.module.css';

interface PatientPhotosProps {
  patient: { id: string; name: string };
  onBack: () => void;
}

const categoryLabel = (c: PhotoCategory) => PHOTO_CATEGORIES.find((x) => x.value === c)?.label ?? c;
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD no fuso local

export default function PatientPhotos({ patient, onBack }: PatientPhotosProps) {
  const { isReadOnly } = useTenant();
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
  const [comparing, setComparing] = useState(false);

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
      if (e.key === 'Escape') {
        setViewerId(null);
        setComparing(false);
      } else if (viewerPhoto && !editing && e.key === 'ArrowLeft') step(-1);
      else if (viewerPhoto && !editing && e.key === 'ArrowRight') step(1);
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
    if (!confirm('Excluir esta foto definitivamente? Esta ação é irreversível.')) return;
    try {
      const nextIndex = Math.min(viewerIndex, visible.length - 2);
      await deletePatientPhoto(p.id);
      setSelected((prev) => prev.filter((id) => id !== p.id));
      setViewerId(nextIndex >= 0 ? visible.filter((x) => x.id !== p.id)[nextIndex]?.id ?? null : null);
      await load();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
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
              <button
                key={p.id}
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
                      <button className={styles.ghostBtn} onClick={() => startEdit(viewerPhoto)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button className={`${styles.ghostBtn} ${styles.danger}`} onClick={() => handleDelete(viewerPhoto)}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
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
