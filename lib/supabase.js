import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://juqmtsvvajkehuwbqesn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CJRsusRQuAafr9Ce1fXVTA_5mCu6pCo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdminClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'zunime-admin-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

