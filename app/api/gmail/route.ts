import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

// Two Gmail accounts are supported: "triad" (default — the original cookie
// names, so existing logins keep working) and "soren". Each account stores its
// own token pair under its own cookie names.
function cookieNames(acct: string) {
  return acct === "soren"
    ? { access: "soren_gmail_access_token", refresh: "soren_gmail_refresh_token" }
    : { access: "gmail_access_token", refresh: "gmail_refresh_token" };
}

function getAcct(request: NextRequest) {
  return request.nextUrl.searchParams.get("acct") === "soren" ? "soren" : "triad";
}

async function gmailFetch(endpoint: string, token: string) {
  return fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

async function refreshGmailToken(refreshToken: string) {
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }).toString(),
    });

    if (!tokenResponse.ok) return null;
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch {
    return null;
  }
}

// Where email links should open. Triad uses the configured account index;
// Soren resolves its own address from the profile API — Gmail accepts an email
// address in the /mail/u/ slot and routes to that signed-in session, so no
// index configuration is needed for the second account.
async function resolveLinkBase(acct: string, token: string) {
  if (acct !== "soren") {
    const userIndex = process.env.GMAIL_USER_INDEX || "0";
    return `https://mail.google.com/mail/u/${userIndex}/`;
  }
  try {
    const res = await gmailFetch("/users/me/profile", token);
    if (res.ok) {
      const data = await res.json();
      if (data.emailAddress) {
        return `https://mail.google.com/mail/u/${encodeURIComponent(data.emailAddress)}/`;
      }
    }
  } catch {}
  return "https://mail.google.com/mail/u/0/";
}

