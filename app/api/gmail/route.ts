import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

async function gmailFetch(endpoint: string, token: string) {
  return fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gmail_access_token")?.value;
  if (!token) return NextResponse.json({ connected: false, emails: [] });

  try {
    const listRes = await gmailFetch("/users/me/messages?maxResults=6&q=is:unread", token);
    if (listRes.status === 401) return NextResponse.json({ connected: false, expired: true, emails: [] });

    const listData = await listRes.json();
    const messages = listData.messages || [];

    const emails = await Promise.all(
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
        const link = `https://mail.google.com/mail/u/0/#all/${msg.threadId}`;

        return { id: msg.id, from, subject, date, link };
      })
    );

    return NextResponse.json({ connected: true, emails });
  } catch {
    return NextResponse.json({ connected: false, emails: [] });
  }
}