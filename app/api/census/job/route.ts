import { NextRequest, NextResponse } from "next/server";
import { boardClient, mailboxOf, opensTriadMailbox, type Gmail } from "../gmail";
import { readWorkbook } from "../parse";
import { buildFor, canMail, draftDaily, listReports, reportAt, sendDraft, workbookOf } from "../daily";
import { forgetLogin, mailIsOn, mailPlan, planFrom, readMemory, rememberLogin, savedLogin, savedLoginOn, saveMail, type Every, type StatusNote } from "../vault";

// The owner's page for the census job: the switch for its saved login, the
// census email's settings, and a look at how both are doing.
//
// The census can only sync by itself (the cron, Blake's page) if the job
// holds a Gmail login to read the report with. Keeping one is the owner's
// choice, made here, from a browser signed in to Triad Gmail on the
// dashboard. The email is on from the start and goes to the owner alone, with
// every report; who else gets it, and how often, is also decided here and
// nowhere in the code.
//
//   GET  /api/census/job                 where things stand, with the buttons
//   POST /api/census/job  turn=on        keep this browser's Gmail login for the job
//   POST /api/census/job  turn=off       forget it
//   POST /api/census/job  turn=mail-on   send the census email
//   POST /api/census/job  turn=mail-off  stop sending it
//   POST /api/census/job  turn=mail-to   to=a@x.com every=week, to=b@y.com every=day, ...
//                                        who else gets it and how often, a pair per person
//   POST /api/census/job  turn=mail-test every=day|week|month
//                                        that schedule's email, to the owner alone, now
//
// Every change is a POST so a link on some other site cannot make it: the
// dashboard's cookies are SameSite=Lax and do not ride along on a cross-site
// POST, and the Origin is checked as well. A person gets a small page; code
// that asks for JSON gets JSON.

export const revalidate = 0;
export const maxDuration = 60;

type View = {
  signedIn: boolean;
  on: boolean; // a login is saved
  usable: boolean; // and the server can still open it
  blocked: boolean; // CENSUS_SAVED_LOGIN=off
  status: StatusNote | null;
  did: string; // what the last button press did
  mail?: { on: boolean; plan: { address: string; every: Every }[]; self: string; here: boolean };
  error?: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const centralTime = (iso?: string) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " Central";
};

