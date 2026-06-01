import { NextResponse } from "next/server";

export const revalidate = 0; // always fetch fresh

export async function GET() {
  try {
    // Fetch trending stories from Hacker News (reliable, always fresh)
    const topStoriesRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { cache: "no-store" }
    );
    const topStoryIds = await topStoriesRes.json();

    // Get details for top 7 stories
    const headlines = await Promise.all(
      topStoryIds.slice(0, 7).map(async (id: number) => {
        try {
          const storyRes = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            { cache: "no-store" }
          );
          const story = await storyRes.json();

          const now = Math.floor(Date.now() / 1000);
          const ageSeconds = now - (story.time || 0);
          const ageHours = Math.floor(ageSeconds / 3600);

          let dateStr = "";
          if (ageHours < 1) dateStr = "Just now";
          else if (ageHours < 24) dateStr = `${ageHours}h ago`;
          else dateStr = new Date(story.time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return {
            title: story.title || "",
            link: story.url || `https://news.ycombinator.com/item?id=${id}`,
            date: dateStr
          };
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json({ headlines: headlines.filter(Boolean) });
  } catch {
    return NextResponse.json({ headlines: [] });
  }
}
