
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSessions() {
  const { data, error } = await supabase
    .from('session_logs')
    .select('id, session_date, sport_type, metadata')
    .eq('session_date', '2025-12-17');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sessions for 2025-12-17:');
  console.log(JSON.stringify(data, null, 2));
}

checkSessions();
