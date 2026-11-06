import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

async function testSupabaseCloud() {
  console.log('Testing Supabase Cloud URL:', supabaseUrl);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/units?select=count`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log('HTTP Status:', res.status);
    console.log('Body:', await res.text());
  } catch (err: any) {
    console.error('Error connecting to Supabase Cloud:', err.message, err.cause);
  }
}

testSupabaseCloud();
