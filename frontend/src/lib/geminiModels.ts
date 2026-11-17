// Modelo padrão do Google Gemini usado na leitura de notas fiscais e no assistente Zai.
//
// O antigo padrão "gemini-1.5-flash" foi desligado pelo Google (set/2025) e a família 2.0 também
// (jun/2026): chamar esses nomes dá erro 404. Para clínicas que ainda têm um desses nomes salvo
// nas configurações, `resolveGeminiModel` troca pelo padrão atual em vez de deixar a IA quebrar.
//
// Mantenha este valor igual ao DEFAULT_GEMINI_MODEL de supabase/functions/zai-chat/index.ts.
// Confira os nomes vigentes em https://ai.google.dev/gemini-api/docs/models e as datas de
// desligamento em https://ai.google.dev/gemini-api/docs/deprecations
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

// Famílias já desligadas pelo Google.
const RETIRED_GEMINI_MODEL = /^(models\/)?gemini-(1\.\d|2\.0)/i;

export function resolveGeminiModel(saved?: string | null): string {
  const name = (saved ?? '').trim();
  if (!name || RETIRED_GEMINI_MODEL.test(name)) return DEFAULT_GEMINI_MODEL;
  return name;
}
