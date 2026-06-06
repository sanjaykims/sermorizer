/* POST /api/auth/logout — clear the session cookie. */

import { clearSessionCookie } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
