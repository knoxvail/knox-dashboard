import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

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

async function fetchEmails(token: string) {
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
      const userIndex = process.env.GMAIL_USER_INDEX || "0";
      const link = `https://mail.google.com/mail/u/${userIndex}/#all/${msg.threadId}`;

      return { id: msg.id, from, subject, date, link };
    })
  );
}

function setAccessCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: "gmail_access_token",
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

async function refreshAndFetch(refreshToken: string) {
  const newToken = await refreshGmailToken(refreshToken);
  if (!newToken) {
    return NextResponse.json({ connected: false, expired: true, emails: [] });
  }

  let emails: any[] = [];
  try {
    emails = await fetchEmails(newToken);
  } catch (error) {
    console.error("Error fetching emails after token refresh:", error);
    // Continue anyway - the important thing is that the refreshed token persists.
  }

  const response = NextResponse.json({ connected: true, emails });
  setAccessCookie(response, newToken);
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gmail_access_token")?.value;
  const refreshToken = request.cookies.get("gmail_refresh_token")?.value;

  // No credentials at all -> genuinely disconnected.
  if (!token && !refreshToken) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  // The access token cookie expired/was deleted, but we still have a refresh
  // token. Refresh proactively instead of reporting "not connected".
  if (!token && refreshToken) {
    return refreshAndFetch(refreshToken);
  }

  try {
    const listRes = await gmailFetch("/users/me/messages?maxResults=8&q=in:inbox", token!);

    if (listRes.status === 401) {
      if (!refreshToken) return NextResponse.json({ connected: false, expired: true, emails: [] });
      return refreshAndFetch(refreshToken);
    }

    const emails = await fetchEmails(token!);
    return NextResponse.json({ connected: true, emails });
  } catch {
    // Network/parse error with a token that looked valid. Try a refresh as a
    // last resort before giving up.
    if (refreshToken) return refreshAndFetch(refreshToken);
    return NextResponse.json({ connected: false, emails: [] });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("gmail_access_token")?.value;
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id } = await request.json();

  try {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}