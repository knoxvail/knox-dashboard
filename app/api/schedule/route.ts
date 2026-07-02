import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_SCHEDULE_DB_ID;
  if (!token || !dbId) {
    if (debug) return NextResponse.json({ hasToken: !!token, hasDbId: !!dbId });
    return NextResponse.json({ events: [] });
  }

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
        page_size: 20,
      }),
      cache: "no-store",
    });

    const data = await res.json();

    if (debug) {
      const first: any = (data.results || [])[0];
      const rawStart = first?.properties?.Date?.date?.start || "";
      let tzTest = "ok";
      try {
        new Date(rawStart || Date.now()).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
          timeZone: process.env.TZ || "America/Los_Angeles",
        });
      } catch (e: any) {
        tzTest = "THREW: " + String(e?.message || e);
      }
      return NextResponse.json({
        hasToken: true,
        serverNow: now.toISOString(),
        notionStatus: res.status,
        rawCount: (data.results || []).length,
        rawStart,
        startMs: rawStart ? new Date(rawStart).getTime() : null,
        nowMs: now.getTime(),
        keptByFilter: rawStart ? new Date(rawStart).getTime() > now.getTime() : true,
        TZ: process.env.TZ || null,
        tzTest,
      });
    }

    const events = (data.results || [])
      .map((page: any) => {
        const titleProp = Object.values(page.properties).find((p: any) => p.type === "title") as any;
        const title = titleProp?.title?.map((t: any) => t.plain_text).join("") || "Untitled";
        const dateProp = (page.properties as any)["Date"];
        const start = dateProp?.date?.start || "";
        const isDatetime = start.includes("T");

        let displayTime = "";
        let displayDate = "";
        let startMs = 0;

        if (start) {
          const d = new Date(start);
          startMs = d.getTime();
          const eventDay = start.split("T")[0];
          const isToday = eventDay === todayStr;
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];
          const isTomorrow = eventDay === tomorrowStr;

          displayDate = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

          if (isDatetime) {
            const tz = process.env.TZ || "America/Los_Angeles";
            displayTime = d.toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit", hour12: true,
              timeZone: tz
            });
          }
        }

        const type = (page.properties as any)["Type"]?.select?.name || "";
        return { id: page.id, title, displayDate, displayTime, type, startMs, isDatetime };
      })
      .filter((event: any) => {
        if (!event.startMs) return true;
        if (!event.isDatetime) return true; // all-day events stay all day
        return event.startMs > now.getTime(); // timed events disappear once passed
      })
      .map(({ startMs, isDatetime, ...rest }: any) => rest);

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}