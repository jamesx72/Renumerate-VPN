import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function isValidSupabaseEndpoint(url: string, key: string): boolean {
  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('example.supabase.co')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 4;
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidSupabaseEndpoint(rawUrl, rawKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;