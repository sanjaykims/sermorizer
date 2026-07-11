/* Server-only web-push. Lets the server notify the user's phone when a summary
   or translation finishes — even when the app is closed or the phone is locked,
   which page-level Notifications can't do once the page is frozen.

   Push is fully optional: if VAPID_PRIVATE_KEY isn't set, every function here is
   a graceful no-op and the in-app chime/notification still works. */

import webpush from "web-push";
import { getSupabaseAdmin } from "./supabase-server";
import { VAPID_PUBLIC_KEY } from "./push-key";

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:sanjaykim@kakao.com";

let configured = false;
function ensureConfigured(): boolean {
  if (!VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

/** Whether server-side push is configured (private key present). */
export function pushAvailable(): boolean {
  return Boolean(VAPID_PRIVATE_KEY);
}

type StoredSub = { endpoint: string; p256dh: string; auth: string };

export async function savePushSubscription(sub: StoredSub): Promise<void> {
  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("push_subscriptions")
    .upsert(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      { onConflict: "endpoint" },
    );
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  // Surface a failed delete instead of reporting success — otherwise the stale
  // row keeps receiving pushes and the user believes they unsubscribed.
  if (error) throw new Error(error.message);
}

/** Best-effort push to every stored subscription. Prunes dead endpoints
 *  (410/404). Never throws — a push failure must not fail the job.
 *
 *  Single-user app: every enrolled device of the *one* owner gets every
 *  completion alert (so a sermon generated on the phone also lights up the
 *  tablet, etc.). If Sermorizer ever becomes multi-user, push_subscriptions
 *  will need an owner_id column and this fan-out must filter on it. */
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  try {
    // Inside the try: setVapidDetails() can throw on a malformed key, and this
    // function is called on the generation SUCCESS path — a push-config error
    // must never propagate and flip a finished summary to 'error'.
    if (!ensureConfigured()) return;
    const supa = getSupabaseAdmin();
    const { data, error } = await supa.from("push_subscriptions").select("*");
    if (error || !data) return;
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
    });
    await Promise.all(
      (data as StoredSub[]).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            console.warn("[sermorizer] pruned dead push subscription", {
              code,
            });
          } else {
            console.error("[sermorizer] push delivery failed", {
              code,
              err: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }),
    );
  } catch (e) {
    console.error("[sermorizer] sendPushToAll threw", {
      err: e instanceof Error ? e.message : String(e),
    });
  }
}
