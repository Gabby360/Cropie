// CROPIE — Supabase Client Initialization
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (import.meta && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL)) || 
  'https://pymnperbjjqwhxigeand.supabase.co';

const supabaseAnonKey = 
  (import.meta && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) || 
  'sb_publishable_9qJFnyJXAxjoVgcIrZ9tng_Lb-kd-Jl';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
