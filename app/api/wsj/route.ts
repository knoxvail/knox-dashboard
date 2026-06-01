import { NextResponse } from "next/server";

export const revalidate = 0; // always fetch fresh

export async function GET() {
  try {
    const res = await fetch(
      "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
      { cache: "no-store" }
    );
    const xml = await res.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 7);

    const headlines = items.map((match) => {
      const block = match[1];
      const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        || block.match(/<title>(.*?)<\/title>/)?.[1]
        || "";
      const link = block.match(/<link>(.*?)<\/link>/)?.[1]
        || block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
        || "#";
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

      const date = pubDate
        ? new Date(pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";

      return { title: title.trim(), link: link.trim(), date };
    });

    return NextResponse.json({ headlines });
  } catch {
    return NextResponse.json({ headlines: [] });
  }
}
