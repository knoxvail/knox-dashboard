import { NextResponse } from "next/server";

export const revalidate = 0;

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
      cache: "no-store",
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

  try {
    const { id, title, status, action } = await request.json();

    // Handle moving a task between Short Term and Long Term (status change)
    if (action === "move") {
      if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });
      if (status !== "Short Term" && status !== "Long Term") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { Status: { status: { name: status } } },
        }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true });
    }

    // Handle task completion (archive)
    if (action === "complete") {
      if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true });
    }

    // Handle task update (edit)
    if (action === "update") {
      if (!id || !title) {
        return NextResponse.json({ error: "Missing id or title" }, { status: 400 });
      }

      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
      }

      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            Name: {
              title: [{ text: { content: title.trim() } }],
            },
          },
        }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/notion error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return NextResponse.json({ error: "No token" }, { status: 401 });

  try {
    const { title, status } = await request.json();

    if (!title || !status) {
      return NextResponse.json({ error: "Missing title or status" }, { status: 400 });
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    if (status !== "Short Term" && status !== "Long Term") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          Name: {
            title: [{ text: { content: title.trim() } }],
          },
          Status: {
            status: { name: status },
          },
        },
      }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      return NextResponse.json({ error: err }, { status: notionRes.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/notion error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}