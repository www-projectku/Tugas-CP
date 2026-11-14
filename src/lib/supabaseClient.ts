import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://rmlpsjquqabljnrqvosg.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_yz7cOGyJMifMuFMtM683zQ_hfCSKbsn';

function pickValidUrl(...candidates: (string | undefined)[]): string {
  for (const val of candidates) {
    const trimmed = val?.trim();
    if (trimmed && /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_SUPABASE_URL;
}

function pickValidKey(...candidates: (string | undefined)[]): string {
  for (const val of candidates) {
    const trimmed = val?.trim();
    if (
      trimmed &&
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      (trimmed.startsWith('sb_publishable_') || trimmed.startsWith('eyJ'))
    ) {
      return trimmed;
    }
  }
  return DEFAULT_SUPABASE_KEY;
}

export const SUPABASE_URL = pickValidUrl(import.meta.env.VITE_SUPABASE_URL);

export const SUPABASE_PUBLISHABLE_KEY = pickValidKey(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
