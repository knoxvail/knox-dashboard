import type { NextRequest } from "next/server";

// A small Gmail client. It runs on a pair of Google tokens: the dashboard's
// own cookies when the board is calling (the same ones /api/gmail uses), or
// the login the census job keeps for itself (see vault.ts). It refreshes the
// access token on a 401 and remembers the new one, so a cookie caller can
// have it put back.

// denied = Google said this refresh token is revoked or expired, as opposed
// to a passing network problem
export async function refreshAccess(refreshToken: string): Promise<{ token: string | null; denied: boolean }> {
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }).toString(),
    });
    if (!r.ok) {
      let denied = false;
      try { denied = (await r.json())?.error === "invalid_grant"; } catch {}
      return { token: null, denied };
    }
    return { token: (await r.json()).access_token || null, denied: false };
  } catch {
    return { token: null, denied: false };
  }
}

export function gmailWith(accessToken: string, refreshToken: string) {
  let token = accessToken;
  let refreshed: string | null = null;
  let denied = false;

  const call = (path: string, t: string) =>
    fetch(`https://gmail.googleapis.com/gmail/v1${path}`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });

  async function renew(): Promise<boolean> {
    const r = await refreshAccess(refreshToken);
    if (r.denied) denied = true;
    if (!r.token) return false;
    token = r.token;
    refreshed = r.token;
    return true;
  }

  async function get(path: string): Promise<Response> {
    if (!token && refreshToken) await renew();
    if (!token) return new Response(null, { status: 401 });
    let r = await call(path, token);
    if (r.status === 401 && refreshToken && (await renew())) r = await call(path, token);
    return r;
  }

  return {
    get,
    connected: () => !!(token || refreshToken),
    refreshedToken: () => refreshed,
    denied: () => denied,
  };
}

export type Gmail = ReturnType<typeof gmailWith>;

export function gmailClient(req: NextRequest) {
  return gmailWith(req.cookies.get("gmail_access_token")?.value || "", req.cookies.get("gmail_refresh_token")?.value || "");
}

// which mailbox a client is signed in to, lowercased; "" when Gmail won't say
export async function mailboxOf(gm: Gmail): Promise<string> {
  try {
    const r = await gm.get("/users/me/profile");
    if (!r.ok) return "";
    return String((await r.json()).emailAddress || "").toLowerCase();
  } catch {
    return "";
  }
}
