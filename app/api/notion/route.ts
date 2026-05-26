import { NextResponse } from "next/server";

export const revalidate = 300; // cache 5 min

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;

  if (!token || !dbId) {
    return NextResponse.json({ tasks: [] }, { status: 200 });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Status",
          status: { equals: "To Do" },
        },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 8,
      }),
      next: { revalidate: 300 },
    });

    const data = await res.json();

    const tasks = (data.results || []).map((page: any) => {
      const titleProp = Object.values(page.properties).find(
        (p: any) => p.type === "title"
      ) as any;
      const title =
        titleProp?.title?.map((t: any) => t.plain_text).join("") || "Untitled";
      return { id: page.id, title };
    });

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: [] });
  }
}
