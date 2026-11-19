import type { CensusDay } from "./parse";
import type { MoveCount } from "./moves";
import type { Gmail } from "./gmail";
import type { Every } from "./vault";
import { chartAlt, shortDay } from "./chart";

// The census email: what it says, how it is laid out, and how it is handed
// to Gmail. The weekly and monthly ones are the same email compared with an
// older report (see daily.ts); only the name and the span change.
//
// Laid out for mail programs, which are far behind browsers: tables for
// structure, every style written on the element, no scripts, no web fonts.
// The numbers are real text, so they read with pictures turned off and in a
// screen reader. The graph is a PNG carried inside the message itself and
// shown in place, not a link to a picture on a server, so it appears without
// a "show images" step and still opens years later.
//
// Counts only. Nothing about a resident is in here.

export type DailyReport = {
  reportDate: string; // the day the report was sent, Central
  sentAt: number; // when, in ms
  now: CensusDay; // the counts it shows for that day
  // what the last report showed for its own day, or (fromReport false) the
  // day before in this same workbook when the last report could not be read
  before: { date: string; day: CensusDay; fromReport: boolean } | null;
  moves: MoveCount; // move-ins and move-outs that are new since `before`
  series: CensusDay[]; // the last 30 days, oldest first, ending at `now`
};

export const TRACKER_URL = process.env.CENSUS_TRACKER_URL || "https://kmvtesting.vercel.app/census/";

const INK = "#14171C";
const MUTED = "#59616B";
const PEN = "#2456A6";
const RULE = "#D5DCE4";
const RULE_STRONG = "#AEB9C5";
const FONT = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const utc = (date: string) => new Date(`${date}T12:00:00Z`);
const weekday = (date: string) => WEEKDAY[utc(date).getUTCDay()];
const dated = (date: string) => `${weekday(date)}, ${shortDay(date)}`;
const daysApart = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// what each schedule's email is called: in the subject, and over the count
const NAMED: Record<Every, { subject: string; title: string }> = {
  day: { subject: "HC census", title: "Health Center census" },
  week: { subject: "Weekly HC census", title: "Weekly HC census" },
  month: { subject: "Monthly HC census", title: "Monthly HC census" },
};

const change = (n: number) => (n === 0 ? "no change" : n > 0 ? `up ${n}` : `down ${-n}`);
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// "yesterday's report", "Friday's report", "last Friday's report", "the Nov 6 report"
function since(r: DailyReport): string {
  if (!r.before) return "";
  if (!r.before.fromReport) return "the day before";
  const gap = daysApart(r.before.date, r.reportDate);
  if (gap <= 0) return "the earlier report today";
  if (gap === 1) return "yesterday's report";
  if (gap <= 6) return `${WEEKDAY_LONG[utc(r.before.date).getUTCDay()]}'s report`;
  if (gap === 7) return `last ${WEEKDAY_LONG[utc(r.before.date).getUTCDay()]}'s report`;
  return `the ${shortDay(r.before.date)} report`;
}

// when the moves happened: "Tue, Nov 17", or "Fri 1, Sun 2" across several
// days of the last week, or "Nov 6: 2, Nov 12: 1" further back. `near` is
// decided once per email, so the move-ins and move-outs read the same way.
function when(days: { date: string; n: number }[], near: boolean): string {
  const hit = days.filter((d) => d.n > 0);
  if (!hit.length) return "";
  if (hit.length === 1) return dated(hit[0].date);
  return hit.map((d) => (near ? `${weekday(d.date)} ${d.n}` : `${shortDay(d.date)}: ${d.n}`)).join(", ");
}

const sentTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(new Date(ms));

type Line = { label: string; value: number; note: string; note2?: string };

