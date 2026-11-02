import { NextResponse } from "next/server";
import { NOTION, notionHeaders, queryBlake } from "../shared";

// Weekly sweep of Blake's finished items, fired by the Vercel cron in
// vercel.json (Mondays, 12:00 UTC, early morning Pacific). Archives every
// Blake row whose Status is Complete; the files holder is never touched.
// If CRON_SECRET is set in the env, only Vercel's cron (which sends it as a
// bearer token) can trigger this.

export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return NextResponse.json({ error: "not configured" }, { status: 500 });

  try {
    const done = (await queryBlake(token, dbId)).filter((r) => r.done);
    const results = await Promise.all(done.map((r) =>
      fetch(`${NOTION}/pages/${r.id}`, { method: "PATCH", headers: notionHeaders(token), body: JSON.stringify({ archived: true }) })
        .then((x) => x.ok)
    ));
    const cleared = results.filter(Boolean).length;
    console.log(`blake sweep: archived ${cleared}/${done.length}`);
    return NextResponse.json({ ok: true, cleared, failed: done.length - cleared, at: new Date().toISOString() });
  } catch (e) {
    console.error("blake sweep", e);
    return NextResponse.json({ error: "notion" }, { status: 502 });
  }
}
