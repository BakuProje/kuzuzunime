const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juqmtsvvajkehuwbqesn.supabase.co';
const supabaseAnonKey = 'sb_publishable_CJRsusRQuAafr9Ce1fXVTA_5mCu6pCo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (error) {
      console.error('Error fetching profiles:', error);
    } else {
      console.log('Profiles in DB:', data);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

check();
