import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateDB() {
  const sourcesToDisable = ['Autoblog', 'AP News', 'Reuters'];
  
  for (const name of sourcesToDisable) {
    const { error } = await supabase
      .from('sources')
      .update({ is_active: false })
      .eq('name', name);
    
    if (error) {
      console.error(`Failed to disable ${name}:`, error);
    } else {
      console.log(`Disabled ${name}`);
    }
  }
}

updateDB();
