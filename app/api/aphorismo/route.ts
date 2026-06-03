import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const pageId = "1dbc40abce39802fb289d13710cdacb7"; // Person page with aphorism child pages

  if (!token || !pageId) {
    return NextResponse.json({ aphorismo: null });
  }

  try {
    // Query all child blocks of the Person page
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("Notion API error:", error);
      return NextResponse.json({ aphorismo: null });
    }

    const data = await res.json();
    const pages = data.results || [];

    // Extract titles from child pages
    const aphorisms = pages
      .filter((block: any) => block.type === "child_page")
      .map((block: any) => block.child_page?.title || "")
      .filter((title: string) => title.length > 0);

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
