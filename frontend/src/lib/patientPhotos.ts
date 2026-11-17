import { supabase } from './supabaseClient';

// Fotos dos pacientes: os arquivos ficam no Cloudflare R2 (não no Supabase Storage), gravados pela
// Edge Function `patient-photos`. O navegador reduz a foto em 3 tamanhos antes de enviar, igual ao
// que o LojaCarros faz com as fotos dos carros.

export type PhotoCategory = 'radiografia' | 'antes' | 'depois' | 'outra';

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'radiografia', label: 'Radiografia' },
  { value: 'antes', label: 'Antes' },
  { value: 'depois', label: 'Depois' },
  { value: 'outra', label: 'Outra' },
];

export interface PatientPhoto {
  id: string;
  category: PhotoCategory;
  caption: string | null;
  taken_on: string;
  created_at: string;
  urls: { grande: string; media: string; mini: string };
}

// Radiografia precisa de detalhe: o tamanho "grande" é maior que o das fotos de carro.
const SIZES = { grande: 1920, media: 800, mini: 320 } as const;
type SizeName = keyof typeof SIZES;
const SIZE_NAMES = Object.keys(SIZES) as SizeName[];
const ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation respeita a rotação gravada pela câmera do celular.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* cai para <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // WebP quando o navegador suporta; senão o próprio toBlob devolve outro formato (PNG) e usamos JPEG.
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === 'image/webp') return resolve(webp);
        canvas.toBlob(
          (jpg) => (jpg ? resolve(jpg) : reject(new Error('Não foi possível processar a imagem.'))),
          'image/jpeg',
          0.85
        );
      },
      'image/webp',
      0.85
    );
  });
}

/** Gera os 3 tamanhos (grande, média, miniatura) a partir da foto escolhida. */
export async function resizePhoto(file: File): Promise<Record<SizeName, Blob>> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem (use JPG, PNG ou WebP).`);
  if (file.size > ORIGINAL_MAX_BYTES) throw new Error(`"${file.name}" é grande demais (máximo 25 MB).`);

  const bitmap = await loadBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const result = {} as Record<SizeName, Blob>;

  for (const name of SIZE_NAMES) {
    const scale = Math.min(1, SIZES[name] / Math.max(srcW, srcH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    result[name] = await canvasToBlob(canvas);
  }
  if ('close' in bitmap) bitmap.close();
  return result;
}

// Mensagem de erro amigável vinda da Edge Function (corpo JSON { error }).
export async function invokeEdge<T>(fn: string, body: BodyInit | Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body: body as never });
  if (error) {
    let message = 'Não foi possível concluir a operação com as fotos.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json();
        // `error` vem da nossa função; `message` vem do gateway (ex.: função ainda não publicada).
        if (payload?.error) message = payload.error;
        else if (payload?.message) message = payload.message;
      } catch {
        /* mantém a mensagem padrão */
      }
    }
    throw new Error(message);
  }
  return data as T;
}

const invoke = <T>(body: BodyInit | Record<string, unknown>) => invokeEdge<T>('patient-photos', body);

export async function listPatientPhotos(patientId: string): Promise<PatientPhoto[]> {
  const res = await invoke<{ fotos: PatientPhoto[] }>({ action: 'list', patient_id: patientId });
  return res.fotos;
}

export async function uploadPatientPhoto(
  patientId: string,
  file: File,
  meta: { category: PhotoCategory; caption: string; takenOn: string }
): Promise<void> {
  const sizes = await resizePhoto(file);
  const form = new FormData();
  form.append('action', 'upload');
  form.append('patient_id', patientId);
  form.append('category', meta.category);
  form.append('caption', meta.caption);
  form.append('taken_on', meta.takenOn);
  for (const name of SIZE_NAMES) form.append(name, sizes[name], `${name}`);
  await invoke(form);
}

export async function updatePatientPhoto(
  id: string,
  changes: { category?: PhotoCategory; caption?: string; taken_on?: string }
): Promise<void> {
  await invoke({ action: 'update', id, ...changes });
}

export async function deletePatientPhoto(id: string): Promise<void> {
  await invoke({ action: 'delete', id });
}

/** Apaga do R2 todas as fotos do paciente (chamar antes de excluir o cadastro). */
export async function purgePatientPhotos(patientId: string): Promise<void> {
  try {
    await invoke({ action: 'purge', patient_id: patientId });
  } catch (err: any) {
    // Função ainda não publicada no Supabase = ninguém pode ter foto guardada; não trava a exclusão.
    if (/function was not found/i.test(err?.message || '')) return;
    throw err;
  }
}
