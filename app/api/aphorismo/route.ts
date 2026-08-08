import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

// Add a quote from the dashboard (footer + button) — creates a page in the same
// Notion database the GET reads, tagged with the same Category so it's in the
// rotation immediately. Also handles the undo path (archive a just-added page).
export async function POST(request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const dbId = "1dbc40abce39802fb289d13710cdacb7"; // Person database (same as GET)
  if (!token) return NextResponse.json({ error: "not_configured" }, { status: 500 });
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
  const body = await request.json().catch(() => ({}));

  // undo an add
  if (body.action === "archive") {
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }
    const res = await fetch(`https://api.notion.com/v1/pages/${body.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ archived: true }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.json() }, { status: res.status });
    return NextResponse.json({ success: true });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "missing_text" }, { status: 400 });

  // "title" is the fixed id of the title property, so this works no matter
  // what the column is actually named in the database.
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST", headers,
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        title: { title: [{ text: { content: text.slice(0, 2000) } }] },
        Category: { select: { name: "aphorismo" } },
      },
    }),
  });
  if (!res.ok) return NextResponse.json({ error: await res.json() }, { status: res.status });
  const page = await res.json();
  return NextResponse.json({ success: true, id: page.id });
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbId = "1dbc40abce39802fb289d13710cdacb7"; // Person database

  if (!token || !dbId) {
    return NextResponse.json({ aphorismo: null });
  }

  try {
    // Query the person database for all entries
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        filter: {
          property: "Category",
          select: {
            equals: "aphorismo"
          }
        }
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("Notion API error:", error);
      return NextResponse.json({ aphorismo: null });
    }

    const data = await res.json();
    const results = data.results || [];

    // Extract titles from all database entries
    const aphorisms = results
      .map((page: any) => {
        const titleProp = Object.values(page.properties).find(
          (p: any) => p.type === "title"
        ) as any;
        return titleProp?.title?.map((t: any) => t.plain_text).join("") || "";
      })
      .filter((text: string) => text.length > 0);

    if (aphorisms.length === 0) {
      return NextResponse.json({ aphorismo: null, count: 0 });
    }

    // Return a random aphorism
    const randomIndex = Math.floor(Math.random() * aphorisms.length);
    return NextResponse.json({
      aphorismo: aphorisms[randomIndex],
      count: aphorisms.length,
    });
  } catch (error) {
    console.error("Error fetching aphorismo:", error);
    return NextResponse.json({ aphorismo: null, count: 0 });
  }
}
