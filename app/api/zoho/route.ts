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
  const folders = await getFolders(token, accountId);
  const inbox = findFolder(folders, ["inbox"], ["inbox"]);
  const folderParam = inbox?.folderId ? `folderId=${inbox.folderId}&` : "";

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
    try {
      const accountId = await getAccountId(token);
      const folders = await getFolders(token, accountId);
      const inbox = findFolder(folders, ["inbox"], ["inbox"]);
      const listRes = await zohoFetch(
        `/api/accounts/${accountId}/messages/view?${inbox?.folderId ? `folderId=${inbox.folderId}&` : ""}limit=2&start=1`,
        token
      );
      const listBody = await listRes.json().catch(() => ({}));
      return NextResponse.json({
        accountId,
        folders: folders.map((f) => ({ folderId: f.folderId, folderName: f.folderName, folderType: f.folderType, path: f.path })),
        detectedInboxId: inbox?.folderId ?? null,
        messagesStatus: listRes.status,
        sampleMessages: (listBody.data || []).slice(0, 2),
      });
    } catch (e: any) {
      return NextResponse.json({ debugError: String(e?.message || e) });
    }
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
  if (!configured()) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { id } = await request.json();
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
