import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

export let supabase: any = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Atenção: SUPABASE_URL ou SUPABASE_KEY não foram definidos no arquivo .env. O sistema operará em modo de fallback (Mock).');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
  } catch (err) {
    console.error('[Supabase] Erro ao inicializar o cliente Supabase:', err);
  }
}
