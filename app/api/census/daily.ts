import { mailboxOf, type Gmail } from "./gmail";
import { censusDays, readWorkbook, type Sheet } from "./parse";
import { movesSince, readMoves, type MoveCount } from "./moves";
import { censusChartPng } from "./chart";
import { CHART_CID, composeDaily, sendMail, type DailyReport } from "./mail";
import type { Every } from "./vault";

// Finding the census report in the inbox, and putting the daily email together
// from it.
//
// The email compares two reports: the newest one and the one sent before it.
// The count in a morning report is last night's count carried forward, and
// the day's arrivals and departures are only written in by the next morning.
// So "what happened" is whatever the newest workbook has that the one before
// it did not. Comparing the two also means the change in the headline matches
// the number in the email people got the time before.

const SENDER = "ctyler@uvrc.com";

export type ReportRef = { id: string; sent: number; attachmentId: string; filename: string };

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
export const centralDate = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// the sender's newest messages with a spreadsheet attached, newest first
export async function listReports(gm: Gmail): Promise<{ status: number; ids: string[] }> {
  const q = encodeURIComponent(`from:${SENDER} has:attachment filename:xlsx`);
  const list = await gm.get(`/users/me/messages?maxResults=8&q=${q}`);
  if (!list.ok) return { status: list.status, ids: [] };
  return { status: 200, ids: ((await list.json()).messages || []).map((m: { id: string }) => m.id) };
}

// null when the message is not a census report
export async function reportAt(gm: Gmail, id: string): Promise<ReportRef | null> {
  const r = await gm.get(`/users/me/messages/${id}?format=full`);
  if (!r.ok) return null;
  const msg = await r.json();
  const part = findCensusPart(msg.payload);
  return part ? { id, sent: Number(msg.internalDate), attachmentId: part.body!.attachmentId!, filename: part.filename! } : null;
}

// the workbook, in memory only
export async function workbookOf(gm: Gmail, ref: ReportRef): Promise<Uint8Array | null> {
  const att = await gm.get(`/users/me/messages/${ref.id}/attachments/${ref.attachmentId}`);
  if (!att.ok) return null;
  const data: string = (await att.json()).data || "";
  return data ? new Uint8Array(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64")) : null;
}

// Real mail goes out from the live site only: never from a dev server on a
// laptop or a preview build, where a half-finished change could reach people.
// CENSUS_MAIL=off stops it everywhere.
export function canMail(): boolean {
  if (process.env.CENSUS_MAIL === "off") return false;
  if (process.env.CENSUS_MAIL === "test") return true;
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
}

/**
 * @param book     the newest report's workbook, already open
 * @param olderIds message ids older than the newest report, newest first; the
 *                 first census report among them is the one to compare with
 */
export async function buildDaily(gm: Gmail, newest: ReportRef, book: Sheet[], olderIds: string[]): Promise<DailyReport | null> {
  const reportDate = centralDate(newest.sent);
  const days = censusDays(book, reportDate).days;
  if (!days.length) return null;
  const now = days.find((d) => d.date === reportDate) || days[days.length - 1];
  const movesNow = readMoves(book, reportDate);

  let before: DailyReport["before"] = null;
  let moves: MoveCount | null = null;

  for (const id of olderIds) {
    const ref = await reportAt(gm, id);
    if (!ref) continue;
    const bytes = await workbookOf(gm, ref);
    if (bytes) {
      try {
        const thenDate = centralDate(ref.sent);
        const thenBook = readWorkbook(bytes);
        const thenDays = censusDays(thenBook, thenDate).days;
        const head = thenDays.find((d) => d.date === thenDate) || thenDays[thenDays.length - 1];
        if (head) {
          before = { date: thenDate, day: head, fromReport: true };
          // two weeks back, so a move written in late still gets told once
          moves = movesSince(movesNow, readMoves(thenBook, thenDate), addDays(thenDate, -14), reportDate);
        }
      } catch {}
    }
    break;
  }

  // no earlier report to compare with: fall back to the day before in this workbook
  if (!before || !moves) {
    const prior = addDays(now.date, -1);
    const day = days.find((d) => d.date === prior);
    before = day ? { date: prior, day, fromReport: false } : null;
    moves = movesSince(movesNow, null, now.date, reportDate);
  }

  return { reportDate, sentAt: newest.sent, now, before, moves, series: days.filter((d) => d.date <= now.date).slice(-30) };
}

// ---------- the weekly and monthly emails ----------
//
// Besides the email that goes with every report, the owner can put someone on
// a weekly or a monthly one. It is the same email compared with an older
// report: the weekly with the report from the week before, the monthly with
// the first report of the month before, so each one picks up where the last
// one left off. Each goes out once per period, with the period's first report
// that is seen on the day it was sent:
//
//   week   Weeks start on Friday, so Friday's report sends it. A Friday with
//          no report (a holiday), or one first seen the next day, sends it
//          with the next report instead.
//   month  The first report of the month sends it: on the 1st, or the next
//          weekday when the 1st is a weekend or a holiday.
//
// `weekly` and `monthly` in census-status say which period's email is done.

const FRIDAY = 5;
const pad2 = (n: number) => String(n).padStart(2, "0");

// the Friday on or before a day
export function fridayOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((dow - FRIDAY + 7) % 7));
}

type Slow = Exclude<Every, "day">;

// the period a day falls in: the Friday its week starts on, or its month
export const periodOf = (every: Slow, date: string) => (every === "week" ? fridayOf(date) : date.slice(0, 7));

