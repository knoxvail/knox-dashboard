import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_SCHEDULE_DB_ID;
  if (!token || !dbId) return NextResponse.json({ events: [] });

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Date",
          date: { on_or_after: todayStr },
        },
        sorts: [{ property: "Date", direction: "ascending" }],
        page_size: 10,
      }),
      cache: "no-store",
    });

    const data = await res.json();

    const events = (data.results || []).map((page: any) => {
      const titleProp = Object.values(page.properties).find((p: any) => p.type === "title") as any;
      const title = titleProp?.title?.map((t: any) => t.plain_text).join("") || "Untitled";
      const dateProp = (page.properties as any)["Date"];
      const start = dateProp?.date?.start || "";
      const isDatetime = start.includes("T");
      const type = (page.properties as any)["Type"]?.select?.name || "";

      let displayTime = "";
      let displayDate = "";

      if (start) {
        const d = new Date(start);
        const eventDay = start.split("T")[0];
        const isToday = eventDay === todayStr;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        const isTomorrow = eventDay === tomorrowStr;

        displayDate = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        if (isDatetime) {
          displayTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
        }
      }

      return { id: page.id, title, displayDate, displayTime, type, start };
    });

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}