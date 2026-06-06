/* Server-only Supabase client. Uses the service role key so RLS is bypassed —
   the API routes are the gatekeepers, not RLS. The key is read from the
   SUPABASE_SERVICE_ROLE_KEY environment variable; routes return 503 when it
   isn't configured. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_DEFAULT = "https://aeygqjuhqjvlhjrslbxd.supabase.co";

let cached: SupabaseClient | null = null;

export function supabaseAdminAvailable(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? URL_DEFAULT;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it in Vercel project settings.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
