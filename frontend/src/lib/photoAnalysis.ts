import { supabase } from './supabaseClient';
import { invokeEdge } from './patientPhotos';

// Análise de foto/radiografia por IA: só roda quando o dentista clica no botão. A chamada ao modelo
// acontece na Edge Function `analyze-photo`; aqui a tela só lê o histórico (RLS) e pede nova análise.
// O nome do modelo nunca chega à tela: no piloto a avaliação é às cegas ("Opção A/B/C").

export interface PhotoAnalysis {
  id: string;
  label: string | null;
  summary: string;
  rating: number | null;
  rating_note: string | null;
  created_at: string;
}

export async function listPhotoAnalyses(photoId: string): Promise<PhotoAnalysis[]> {
  const { data, error } = await supabase
    .from('photo_ai_analyses')
    .select('id, label, summary, rating, rating_note, created_at')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: false })
    .order('label', { ascending: true });
  if (error) throw error;
  return (data || []) as PhotoAnalysis[];
}

export async function analyzePhoto(
  photoId: string
): Promise<{ analyses: { id: string; label: string | null }[]; errors: { label: string | null; error: string }[] }> {
  return invokeEdge('analyze-photo', { action: 'analyze', photo_id: photoId });
}

export async function ratePhotoAnalysis(id: string, changes: { rating?: number; note?: string }): Promise<void> {
  await invokeEdge('analyze-photo', { action: 'rate', id, ...changes });
}
