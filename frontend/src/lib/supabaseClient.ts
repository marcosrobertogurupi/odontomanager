import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://xhnhijctrlsjnfsoygpm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobmhpamN0cmxzam5mc295Z3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzOTIyODEsImV4cCI6MjA5OTk2ODI4MX0.o3D9_KjrLMFIU85sKeHwmtFErQrsdXH2kJohkqBgXPI';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl =
  rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('rpnolocfehzhhgmllkjm')
    ? rawUrl
    : DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  rawKey && rawKey !== '[SENSITIVE]' && !rawUrl?.includes('rpnolocfehzhhgmllkjm')
    ? rawKey
    : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

