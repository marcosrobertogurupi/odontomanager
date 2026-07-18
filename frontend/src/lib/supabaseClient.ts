import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[SupabaseClient] Atenção: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão definidos no ambiente. Verifique o arquivo .env.local.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
