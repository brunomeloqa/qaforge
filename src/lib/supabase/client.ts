import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://vmoceqizuoplduhrzvzg.supabase.co';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_DUk2UOyhKtPdwZLnCRSDLA_l_GNYPv9';

  return createBrowserClient(supabaseUrl, supabaseKey);
}
