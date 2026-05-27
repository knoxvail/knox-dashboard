import { NextResponse } from "next/server";

export const revalidate = 300;

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return NextResponse.json({ shortTerm: [], longTerm: [] });

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 50,
      }),
      next: { revalidate: 300 },
    });
    const data = await res.json();

    const shortTerm: { id: string; title: string }[] = [];
    const longTerm: { id: string; title: string }[] = [];

    (data.results || []).forEach((page: any) => {
      const titleProp = Object.values(page.properties).find((p: any) => p.type === "title") as any;
      const title = titleProp?.title?.map((t: any) => t.plain_text).join("") || "";
      if (!title) return;

      const statusProp = Object.values(page.properties).find((p: any) => p.type === "status") as any;
      const status = statusProp?.status?.name || "";

      if (status === "Short Term") shortTerm.push({ id: page.id, title });
      else if (status === "Long Term") longTerm.push({ id: page.id, title });
    });

    return NextResponse.json({ shortTerm, longTerm });
  } catch {
    return NextResponse.json({ shortTerm: [], longTerm: [] });
  }
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id } = await request.json();

  try {
    await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: true }),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}