function parts(r: DailyReport, every: Every) {
  const { now, before, moves } = r;
  // a month of moves day by day is a wall of dates; the monthly gives totals
  const near = moves.days.every((d) => daysApart(d.date, r.reportDate) <= 6);
  const byDay = (days: { date: string; n: number }[]) => (every === "month" ? "" : when(days, near));
  const delta = before ? now.total - before.day.total : null;
  const from = since(r);

  const payers: Line[] = [];
  const payer = (label: string, key: "private" | "medicaid" | "snf") => {
    const v = now[key];
    if (typeof v !== "number") return;
    const was = before ? before.day[key] : null;
    payers.push({ label, value: v, note: typeof was === "number" ? change(v - was) : "" });
  };
  payer("Private pay", "private");
  payer("Medicaid", "medicaid");
  payer("Skilled", "snf");

  const moved: Line[] = [
    {
      label: "Move-ins",
      value: moves.ins,
      note: byDay(moves.days.map((d) => ({ date: d.date, n: d.ins }))),
      note2: moves.back ? `${moves.back} returning` : "",
    },
    { label: "Move-outs", value: moves.outs, note: byDay(moves.days.map((d) => ({ date: d.date, n: d.outs }))) },
  ];

  // the count can move without anyone moving, and the reader will do the sum
  const uneven = delta !== null && delta !== moves.ins - moves.outs;

  return {
    delta,
    from,
    payers,
    moved,
    uneven,
    day: `${dated(now.date)}, ${utc(now.date).getUTCFullYear()}`,
    headline: delta === null ? "in house." : `in house, ${change(delta)} since ${from}.`,
    movesTitle: from ? `Since ${from}` : "Moves",
    footnote: "Hospital stays and billing days also change the count.",
    source: `From the census report sent ${sentTime(r.sentAt)} Central.`,
  };
}

