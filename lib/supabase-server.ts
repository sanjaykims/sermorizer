/* Server-only Supabase client. Uses the service role key so RLS is bypassed —
   the API routes are the gatekeepers, not RLS. The key is read from the
   SUPABASE_SERVICE_ROLE_KEY environment variable; routes return 503 when it
   isn't configured. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Intentional single-tenant default: this is the Sermorizer Supabase project
// the production deployment targets. Forks/local installs should override with
// NEXT_PUBLIC_SUPABASE_URL — combined with SUPABASE_SERVICE_ROLE_KEY (which is
// strictly required), a wrong URL would just fail authentication immediately
// rather than silently writing to the wrong DB.
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

/** Run a Supabase-touching async fn, retrying once on transient clock-skew
 *  errors ("JWT issued at future", "JWT expired"). These can surface on a
 *  cold-start when the Vercel Lambda's wall clock briefly disagrees with
 *  Supabase's validator. Retry on a clean second instance — never on real
 *  config / auth errors. */
export async function withSupabaseRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/JWT.*(future|expired)/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 250));
      return await fn();
    }
    throw e;
  }
}
