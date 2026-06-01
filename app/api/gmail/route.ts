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

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gmail_access_token")?.value;
  if (!token) return NextResponse.json({ connected: false, emails: [] });

  try {
    const listRes = await gmailFetch("/users/me/messages?maxResults=8&q=in:inbox", token);

    if (listRes.status === 401) {
      const refreshToken = request.cookies.get("gmail_refresh_token")?.value;
      if (!refreshToken) return NextResponse.json({ connected: false, expired: true, emails: [] });

      const newToken = await refreshGmailToken(refreshToken);
      if (!newToken) return NextResponse.json({ connected: false, expired: true, emails: [] });

      // Fetch emails with the new token
      let emails: any[] = [];
      try {
        emails = await fetchEmails(newToken);
      } catch (error) {
        console.error("Error fetching emails after token refresh:", error);
        // Continue anyway - at least the token is being refreshed
      }

      // Create response and set the new token
      // This ensures the token is persisted regardless of fetchEmails success/failure
      const response = NextResponse.json({ connected: true, emails });
      response.cookies.set({
        name: "gmail_access_token",
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600,
      });
      return response;
    }

    const emails = await fetchEmails(token);
    return NextResponse.json({ connected: true, emails });
  } catch {
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