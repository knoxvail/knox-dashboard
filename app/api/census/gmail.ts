import type { NextRequest } from "next/server";

// A small Gmail client over the dashboard's existing Triad login (the same
// cookies /api/gmail uses). Refreshes the access token on a 401 and remembers
// the new one so the caller can put it back in the cookie.

async function refresh(refreshToken: string): Promise<string | null> {
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
    if (!r.ok) return null;
    return (await r.json()).access_token || null;
  } catch {
    return null;
  }
}

export function gmailClient(req: NextRequest) {
  let token = req.cookies.get("gmail_access_token")?.value || "";
  const refreshToken = req.cookies.get("gmail_refresh_token")?.value || "";
  let refreshed: string | null = null;

  const call = (path: string, t: string) =>
    fetch(`https://gmail.googleapis.com/gmail/v1${path}`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });

  async function get(path: string): Promise<Response> {
    if (!token && refreshToken) {
      const nt = await refresh(refreshToken);
      if (nt) { token = nt; refreshed = nt; }
    }
    if (!token) return new Response(null, { status: 401 });
    let r = await call(path, token);
    if (r.status === 401 && refreshToken) {
      const nt = await refresh(refreshToken);
      if (nt) { token = nt; refreshed = nt; r = await call(path, nt); }
    }
    return r;
  }

  return {
    get,
    connected: () => !!(token || refreshToken),
    refreshedToken: () => refreshed,
  };
}
