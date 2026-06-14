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
  await supa.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** Best-effort push to every stored subscription. Prunes dead endpoints
 *  (410/404). Never throws — a push failure must not fail the job. */
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  if (!ensureConfigured()) return;
  try {
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
          }
        }
      }),
    );
  } catch {
    /* push is best-effort */
  }
}