export function composeDaily(r: DailyReport, opts: { chartCid: string | null; every?: Every }): { subject: string; text: string; html: string } {
  const every = opts.every || "day";
  const name = NAMED[every];
  const p = parts(r, every);
  const { now, moves } = r;

  const subject = `${name.subject}: ${now.total} in house${p.delta === null ? "" : `, ${change(p.delta)}`} (${dated(now.date)})`;

  const preheader =
    p.payers.map((l) => `${l.value} ${l.label.toLowerCase().replace("medicaid", "Medicaid")}`).join(", ") +
    `. ${count(moves.ins, "move-in")} and ${count(moves.outs, "move-out")}${p.from ? ` since ${p.from}` : ""}.`;

  // ---------- plain text ----------
  const width = Math.max(...[...p.payers, ...p.moved].map((l) => l.label.length));
  const row = (l: Line) => {
    const extra = [l.note, l.note2].filter(Boolean).join(", ");
    return `${l.label.padEnd(width)}  ${String(l.value).padStart(3)}${extra ? `   ${extra}` : ""}`;
  };
  const text = [
    `${name.title}, ${p.day}`,
    "",
    `${now.total} ${p.headline}`,
    "",
    ...p.payers.map(row),
    "",
    p.movesTitle,
    ...p.moved.map(row),
    ...(p.uneven ? ["", p.footnote] : []),
    "",
    `Census tracker: ${TRACKER_URL}`,
    p.source,
    "",
  ].join("\n");

  // ---------- html ----------
  const cap = `font-family:${FONT};font-size:13px;line-height:18px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;`;
  const cell = `font-family:${FONT};border-top:1px solid ${RULE};padding:11px 0;vertical-align:top;`;
  const line = (l: Line) =>
    `<tr>` +
    `<td style="${cell}font-size:17px;line-height:26px;color:${INK};">${esc(l.label)}</td>` +
    `<td align="right" style="${cell}padding-left:12px;padding-right:16px;font-size:16px;line-height:26px;color:${MUTED};">${[l.note, l.note2 || ""].filter((s) => s).map(esc).join("<br>") || "&nbsp;"}</td>` +
    `<td align="right" width="44" style="${cell}font-size:22px;line-height:26px;font-weight:600;color:${INK};">${l.value}</td>` +
    `</tr>`;
  const ledger = (lines: Line[]) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-bottom:1px solid ${RULE};">${lines.map(line).join("")}</table>`;

  const headline = p.delta === null ? esc(p.headline) : `in house, <b style="font-weight:600;">${esc(change(p.delta))}</b> since ${esc(p.from)}.`;

  const chart = opts.chartCid
    ? `<tr><td style="${cap}color:${MUTED};padding:0 0 8px;">Last ${r.series.length} days</td></tr>` +
      `<tr><td style="padding:0 0 20px;"><img src="cid:${esc(opts.chartCid)}" width="520" alt="${esc(chartAlt(r.series))}" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
<tr><td align="left" style="padding:20px 16px 32px;">
<!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="border-top:2px solid ${INK};padding:10px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="${cap}color:${INK};">${esc(name.title)}</td>
<td align="right" style="${cap}color:${MUTED};">${esc(p.day)}</td>
</tr></table>
</td></tr>
<tr><td style="font-family:${FONT};font-size:68px;line-height:68px;font-weight:600;letter-spacing:-0.02em;color:${INK};padding:24px 0 4px;">${now.total}</td></tr>
<tr><td style="font-family:${FONT};font-size:18px;line-height:27px;color:${INK};padding:0 0 24px;">${headline}</td></tr>
${chart}
<tr><td>${ledger(p.payers)}</td></tr>
<tr><td style="${cap}color:${MUTED};padding:24px 0 8px;">${esc(p.movesTitle)}</td></tr>
<tr><td>${ledger(p.moved)}</td></tr>
${p.uneven ? `<tr><td style="font-family:${FONT};font-size:16px;line-height:24px;color:${MUTED};padding:10px 0 0;">${esc(p.footnote)}</td></tr>` : ""}
<tr><td style="font-family:${FONT};font-size:17px;line-height:26px;padding:26px 0 0;"><a href="${esc(TRACKER_URL)}" style="color:${PEN};font-weight:600;text-decoration:underline;">Open the census tracker</a></td></tr>
<tr><td style="font-family:${FONT};font-size:17px;line-height:26px;color:${MUTED};padding:8px 0 0;border-bottom:1px solid ${RULE_STRONG};padding-bottom:20px;">${esc(p.source)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

// ---------- handing it to Gmail ----------

const b64 = (s: string | Uint8Array) => Buffer.from(s as any).toString("base64");
const wrap = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export const CHART_CID = "census-graph";

// One message: a plain version, and an HTML version with the graph inside it.
// No From line: Gmail fills in the account the login belongs to, with its name.
export function mimeMessage(m: { to: string[]; subject: string; text: string; html: string; png: Uint8Array | null }): string {
  const alt = `alt_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const rel = `rel_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const part = (type: string, body: string | Uint8Array, extra: string[] = []) =>
    [`Content-Type: ${type}`, "Content-Transfer-Encoding: base64", ...extra, "", wrap(b64(body))].join("\r\n");

  const htmlPart = part("text/html; charset=UTF-8", m.html);
  const rich = m.png
    ? [
        `Content-Type: multipart/related; boundary="${rel}"`,
        "",
        `--${rel}`,
        htmlPart,
        `--${rel}`,
        part('image/png; name="census.png"', m.png, [`Content-ID: <${CHART_CID}>`, 'Content-Disposition: inline; filename="census.png"']),
        `--${rel}--`,
        "",
      ].join("\r\n")
    : htmlPart;

  return [
    `To: ${m.to.join(", ")}`,
    `Subject: ${header(m.subject)}`,
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    part("text/plain; charset=UTF-8", m.text),
    `--${alt}`,
    rich,
    `--${alt}--`,
    "",
  ].join("\r\n");
}

export async function sendMail(
  gm: Gmail,
  m: { to: string[]; subject: string; text: string; html: string; png: Uint8Array | null }
): Promise<{ ok: boolean; status: number }> {
  if (!m.to.length) return { ok: false, status: 0 };
  try {
    const raw = Buffer.from(mimeMessage(m), "utf8").toString("base64url");
    const r = await gm.post("/users/me/messages/send", { raw });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
