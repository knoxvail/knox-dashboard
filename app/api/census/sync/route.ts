import { NextRequest, NextResponse } from "next/server";
import { gmailClient } from "../gmail";
import { parseCensusWorkbook } from "../parse";
import { archiveCensusRow, createCensusDay, loadCensus, sameDay, updateCensusDay, type CensusRow } from "../shared";

// Pulls the newest census report out of the Triad inbox and logs it.
//
// Carmen Tyler emails the Health Center census workbook every morning. This
// route finds her latest message, downloads the .xlsx attachment in memory,
// reads the four total rows per day, and writes any new or corrected days to
// the Notion log. It runs on the caller's Gmail cookies, so it only works
// from a browser signed into the dashboard; the board calls it on its own.
//
// Every run re-reads the whole year, so a day Carmen corrects later is
// corrected here too, and the first run backfills everything. Writes are
// capped per call to stay inside the function time limit; `remaining` says
// whether to call again.
//
// ?dry=1 parses and returns the days without writing anything.

export const revalidate = 0;
export const maxDuration = 60;

const SENDER = "ctyler@uvrc.com";
const WRITE_LIMIT = 90;
const CONCURRENCY = 3;

type Part = { filename?: string; body?: { attachmentId?: string }; parts?: Part[] };

function findCensusPart(p: Part | undefined): Part | null {
  if (!p) return null;
  if (p.filename && /census/i.test(p.filename) && /\.xlsx$/i.test(p.filename) && p.body?.attachmentId) return p;
  for (const c of p.parts || []) {
    const hit = findCensusPart(c);
    if (hit) return hit;
  }
  return null;
}

// University Village is in Tulsa; a report sent at 8am Central is dated that day
const centralDate = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

export async function GET(req: NextRequest) {
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const gm = gmailClient(req);
  if (!gm.connected()) return NextResponse.json({ error: "gmail_not_connected" }, { status: 401 });
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const finish = (body: unknown, status = 200) => {
    const res = NextResponse.json(body, { status });
    const nt = gm.refreshedToken();
    if (nt) {
      res.cookies.set({ name: "gmail_access_token", value: nt, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  };

  try {
    // 1. her newest message that carries the census workbook
    const q = encodeURIComponent(`from:${SENDER} has:attachment filename:xlsx`);
    const list = await gm.get(`/users/me/messages?maxResults=8&q=${q}`);
    if (list.status === 401) return finish({ error: "gmail_not_connected" }, 401);
    if (!list.ok) return finish({ error: "gmail_list_failed" }, 502);
    const ids: string[] = ((await list.json()).messages || []).map((m: { id: string }) => m.id);

    let found: { id: string; sent: number; attachmentId: string; filename: string } | null = null;
    for (const id of ids) {
      const r = await gm.get(`/users/me/messages/${id}?format=full`);
      if (!r.ok) continue;
      const msg = await r.json();
      const part = findCensusPart(msg.payload);
      if (part) {
        found = { id, sent: Number(msg.internalDate), attachmentId: part.body!.attachmentId!, filename: part.filename! };
        break;
      }
    }
    if (!found) return finish({ error: "no_census_email" }, 404);

    // 2. the workbook, in memory only
    const att = await gm.get(`/users/me/messages/${found.id}/attachments/${found.attachmentId}`);
    if (!att.ok) return finish({ error: "attachment_failed" }, 502);
    const data: string = (await att.json()).data || "";
    const bytes = new Uint8Array(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

    const reportDate = centralDate(found.sent);
    const parsed = parseCensusWorkbook(bytes, reportDate);
    const latest = parsed.days[parsed.days.length - 1] || null;

    if (dry) return finish({ dry: true, reportDate, filename: found.filename, sheets: parsed.sheets, days: parsed.days });
    if (!parsed.days.length) return finish({ error: "nothing_parsed", reportDate, sheets: parsed.sheets }, 422);

    // 3. write what is new or changed
    const existing = new Map<string, CensusRow>();
    const extras: string[] = [];
    for (const r of await loadCensus(notionToken)) {
      if (existing.has(r.date)) extras.push(r.id); else existing.set(r.date, r);
    }
    await Promise.all(extras.slice(0, 20).map((id) => archiveCensusRow(notionToken, id)));
    const todo = parsed.days.filter((d) => {
      const e = existing.get(d.date);
      return !e || !sameDay(e, d);
    });
    const batch = todo.slice(0, WRITE_LIMIT);
    const source = `Carmen Tyler report of ${reportDate}`;

    let written = 0;
    let failed = 0;
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const day = batch[next++];
        const e = existing.get(day.date);
        const ok = e ? await updateCensusDay(notionToken, e.id, day, source) : await createCensusDay(notionToken, day, source);
        if (ok) written++; else failed++;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return finish({
      ok: true,
      reportDate,
      parsedDays: parsed.days.length,
      written,
      failed,
      remaining: Math.max(0, todo.length - written - failed),
      latest,
    });
  } catch (e) {
    console.error("census sync", e);
    return finish({ error: "sync_failed" }, 502);
  }
}
