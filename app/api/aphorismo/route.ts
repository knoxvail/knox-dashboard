import { NextResponse } from "next/server";

export const revalidate = 0;

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