async function fetchEmails(token: string, linkBase: string) {
  const listRes = await gmailFetch("/users/me/messages?maxResults=8&q=in:inbox", token);
  if (!listRes.ok) throw new Error("list_failed");

  const listData = await listRes.json();
  const messages = listData.messages || [];

  return Promise.all(
    messages.map(async (msg: { id: string; threadId: string }) => {
      const msgRes = await gmailFetch(
        `/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        token
      );
      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];
      const get = (name: string) => headers.find((h: any) => h.name === name)?.value || "";

      const from = get("From").replace(/<.*>/, "").trim() || get("From");
      const subject = get("Subject") || "(no subject)";
      const date = new Date(get("Date")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const link = `${linkBase}#all/${msg.threadId}`;

      return { id: msg.id, from, subject, date, link };
    })
  );
}

function setAccessCookie(response: NextResponse, name: string, value: string) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Keep the cookie around for 30 days so it survives even after the
    // underlying access token expires. The value may be stale, but that just
    // triggers the 401 -> refresh path instead of silently logging the user out.
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function refreshAndFetch(refreshToken: string, acct: string) {
  const newToken = await refreshGmailToken(refreshToken);
  if (!newToken) {
    return NextResponse.json({ connected: false, expired: true, emails: [] });
  }

  let emails: any[] = [];
  try {
    emails = await fetchEmails(newToken, await resolveLinkBase(acct, newToken));
  } catch (error) {
    console.error("Error fetching emails after token refresh:", error);
    // Continue anyway - the important thing is that the refreshed token persists.
  }

  const response = NextResponse.json({ connected: true, emails });
  setAccessCookie(response, cookieNames(acct).access, newToken);
  return response;
}

// Fetch one message's full body (html + text) for the in-dashboard reader.
async function gmailContent(id: string, token: string | undefined, refreshToken: string | undefined, acct: string) {
  let t: string | undefined = token;
  if (!t && refreshToken) t = (await refreshGmailToken(refreshToken)) || undefined;
  if (!t) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  let res = await gmailFetch(`/users/me/messages/${id}?format=full`, t);
  if (res.status === 401 && refreshToken) {
    const nt = await refreshGmailToken(refreshToken);
    if (nt) { t = nt; res = await gmailFetch(`/users/me/messages/${id}?format=full`, nt); }
  }
  if (!res.ok) return NextResponse.json({ error: "fetch_failed" }, { status: res.status });
  const data = await res.json();
  const payload = data.payload || {};
  const find = (part: any, mime: string): string | null => {
    if (!part) return null;
    if (part.mimeType === mime && part.body?.data) return part.body.data as string;
    if (Array.isArray(part.parts)) { for (const p of part.parts) { const r = find(p, mime); if (r) return r; } }
    return null;
  };
  const dec = (d: string | null) => { try { return d ? Buffer.from(d, "base64url").toString("utf-8") : ""; } catch { return ""; } };
  const headers = payload.headers || [];
  const get = (n: string) => headers.find((h: any) => h.name === n)?.value || "";
  return NextResponse.json({
    from: get("From"), subject: get("Subject"), date: get("Date"),
    html: dec(find(payload, "text/html")), text: dec(find(payload, "text/plain")),
    link: `${await resolveLinkBase(acct, t as string)}#all/${data.threadId}`,
  });
}

export async function GET(request: NextRequest) {
  const acct = getAcct(request);
  const names = cookieNames(acct);
  const token = request.cookies.get(names.access)?.value;
  const refreshToken = request.cookies.get(names.refresh)?.value;

  // read a single message's body for the in-dashboard reader
  const contentId = request.nextUrl.searchParams.get("content");
  if (contentId) return gmailContent(contentId, token, refreshToken, acct);

  // No credentials at all -> genuinely disconnected.
  if (!token && !refreshToken) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  // The access token cookie expired/was deleted, but we still have a refresh
  // token. Refresh proactively instead of reporting "not connected".
  if (!token && refreshToken) {
    return refreshAndFetch(refreshToken, acct);
  }

  try {
    const listRes = await gmailFetch("/users/me/messages?maxResults=8&q=in:inbox", token!);

    if (listRes.status === 401) {
      if (!refreshToken) return NextResponse.json({ connected: false, expired: true, emails: [] });
      return refreshAndFetch(refreshToken, acct);
    }

    const emails = await fetchEmails(token!, await resolveLinkBase(acct, token!));
    return NextResponse.json({ connected: true, emails });
  } catch {
    // Network/parse error with a token that looked valid. Try a refresh as a
    // last resort before giving up.
    if (refreshToken) return refreshAndFetch(refreshToken, acct);
    return NextResponse.json({ connected: false, emails: [] });
  }
}

// Send a plain-text reply on the same thread as message `id`.
async function gmailReply(id: string, replyBody: string, token: string | undefined, refreshToken: string | undefined) {
  if (!id || !replyBody || !replyBody.trim()) return NextResponse.json({ error: "Missing id or body" }, { status: 400 });
  let t: string | undefined = token;
  if (!t && refreshToken) t = (await refreshGmailToken(refreshToken)) || undefined;
  if (!t) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const metaUrl = `/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`;
  let metaRes = await gmailFetch(metaUrl, t);
  if (metaRes.status === 401 && refreshToken) {
    const nt = await refreshGmailToken(refreshToken);
    if (nt) { t = nt; metaRes = await gmailFetch(metaUrl, nt); }
  }
  if (!metaRes.ok) return NextResponse.json({ error: "fetch_failed" }, { status: metaRes.status });
  const meta = await metaRes.json();
  const headers = meta.payload?.headers || [];
  const get = (n: string) => headers.find((h: any) => h.name?.toLowerCase() === n.toLowerCase())?.value || "";

  const fromRaw = get("From");
  const to = fromRaw.match(/<([^>]+)>/)?.[1] || fromRaw.trim();
  const subjectRaw = get("Subject") || "";
  const subject = /^re:/i.test(subjectRaw) ? subjectRaw : `Re: ${subjectRaw}`;
  const msgId = get("Message-ID");
  const references = [get("References"), msgId].filter(Boolean).join(" ");

  const lines = [`To: ${to}`, `Subject: ${subject}`];
  if (msgId) lines.push(`In-Reply-To: ${msgId}`);
  if (references) lines.push(`References: ${references}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"', "MIME-Version: 1.0", "", replyBody);
  const raw = Buffer.from(lines.join("\r\n"), "utf-8").toString("base64url");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: meta.threadId }),
  });
  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({}));
    // 403 = insufficient scope (the app needs the send scope re-granted)
    return NextResponse.json({ error: err, needsReconnect: sendRes.status === 403 || sendRes.status === 401 }, { status: sendRes.status });
  }
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const acct = getAcct(request);
  const token = request.cookies.get(cookieNames(acct).access)?.value;
  const refreshToken = request.cookies.get(cookieNames(acct).refresh)?.value;
  if (!token && !refreshToken) return NextResponse.json({ error: "No token" }, { status: 401 });

  const body = await request.json();
  if (body.action === "reply") return gmailReply(body.id, body.body, token, refreshToken);

  // Undo an archive: put the message back in the inbox
  if (body.action === "unarchive") {
    if (!body.id || !token) return NextResponse.json({ error: "No token or id" }, { status: 400 });
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${body.id}/modify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ addLabelIds: ["INBOX"] }),
    });
    if (!res.ok) return NextResponse.json({ error: "Unarchive failed" }, { status: res.status });
    return NextResponse.json({ success: true });
  }

  const { id } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
    });

    // Only report success if Gmail actually archived the message
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Gmail archive failed:", res.status, err);
      return NextResponse.json({ error: "Archive failed" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
