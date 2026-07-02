import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

// Zoho Mail via the Self Client flow: a long-lived refresh token lives in env
// and access tokens are minted server-side on demand. No interactive OAuth,
// no cookies — the panel is connected for as long as the env vars are valid.
//
// Required env: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
// US datacenter hosts; ZOHO_MAIL_BASE can override the mail host if needed.
const ACCOUNTS_BASE = "https://accounts.zoho.com";
const MAIL_BASE = process.env.ZOHO_MAIL_BASE || "https://mail.zoho.com";

function configured() {
  return !!(
    process.env.ZOHO_CLIENT_ID &&
    process.env.ZOHO_CLIENT_SECRET &&
    process.env.ZOHO_REFRESH_TOKEN
  );
}

// Access tokens are good for ~1 hour. Cache the minted token in module scope
// (lives only as long as the serverless instance — never persisted) and
// re-mint when it's close to expiry.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(force = false): Promise<string | null> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  try {
    const res = await fetch(`${ACCOUNTS_BASE}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
      }).toString(),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      console.error("Zoho token refresh failed:", data);
      return null;
    }
    const ttl = (Number(data.expires_in) || 3600) - 300;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + ttl * 1000 };
    return data.access_token;
  } catch (error) {
    console.error("Zoho token refresh error:", error);
    return null;
  }
}

// NOTE: Zoho requires the "Zoho-oauthtoken" prefix, not "Bearer".
async function zohoFetch(endpoint: string, token: string, init?: RequestInit) {
  return fetch(`${MAIL_BASE}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

let cachedAccountId: string | null = null;

async function getAccountId(token: string): Promise<string> {
  if (cachedAccountId) return cachedAccountId;
  const res = await zohoFetch("/api/accounts", token);
  if (!res.ok) throw new Error(`accounts_${res.status}`);
  const data = await res.json();
  const acct = (data.data || [])[0];
  if (!acct?.accountId) throw new Error("no_account");
  cachedAccountId = String(acct.accountId);
  return cachedAccountId;
}

// The message list must be scoped to the Inbox folder, otherwise archived mail
// (moved out of Inbox) keeps showing up.
async function getFolders(token: string, accountId: string) {
  const res = await zohoFetch(`/api/accounts/${accountId}/folders`, token);
  if (!res.ok) throw new Error(`folders_${res.status}`);
  const data = await res.json();
  return (data.data || []) as any[];
}

function findFolder(folders: any[], types: string[], names: string[]) {
  return folders.find((f) => {
    const t = String(f.folderType || "").toLowerCase();
    const n = String(f.folderName || f.path || "").replace(/^\//, "").toLowerCase();
    return types.includes(t) || names.includes(n);
  });
}

async function fetchEmails(token: string) {
  const accountId = await getAccountId(token);

  // Prefer filtering to the Inbox folder so archived mail drops off. If the
  // token lacks folder scope (/folders 401s), fall back to the default view so
  // email still shows.
  let folderParam = "";
  try {
    const folders = await getFolders(token, accountId);
    const inbox = findFolder(folders, ["inbox"], ["inbox"]);
    if (inbox?.folderId) folderParam = `folderId=${inbox.folderId}&`;
  } catch {
    /* no folder scope — use the default message view */
  }

  const res = await zohoFetch(
    `/api/accounts/${accountId}/messages/view?${folderParam}limit=8&start=1`,
    token
  );
  if (!res.ok) throw new Error(`messages_${res.status}`);
  const data = await res.json();

  return (data.data || []).slice(0, 8).map((m: any) => {
    const from = m.sender || (m.fromAddress || "").replace(/<.*>/, "").trim() || m.fromAddress || "";
    const subject = m.subject || "(no subject)";
    const ms = Number(m.receivedTime);
    const date = Number.isFinite(ms) && ms > 0
      ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    const link = `https://mail.zoho.com/zm/#mail/folder/inbox/p/${m.messageId}`;
    return { id: String(m.messageId), from, subject, date, link };
  });
}

export async function GET(request: NextRequest) {
  if (!configured()) {
    return NextResponse.json({ connected: false, configured: false, emails: [] });
  }

  const debug = request.nextUrl.searchParams.get("debug") === "1";
  let token = await getAccessToken();
  if (!token) return NextResponse.json({ connected: false, configured: true, emails: [] });

  if (debug) {
    // probe each endpoint independently so we can see exactly which scopes the
    // token actually has (accounts / folders / messages / write)
    const probe: any = {};
    let accountId = "";
    try {
      const r = await zohoFetch("/api/accounts", token);
      probe.accounts = r.status;
      const d = await r.json().catch(() => ({}));
      accountId = String((d.data || [])[0]?.accountId || "");
      probe.accountId = accountId;
    } catch (e: any) { probe.accounts = "err:" + e?.message; }

    if (accountId) {
      try {
        const r = await zohoFetch(`/api/accounts/${accountId}/folders`, token);
        probe.folders = r.status;
        if (r.ok) {
          const d = await r.json().catch(() => ({}));
          probe.folderList = (d.data || []).map((f: any) => ({ id: f.folderId, name: f.folderName, type: f.folderType, path: f.path }));
        }
      } catch (e: any) { probe.folders = "err:" + e?.message; }

      try {
        const r = await zohoFetch(`/api/accounts/${accountId}/messages/view?limit=2&start=1`, token);
        probe.messages = r.status;
        const d = await r.json().catch(() => ({}));
        probe.sampleMessage = (d.data || [])[0] || null;
      } catch (e: any) { probe.messages = "err:" + e?.message; }
    }
    return NextResponse.json(probe);
  }

  try {
    const emails = await fetchEmails(token);
    return NextResponse.json({ connected: true, emails });
  } catch {
    token = await getAccessToken(true);
    if (!token) return NextResponse.json({ connected: false, configured: true, emails: [] });
    try {
      const emails = await fetchEmails(token);
      return NextResponse.json({ connected: true, emails });
    } catch (error) {
      console.error("Zoho fetch failed after token retry:", error);
      return NextResponse.json({ connected: false, configured: true, emails: [] });
    }
  }
}

// Archive a message (requires the ZohoMail.messages.ALL scope on the token).
export async function POST(request: NextRequest) {
  const bodyJson = await request.json().catch(() => ({}));

  // One-off diagnostic: test a candidate token WITHOUT touching Vercel. Uses
  // the server's client id/secret (from env), tries it as a refresh token
  // (non-consuming), and if valid, checks the scopes it actually grants.
  if (bodyJson.probeToken) {
    const cid = process.env.ZOHO_CLIENT_ID, cs = process.env.ZOHO_CLIENT_SECRET;
    if (!cid || !cs) return NextResponse.json({ error: "client id/secret not in env" });
    const r = await fetch(`${ACCOUNTS_BASE}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token", refresh_token: bodyJson.probeToken,
        client_id: cid, client_secret: cs,
      }).toString(),
      cache: "no-store",
    });
    const d = await r.json().catch(() => ({}));
    const out: any = { refreshTokenTest: { status: r.status, ok: r.ok, error: r.ok ? undefined : d } };
    if (r.ok && d.access_token) {
      out.verdict = "VALID_REFRESH_TOKEN";
      const at = d.access_token;
      let accId = "";
      try {
        const a = await zohoFetch("/api/accounts", at);
        out.accountsStatus = a.status;
        if (a.ok) { const ad = await a.json(); accId = String((ad.data || [])[0]?.accountId || ""); }
      } catch {}
      if (accId) {
        try { out.foldersStatus = (await zohoFetch(`/api/accounts/${accId}/folders`, at)).status; } catch {}
        try {
          // bogus message id -> no real change; distinguishes scope from format
          const w = await zohoFetch(`/api/accounts/${accId}/updatemessage`, at, {
            method: "PUT", body: JSON.stringify({ mode: "archiveMails", messageId: ["0"] }),
          });
          const wd = await w.json().catch(() => ({}));
          out.writeScope = Array.isArray(wd) && wd[1]?.errorCode === "INVALID_OAUTHSCOPE" ? "MISSING" : "present";
          out.writeProbe = { status: w.status, body: wd };
        } catch {}
      }
    } else {
      out.verdict = "NOT_A_REFRESH_TOKEN (likely a grant code — exchange it first — or expired)";
    }
    return NextResponse.json(out);
  }

  if (!configured()) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { id } = bodyJson;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });

  try {
    const accountId = await getAccountId(token);
    const res = await zohoFetch(`/api/accounts/${accountId}/updatemessage`, token, {
      method: "PUT",
      body: JSON.stringify({ mode: "archiveMails", messageId: [id] }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Zoho archive failed:", res.status, body);
      // surface the raw Zoho response so the exact failure is visible
      return NextResponse.json({ error: "Archive failed", zohoStatus: res.status, zoho: body }, { status: 200 });
    }

    return NextResponse.json({ success: true, zoho: body });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed", detail: String(e?.message || e) }, { status: 200 });
  }
}
