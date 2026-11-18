import { mailboxOf, type Gmail } from "./gmail";
import { censusDays, readWorkbook, type Sheet } from "./parse";
import { movesSince, readMoves, type MoveCount } from "./moves";
import { censusChartPng } from "./chart";
import { CHART_CID, composeDaily, sendMail, type DailyReport } from "./mail";

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

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

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

// the owner first, then anyone they added
export async function recipients(gm: Gmail, extras: string[]): Promise<string[]> {
  const self = await mailboxOf(gm);
  return self ? [self, ...extras.filter((a) => a !== self)] : [];
}

export async function sendDaily(gm: Gmail, report: DailyReport, to: string[]): Promise<{ ok: boolean; status: number; chart: boolean }> {
  const png = await censusChartPng(report.series);
  const mail = composeDaily(report, { chartCid: png ? CHART_CID : null });
  const sent = await sendMail(gm, { to, ...mail, png });
  return { ...sent, chart: !!png };
}
