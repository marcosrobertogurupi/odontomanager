import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  
  // Test reading from 'units'
  const { data: units, error: unitsError } = await supabase.from('units').select('*').limit(2);
  if (unitsError) {
    console.error('Error reading units:', unitsError);
  } else {
    console.log('Successfully read units:', units);
  }

  // Test reading from 'profiles'
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').limit(2);
  if (profilesError) {
    console.error('Error reading profiles:', profilesError);
  } else {
    console.log('Successfully read profiles:', profiles);
  }
}

run();
