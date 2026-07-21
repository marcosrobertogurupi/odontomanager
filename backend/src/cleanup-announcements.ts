import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Apagando comunicados fictícios do banco de dados...');
  const { data, error } = await supabase
    .from('announcements')
    .delete()
    .in('title', ['Manutenção de Equipamento', 'Nova Versão ZaiONe', 'Nova Versão ZaiOne', 'Férias Dra. Beatriz']);

  if (error) {
    console.error('Erro ao deletar avisos fictícios:', error);
  } else {
    console.log('Comunicados fictícios apagados com sucesso!');
  }
}

run();
