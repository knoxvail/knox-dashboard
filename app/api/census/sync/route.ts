import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, preflight } from "../../blake/shared";
import { gmailWith, mailboxOf, refreshAccess, type Gmail } from "../gmail";
import { parseCensusWorkbook } from "../parse";
import { archiveCensusRow, createCensusDay, loadCensus, sameDay, updateCensusDay, type CensusRow } from "../shared";
import { readMemory, rememberLogin, savedLogin, saveStatus } from "../vault";

// Pulls the newest census report out of the Triad inbox and logs it.
//
// Carmen Tyler emails the Health Center census workbook every weekday
// morning. This route finds her latest message, downloads the .xlsx in
// memory, reads the four total rows per day, and writes any new or corrected
// days to the Notion log.
//
// Two kinds of caller:
//
//   The board. A request that carries the dashboard's Gmail cookies, once
//   Gmail itself confirms they open a Triad mailbox. It reads with those
//   cookies, re-reads the whole year every time, and may ask for ?dry=1
//   (parse and return the days, write nothing). It also leaves its login
//   with the job, sealed (see vault.ts), which is what makes the next kind
//   of caller work.
//
//   Everyone else: the Vercel cron (vercel.json, three times a day), Blake's
//   page asking for fresh numbers, or a stranger. There are no cookies to
//   trust, so the job reads with the login the board left behind. It runs at
//   most once every five minutes, stops early when Carmen's newest report is
//   one it has already logged (?full=1 re-reads anyway), and only ever
//   answers with counts and dates.
//
// Writes are capped per call to stay inside the function time limit;
// `remaining` says whether to call again.

export const revalidate = 0;
export const maxDuration = 60;

const SENDER = "ctyler@uvrc.com";
const BOARD_MAILBOX = /@triadsl\.com$/;
const WRITE_LIMIT = 90;
const CONCURRENCY = 3;
const JOB_GAP_MS = 5 * 60 * 1000;

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

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) return NextResponse.json({ error: "not configured" }, { status: 500, headers: cors });

  const ask = req.nextUrl.searchParams;
  const cookieAccess = req.cookies.get("gmail_access_token")?.value || "";
  const cookieRefresh = req.cookies.get("gmail_refresh_token")?.value || "";

  // 0. who is asking. Cookies only count once Gmail says whose mailbox they
  // open; anyone can send a cookie, and a login for some other mailbox must
  // never feed this log or become the job's login.
  let board: Gmail | null = null;
  if (cookieAccess || cookieRefresh) {
    const mine = gmailWith(cookieAccess, cookieRefresh);
    if (BOARD_MAILBOX.test(await mailboxOf(mine))) board = mine;
  }

  const reply = (body: Record<string, unknown>, status = 200) => {
    const res = NextResponse.json({ ...body, mode: board ? "board" : "job" }, { status, headers: cors });
    // a renewed token goes back into the board's own cookie; one minted from
    // the saved login never leaves the server
    const nt = board?.refreshedToken();
    if (nt) {
      res.cookies.set({ name: "gmail_access_token", value: nt, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  };

  const mem = await readMemory(notionToken);
  const stamp = () => new Date().toISOString();
  const dry = ask.get("dry") === "1";
  const full = !!board || ask.get("full") === "1";
  let remembered = !!(mem && savedLogin(mem));
  let gm: Gmail;

  if (board) {
    gm = board;
    // Leave this login with the job. Only when it is a new one, and only after
    // the refresh token has proven by itself that it opens a Triad mailbox.
    if (!dry && mem && cookieRefresh && savedLogin(mem) !== cookieRefresh) {
      const fresh = await refreshAccess(cookieRefresh);
      if (fresh.token && BOARD_MAILBOX.test(await mailboxOf(gmailWith(fresh.token, "")))) {
        remembered = await rememberLogin(notionToken, mem, cookieRefresh);
      }
    }
  } else {
    if (dry) return reply({ error: "sign_in_first" }, 401);
    if (!mem) return reply({ error: "notion" }, 502);
    const login = savedLogin(mem);
    if (!login) return reply({ error: "gmail_not_connected" }, 401);
    const last = Date.parse(mem.status.data.serverRun || "") || 0;
    if (Date.now() - last < JOB_GAP_MS) return reply({ ok: true, skipped: true, through: mem.status.data.through || null });
    // claim the slot before the slow part, so a second ask right behind this one backs off
    await saveStatus(notionToken, mem, { serverRun: stamp() });
    gm = gmailWith("", login);
  }

  const by = board ? "board" : "job";
  const note = async (patch: Parameters<typeof saveStatus>[2]) => {
    if (mem && !dry) await saveStatus(notionToken, mem, patch);
  };

  try {
    // 1. her newest message that carries the census workbook
    const q = encodeURIComponent(`from:${SENDER} has:attachment filename:xlsx`);
    const list = await gm.get(`/users/me/messages?maxResults=8&q=${q}`);
    if (list.status === 401) {
      if (!board) await note({ note: gm.denied() ? "gmail_login_rejected" : "gmail_unreachable" });
      return reply({ error: "gmail_not_connected" }, 401);
    }
    if (!list.ok) return reply({ error: "gmail_list_failed" }, 502);
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
    if (!found) {
      await note({ checked: stamp(), by, note: "no_census_email" });
      return reply({ error: "no_census_email" }, 404);
    }

    const reportDate = centralDate(found.sent);

    // nothing new since the last complete run: the log already matches this report
    if (!full && mem && mem.status.data.report === found.id) {
      await note({ checked: stamp(), by, note: "ok" });
      return reply({ ok: true, unchanged: true, reportDate, through: mem.status.data.through || null, written: 0, remaining: 0 });
    }

    // 2. the workbook, in memory only
    const att = await gm.get(`/users/me/messages/${found.id}/attachments/${found.attachmentId}`);
    if (!att.ok) return reply({ error: "attachment_failed" }, 502);
    const data: string = (await att.json()).data || "";
    const bytes = new Uint8Array(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

    const parsed = parseCensusWorkbook(bytes, reportDate);
    const latest = parsed.days[parsed.days.length - 1] || null;

    if (dry) return reply({ dry: true, reportDate, filename: found.filename, sheets: parsed.sheets, days: parsed.days });
    if (!parsed.days.length) {
      await note({ checked: stamp(), by, note: "nothing_parsed" });
      return reply({ error: "nothing_parsed", reportDate, sheets: parsed.sheets }, 422);
    }

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

    const remaining = Math.max(0, todo.length - written - failed);
    const complete = failed === 0 && remaining === 0;
    await note({
      checked: stamp(),
      by,
      // only a report that is fully in the log lets the next job run stop early
      report: complete ? found.id : "",
      reportDate,
      through: latest?.date,
      note: complete ? "ok" : failed ? "some_days_failed_to_write" : "more_days_to_write",
    });

    return reply({
      ok: true,
      reportDate,
      parsedDays: parsed.days.length,
      written,
      failed,
      remaining,
      latest,
      through: latest?.date || null,
      ...(board ? { remembered } : {}),
    });
  } catch (e) {
    console.error("census sync", e);
    return reply({ error: "sync_failed" }, 502);
  }
}