const dayLabel = (d?: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "";

const DID: Record<string, string> = {
  on: "Done. The census job is on.",
  off: "Done. The census job is off.",
  "needs-login": "Google would not renew this browser's Gmail sign-in. Reconnect Triad Gmail on the dashboard, then try again.",
  blocked: "The saved sign-in is switched off in the server settings (CENSUS_SAVED_LOGIN=off).",
  failed: "Notion did not take the change. Try again in a minute.",
  "mail-on": "Done. The census email is on.",
  "mail-off": "Done. The census email is off.",
  "mail-to": "Saved.",
  "bad-address": "One of those does not look like an email address. Nothing was changed.",
  "mail-test": "Sent. It should be in your inbox now.",
  "mail-test-failed": "The email did not send. Try again in a minute.",
  "mail-not-here": "This copy of the dashboard does not send mail. The live one does.",
};

// what stopped the last run, in plain words
function trouble(note?: string): string {
  if (!note || note === "ok") return "";
  if (note === "gmail_login_rejected") {
    return "Google stopped accepting the saved sign-in. Reconnect Triad Gmail on the dashboard and load the dashboard once. The job picks up the new sign-in by itself.";
  }
  if (note === "no_census_email") return "The last check found no census email in the inbox.";
  return `The last check stopped early (${note}). It tries again on the next run.`;
}

function mailTrouble(note?: string): string {
  if (!note || note === "sent") return "";
  if (note === "sent_without_graph") return "The last email went out without its graph. The numbers were all there.";
  if (/^((weekly|monthly)_)?gmail_said_40[13]$/.test(note)) return "Gmail refused the last send. Reconnect Triad Gmail on the dashboard, then use the button below to send one now.";
  return `The last email did not send (${note}). It tries again on the next check.`;
}

const EVERY: { value: Every; label: string }[] = [
  { value: "day", label: "Every report" },
  { value: "week", label: "Fridays" },
  { value: "month", label: "1st of the month" },
];

const options = (picked: Every) =>
  EVERY.map((e) => `<option value="${e.value}"${e.value === picked ? " selected" : ""}>${e.label}</option>`).join("");

function mailSection(v: View, jobOn: boolean): string {
  const m = v.mail;
  if (!m) return "";
  const s = v.status || { kind: "census-status" as const };
  const button = (turn: string, label: string, primary = false) =>
    `<form method="post" action="/api/census/job"><input type="hidden" name="turn" value="${turn}"><button type="submit"${primary ? ' class="primary"' : ""}>${label}</button></form>`;

  let body = "";
  if (!m.here) {
    body = "<p>This copy of the dashboard does not send mail. The live one does.</p>";
  } else if (!m.on) {
    body = `<p>Off. Nothing is sent.</p><div class="row">${button("mail-on", "Turn on", true)}</div>`;
  } else {
    const sent = centralTime(s.mailedAt);
    const bad = mailTrouble(s.mailNote);
    const has = (e: Every) => m.plan.some((p) => p.every === e);
    const slow = [
      has("week") && s.weeklyAt ? `The Friday email last went out ${esc(centralTime(s.weeklyAt))}.` : "",
      has("month") && s.monthlyAt ? `The monthly email last went out ${esc(centralTime(s.monthlyAt))}.` : "",
    ].filter(Boolean);
    // everyone on the list, then one empty row to add someone
    const rows = [...m.plan, ...(m.plan.length < 12 ? [{ address: "", every: "day" as Every }] : [])];
    const row = (p: { address: string; every: Every }, i: number) =>
      `<div class="who-row">` +
      `<input name="to" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Email address ${i + 1}" value="${esc(p.address)}"${p.address ? "" : ' placeholder="Add an email address"'}>` +
      `<select name="every" aria-label="How often email address ${i + 1} gets it">${options(p.every)}</select>` +
      `</div>`;
    body =
      `<p>On. Each new census report sends an email with the count, the graph, the payer split, and the move-ins and move-outs. You get every one, at ${esc(m.self || "your Triad address")}.</p>` +
      (jobOn
        ? "<p>With your dashboard open and awake it goes out within ten minutes of the report. With it closed, usually within the hour.</p>"
        : "<p>The census job is off, so it only goes out while your dashboard is open: within ten minutes of the report in the morning, or the moment you open the dashboard later in the day.</p>") +
      `<p>${sent ? `Last sent ${esc(sent)}${s.mailedTo ? `, to ${s.mailedTo} ${s.mailedTo === 1 ? "person" : "people"}` : ""}.` : "None sent yet. The first one goes out with the next new report."}${slow.length ? ` ${slow.join(" ")}` : ""}</p>` +
      (bad ? `<p class="did">${esc(bad)}</p>` : "") +
      `<form method="post" action="/api/census/job" class="field">` +
      `<input type="hidden" name="turn" value="mail-to">` +
      `<fieldset><legend>Who else gets it</legend>` +
      `<div class="who-head" aria-hidden="true"><span>Email</span><span>How often</span></div>` +
      rows.map(row).join("") +
      `</fieldset>` +
      `<p class="hint">Fridays: the week since the Friday before. 1st of the month: the month since the last one, sent with the month's first report. To take someone off, clear their address and save.</p>` +
      `<button type="submit">Save</button>` +
      `</form>` +
      `<form method="post" action="/api/census/job" class="field">` +
      `<input type="hidden" name="turn" value="mail-test">` +
      `<label for="test-every">Send yourself a test</label>` +
      `<div class="pair"><select id="test-every" name="every">${options("day")}</select><button type="submit">Send me one now</button></div>` +
      `</form>` +
      `<div class="row">${button("mail-off", "Turn off")}</div>`;
  }
  return `<section><h2>Census email</h2>${body}</section>`;
}

function page(v: View): string {
  const button = (turn: "on" | "off", label: string, primary: boolean) =>
    `<form method="post" action="/api/census/job"><input type="hidden" name="turn" value="${turn}"><button type="submit"${primary ? ' class="primary"' : ""}>${label}</button></form>`;
  const home = '<a href="/">Back to the dashboard</a>';
  const did = DID[v.did] ? `<p class="did" role="status">${esc(DID[v.did])}</p>` : "";

  let title = "Census job";
  let body = "";
  let jobOn = false;
  if (!v.signedIn) {
    body =
      "<p>This browser is not signed in to Triad Gmail on the dashboard. Open the dashboard, connect Gmail there, then come back to this page.</p>" +
      '<div class="row"><a href="/">Open the dashboard</a></div>';
  } else if (v.error) {
    body = `<p>${esc(v.error)}</p><div class="row">${home}</div>`;
  } else if (v.blocked) {
    title = "Census job is off";
    body = `<p>The saved sign-in is switched off in the server settings (CENSUS_SAVED_LOGIN=off). The census only updates while the dashboard is open.</p><div class="row">${home}</div>`;
  } else if (v.on && v.usable) {
    title = "Census job is on";
    jobOn = true;
    const s = v.status || { kind: "census-status" as const };
    const checked = centralTime(s.checked);
    const through = dayLabel(s.through);
    const line = checked
      ? `Last check: ${esc(checked)}.${through ? ` The log runs through ${esc(through)}.` : ""}`
      : "It has not run by itself yet. The first check comes with the next scheduled run, or the next time Blake's page is opened.";
    const bad = trouble(s.note);
    body =
      "<p>The dashboard checks for the census report by itself: about once an hour through the morning, once in the afternoon, and whenever Blake's page or the census tracker is opened. Your dashboard does not need to be open.</p>" +
      `<p>${line}</p>` +
      (bad ? `<p class="did">${esc(bad)}</p>` : "") +
      `<div class="row">${button("off", "Turn off", false)}${home}</div>`;
  } else {
    title = "Census job is off";
    body =
      (v.on
        ? "<p>A sign-in was saved before, but the server can no longer open it. Turn it on again to save a fresh one.</p>"
        : "<p>Right now the census only updates while your dashboard is open.</p>") +
      "<p>Turn it on and the dashboard keeps your Triad Gmail sign-in, encrypted, so it can check for the census report with everything closed: about once an hour through the morning, once in the afternoon, and whenever Blake's page or the census tracker is opened. It runs one fixed search for the census attachment, reads nothing else, and sends nothing but the daily census email below. You can turn it off here at any time.</p>" +
      `<div class="row">${button("on", "Turn on", true)}${home}</div>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; background: Canvas; color: CanvasText; font: 17px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 34rem; margin: 0 auto; padding: 12vh 20px 48px; }
  h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 14px; }
  h2 { font-size: 1.2rem; line-height: 1.3; margin: 0 0 12px; }
  p { margin: 0 0 14px; }
  section { margin-top: 40px; padding-top: 28px; border-top: 1px solid GrayText; }
  .did { border-left: 3px solid currentColor; padding: 2px 0 2px 12px; font-weight: 600; }
  .row { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; margin-top: 22px; }
  form { margin: 0; }
  .field { margin-top: 22px; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  input[type="text"], input[type="email"], select { box-sizing: border-box; width: 100%; font: inherit; min-height: 44px; padding: 8px 12px; border-radius: 10px; border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
  legend { font-weight: 600; padding: 0; margin-bottom: 6px; }
  .who-head, .who-row { display: grid; grid-template-columns: minmax(0, 1fr) 11.5rem; gap: 10px; }
  .who-head { color: GrayText; margin-bottom: 4px; }
  .who-row + .who-row { margin-top: 10px; }
  .pair { display: flex; flex-wrap: wrap; gap: 10px; }
  .pair select { width: 11.5rem; flex: 0 1 auto; }
  @media (max-width: 30rem) {
    .who-head { display: none; }
    .who-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
    .who-row + .who-row { margin-top: 18px; }
  }
  .hint { color: GrayText; margin: 8px 0 12px; }
  button { font: inherit; font-weight: 600; min-height: 44px; padding: 0 20px; border-radius: 10px; border: 1px solid CanvasText; background: Canvas; color: CanvasText; cursor: pointer; }
  button.primary { background: CanvasText; color: Canvas; }
  a { color: LinkText; }
  button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid Highlight; outline-offset: 3px; }
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
${did}
${body}
${v.signedIn && !v.error ? mailSection(v, jobOn) : ""}
</main>
</body>
</html>`;
}

const wantsPage = (req: NextRequest) => (req.headers.get("accept") || "").includes("text/html");

function show(req: NextRequest, v: View, status: number) {
  if (wantsPage(req)) {
    return new NextResponse(page(v), { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const s = v.status;
  return NextResponse.json(
    {
      signedIn: v.signedIn,
      on: v.on && v.usable && !v.blocked,
      ...(v.signedIn && s ? { checked: s.checked || null, by: s.by || null, through: s.through || null, reportDate: s.reportDate || null, note: s.note || null } : {}),
      ...(v.signedIn && v.mail
        ? {
            mail: {
              on: v.mail.on && v.mail.here,
              others: v.mail.plan.length,
              weekly: v.mail.plan.filter((p) => p.every === "week").length,
              monthly: v.mail.plan.filter((p) => p.every === "month").length,
              sent: s?.mailedAt || null,
              note: s?.mailNote || null,
            },
          }
        : {}),
      ...(v.error ? { error: v.error } : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

const blank = (did = ""): View => ({ signedIn: false, on: false, usable: false, blocked: !savedLoginOn(), status: null, did });

export async function GET(req: NextRequest) {
  const notionToken = process.env.NOTION_TOKEN;
  const did = req.nextUrl.searchParams.get("did") || "";
  const board = await boardClient(req);
  // nothing about the job is shown to a browser that is not the signed-in dashboard
  if (!board) return show(req, blank(did), 401);
  const mem = notionToken ? await readMemory(notionToken) : null;
  if (!mem) return show(req, { ...blank(did), signedIn: true, error: "Notion did not answer. Try again in a minute." }, 502);

  const res = show(
    req,
    {
      signedIn: true,
      on: !!mem.login.data.login,
      usable: !!savedLogin(mem),
      blocked: !savedLoginOn(),
      status: mem.status.data,
      did,
      mail: { on: mailIsOn(mem), plan: mailPlan(mem), self: await mailboxOf(board), here: canMail() },
    },
    200
  );
  const nt = board.refreshedToken();
  if (nt) {
    res.cookies.set({ name: "gmail_access_token", value: nt, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

// One schedule's email as it would go out now, to the owner alone, without
// touching what the job remembers. The subject says "Test", so the real one
// for the day still goes out: the job looks in Sent for the day's exact
// subject before it sends (daily.ts).
async function sendTest(board: Gmail, every: Every): Promise<boolean> {
  const list = await listReports(board);
  for (let i = 0; i < list.ids.length; i++) {
    const ref = await reportAt(board, list.ids[i]);
    if (!ref) continue;
    const bytes = await workbookOf(board, ref);
    if (!bytes) return false;
    const report = await buildFor(board, every, ref, readWorkbook(bytes), list.ids.slice(i + 1), true);
    const self = await mailboxOf(board);
    if (!report || !self) return false;
    const draft = await draftDaily(report, { every });
    return (await sendDraft(board, { ...draft, subject: `Test: ${draft.subject}` }, [self])).ok;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const notionToken = process.env.NOTION_TOKEN;
  const done = (did: string, status = 200) =>
    wantsPage(req)
      ? NextResponse.redirect(new URL(`/api/census/job?did=${did}`, req.url), 303)
      : NextResponse.json({ did }, { status, headers: { "Cache-Control": "no-store" } });

  // a form on another site must not be able to flip this
  const origin = req.headers.get("origin");
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch {}
    if (host !== req.nextUrl.host) return NextResponse.json({ error: "wrong_origin" }, { status: 403 });
  }

  // to and every come in pairs, one pair per row of the list
  let turn = "";
  let to: string[] = [];
  let every: string[] = [];
  const many = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).map((x) => String(x));
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = await req.json();
      turn = String(body?.turn || "");
      to = many(body?.to);
      every = many(body?.every);
    } else {
      const form = await req.formData();
      turn = String(form.get("turn") || "");
      to = many(form.getAll("to"));
      every = many(form.getAll("every"));
    }
  } catch {}

  const board = await boardClient(req);
  if (!board) return wantsPage(req) ? NextResponse.redirect(new URL("/api/census/job", req.url), 303) : NextResponse.json({ error: "sign_in_first" }, { status: 401 });
  const mem = notionToken ? await readMemory(notionToken) : null;
  if (!mem) return done("failed", 502);

  if (turn === "on") {
    if (!savedLoginOn()) return done("blocked", 409);
    const refresh = req.cookies.get("gmail_refresh_token")?.value || "";
    // only a login that proves, by itself, that it opens a Triad mailbox is kept
    if (!(await opensTriadMailbox(refresh))) return done("needs-login", 409);
    return (await rememberLogin(notionToken!, mem, refresh)) ? done("on") : done("failed", 502);
  }
  if (turn === "off") {
    return (await forgetLogin(notionToken!, mem)) ? done("off") : done("failed", 502);
  }
  if (turn === "mail-on" || turn === "mail-off") {
    return (await saveMail(notionToken!, mem, { off: turn === "mail-off" })) ? done(turn) : done("failed", 502);
  }
  if (turn === "mail-to") {
    const plan = planFrom(to, every);
    if (!plan) return done("bad-address", 400);
    return (await saveMail(notionToken!, mem, plan)) ? done("mail-to") : done("failed", 502);
  }
  if (turn === "mail-test") {
    if (!canMail()) return done("mail-not-here", 409);
    const which: Every = every[0] === "week" || every[0] === "month" ? every[0] : "day";
    try {
      return (await sendTest(board, which)) ? done("mail-test") : done("mail-test-failed", 502);
    } catch (e) {
      console.error("census mail test", e);
      return done("mail-test-failed", 502);
    }
  }
  return done("", 400);
}