// the first day of that period
export const periodStart = (every: Slow, date: string) => (every === "week" ? fridayOf(date) : `${date.slice(0, 7)}-01`);

// the first day of the period before it
export function periodBefore(every: Slow, date: string): string {
  const start = periodStart(every, date);
  if (every === "week") return addDays(start, -7);
  const [y, m] = start.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${pad2(m - 1)}-01`;
}

// the same day a month earlier (Mar 31 -> Feb 28)
function monthBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${pad2(pm)}-${pad2(Math.min(d, new Date(Date.UTC(py, pm, 0)).getUTCDate()))}`;
}

/**
 * Is the weekly or monthly email due with a report sent on `date`?
 * @param done     the period whose email is done (from census-status)
 * @param lastDate the day the report before this one was sent, if known
 * @param mailedOn the day the last email of any kind went out, if any
 */
export function isDue(every: Slow, date: string, done: string | undefined, lastDate: string | null, mailedOn: string | null): boolean {
  if (done) return done < periodOf(every, date);
  // Nothing written down yet: this is the first report since the schedules
  // began. It sends only if it opens its period: the report before it, or
  // the last email of any kind, came before the period started.
  const start = periodStart(every, date);
  return (!!lastDate && lastDate < start) || (!!mailedOn && mailedOn < start);
}

// The first census report sent on or after `from` and before `until`, both
// days in Central time: the one a weekly or monthly email compares with.
export async function reportFrom(gm: Gmail, from: string, until: string): Promise<ReportRef | null> {
  // Gmail takes the window in seconds; a day of slack on each side for the
  // time zone, then the exact cut by the Central date
  const after = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000) - 86400;
  const before = Math.floor(Date.parse(`${until}T00:00:00Z`) / 1000) + 86400;
  const q = encodeURIComponent(`from:${SENDER} has:attachment filename:xlsx after:${after} before:${before}`);
  const list = await gm.get(`/users/me/messages?maxResults=50&q=${q}`);
  if (!list.ok) return null;
  const ids: string[] = ((await list.json()).messages || []).map((m: { id: string }) => m.id);
  // Gmail lists newest first; the one wanted is near the oldest end
  for (let i = ids.length - 1; i >= 0; i--) {
    const ref = await reportAt(gm, ids[i]);
    if (!ref) continue;
    const day = centralDate(ref.sent);
    if (day >= from && day < until) return ref;
  }
  return null;
}

/**
 * The email for one schedule, built from the newest report.
 * @param test what it would say if it went out now: the weekly against the
 *             report a week before the newest, the monthly against the
 *             report a month before
 */
export async function buildFor(gm: Gmail, every: Every, newest: ReportRef, book: Sheet[], olderIds: string[], test = false): Promise<DailyReport | null> {
  if (every === "day") return buildDaily(gm, newest, book, olderIds);
  const date = centralDate(newest.sent);
  const from = test ? (every === "week" ? addDays(date, -7) : monthBefore(date)) : periodBefore(every, date);
  const until = test ? date : periodStart(every, date);
  const base = await reportFrom(gm, from, until);
  // no report at all in that span: compare with the report before, as the daily does
  return buildDaily(gm, newest, book, base ? [base.id] : olderIds);
}

// the owner first, then anyone they added
export async function recipients(gm: Gmail, extras: string[]): Promise<string[]> {
  const self = await mailboxOf(gm);
  return self ? [self, ...extras.filter((a) => a !== self)] : [];
}

export type Draft = { subject: string; text: string; html: string; png: Uint8Array | null };

// the finished email, graph and all, not yet sent. Pass `png` to reuse a
// graph already drawn: every schedule's email shows the same 30 days.
export async function draftDaily(report: DailyReport, opts: { every?: Every; png?: Uint8Array | null } = {}): Promise<Draft> {
  const png = opts.png !== undefined ? opts.png : await censusChartPng(report.series);
  return { ...composeDaily(report, { chartCid: png ? CHART_CID : null, every: opts.every }), png };
}

// Has an email with exactly this subject already gone out from this mailbox?
// The subject carries the schedule, the day and the count, so it is one per
// report and schedule. The Sent folder is the one record that cannot be
// wrong about what was sent: it
// catches a send that worked but was never written down, and a second run
// that slipped past the claim in sync/route.ts.
export async function sentAlready(gm: Gmail, subject: string): Promise<boolean> {
  try {
    const q = encodeURIComponent(`in:sent newer_than:2d subject:"${subject.replace(/"/g, "")}"`);
    // the search matches words, so the weekly, the monthly, and "Test:" copies
    // of the day's email can turn up too; the exact subject is checked below
    const list = await gm.get(`/users/me/messages?maxResults=10&q=${q}`);
    if (!list.ok) return false;
    for (const m of ((await list.json()).messages || []) as { id: string }[]) {
      const one = await gm.get(`/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject`);
      if (!one.ok) continue;
      const headers = ((await one.json()).payload?.headers || []) as { name: string; value: string }[];
      if (headers.some((h) => h.name.toLowerCase() === "subject" && h.value.trim() === subject)) return true;
    }
  } catch {}
  return false;
}

export async function sendDraft(gm: Gmail, draft: Draft, to: string[]): Promise<{ ok: boolean; status: number; chart: boolean }> {
  const sent = await sendMail(gm, { to, ...draft });
  return { ...sent, chart: !!draft.png };
}
