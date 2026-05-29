import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

async function gmailFetch(endpoint: string, token: string) {
  return fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
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
      const link = `https://mail.google.com/mail/u/1/#all/${msg.threadId}`;

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
      const refreshed = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/refresh`, {
        method: "POST",
        headers: { cookie: request.headers.get("cookie") || "" },
      });
      if (!refreshed.ok) return NextResponse.json({ connected: false, expired: true, emails: [] });

      const newToken = refreshed.headers.get("set-cookie")?.match(/gmail_access_token=([^;]+)/)?.[1];
      if (!newToken) return NextResponse.json({ connected: false, expired: true, emails: [] });

      const emails = await fetchEmails(newToken);
      return NextResponse.json({ connected: true, emails });
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