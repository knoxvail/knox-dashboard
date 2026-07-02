import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

const REGION = process.env.ZOHO_REGION || "com";
const MAIL_BASE = `https://mail.zoho.${REGION}`;

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

async function refreshZohoToken(refreshToken: string) {
  try {
    const res = await fetch(`https://accounts.zoho.${REGION}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

// The mail API needs the account id for every call; resolve the primary one.
async function getAccountId(token: string) {
  const res = await zohoFetch("/api/accounts", token);
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const acct = (data.data || [])[0];
  if (!acct?.accountId) throw new Error("no_account");
  return String(acct.accountId);
}

async function fetchEmails(token: string) {
  const accountId = await getAccountId(token);
  const res = await zohoFetch(
    `/api/accounts/${accountId}/messages/view?limit=8&start=1`,
    token
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();

  return (data.data || []).slice(0, 8).map((m: any) => {
    const from = m.sender || (m.fromAddress || "").replace(/<.*>/, "").trim() || m.fromAddress || "";
    const subject = m.subject || "(no subject)";
    const ms = Number(m.receivedTime);
    const date = Number.isFinite(ms) && ms > 0
      ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    // Zoho web deep link; falls back to the inbox if the message view moves
    const link = `${MAIL_BASE}/zm/#mail/folder/inbox/p/${m.messageId}`;
    return { id: String(m.messageId), from, subject, date, link, accountId };
  });
}

function setAccessCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: "zoho_access_token",
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function refreshAndFetch(refreshToken: string) {
  const newToken = await refreshZohoToken(refreshToken);
  if (!newToken) return NextResponse.json({ connected: false, expired: true, emails: [] });

  let emails: any[] = [];
  try {
    emails = await fetchEmails(newToken);
  } catch (error) {
    console.error("Error fetching Zoho emails after token refresh:", error);
  }

  const response = NextResponse.json({ connected: true, emails });
  setAccessCookie(response, newToken);
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("zoho_access_token")?.value;
  const refreshToken = request.cookies.get("zoho_refresh_token")?.value;

  if (!token && !refreshToken) return NextResponse.json({ connected: false, emails: [] });
  if (!token && refreshToken) return refreshAndFetch(refreshToken);

  try {
    const emails = await fetchEmails(token!);
    return NextResponse.json({ connected: true, emails });
  } catch {
    // expired/invalid token (or transient failure) -> try a refresh
    if (refreshToken) return refreshAndFetch(refreshToken);
    return NextResponse.json({ connected: false, emails: [] });
  }
}

// Archive a message (matches the Gmail panel's checkmark behavior)
export async function POST(request: NextRequest) {
  const token = request.cookies.get("zoho_access_token")?.value;
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id } = await request.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  try {
    const accountId = await getAccountId(token);
    const res = await zohoFetch(`/api/accounts/${accountId}/updatemessage`, token, {
      method: "PUT",
      body: JSON.stringify({ mode: "archiveMails", messageId: [id] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Zoho archive failed:", res.status, err);
      return NextResponse.json({ error: "Archive failed" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
