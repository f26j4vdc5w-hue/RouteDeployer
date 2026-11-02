import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase ist nicht konfiguriert. VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen.',
    );
  }
  return supabase;
}
