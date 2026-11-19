import { NextRequest, NextResponse } from "next/server";
import { boardClient, mailboxOf, opensTriadMailbox, type Gmail } from "../gmail";
import { readWorkbook } from "../parse";
import { buildDaily, canMail, draftDaily, listReports, reportAt, sendDraft, workbookOf } from "../daily";
import { addressList, forgetLogin, mailExtras, mailIsOn, readMemory, rememberLogin, savedLogin, savedLoginOn, saveMail, type StatusNote } from "../vault";

// The owner's page for the census job: the switch for its saved login, the
// daily email's settings, and a look at how both are doing.
//
// The census can only sync by itself (the cron, Blake's page) if the job
// holds a Gmail login to read the report with. Keeping one is the owner's
// choice, made here, from a browser signed in to Triad Gmail on the
// dashboard. The daily email is on from the start and goes to the owner
// alone; who else gets it is also decided here, and nowhere in the code.
//
//   GET  /api/census/job                 where things stand, with the buttons
//   POST /api/census/job  turn=on        keep this browser's Gmail login for the job
//   POST /api/census/job  turn=off       forget it
//   POST /api/census/job  turn=mail-on   send the daily email
//   POST /api/census/job  turn=mail-off  stop sending it
//   POST /api/census/job  turn=mail-to   to=a@x.com, b@y.com   who else gets it
//   POST /api/census/job  turn=mail-test send today's email to the owner alone, now
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
  mail?: { on: boolean; extras: string[]; self: string; here: boolean };
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
  "mail-on": "Done. The daily email is on.",
  "mail-off": "Done. The daily email is off.",
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
  if (/^gmail_said_40[13]$/.test(note)) return "Gmail refused the last send. Reconnect Triad Gmail on the dashboard, then use the button below to send one now.";
  return `The last email did not send (${note}). It tries again on the next check.`;
}

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
    const others = m.extras.length;
    const who = `${esc(m.self || "you")}${others ? ` and ${others} other${others === 1 ? "" : "s"}` : ""}`;
    const sent = centralTime(s.mailedAt);
    const bad = mailTrouble(s.mailNote);
    body =
      `<p>On. When a new census report comes in, an email with the count, the graph, the payer split, and the move-ins and move-outs goes to ${who}.</p>` +
      (jobOn
        ? "<p>With your dashboard open and awake it goes out within ten minutes of the report. With it closed, usually within the hour.</p>"
        : "<p>The census job is off, so it only goes out while your dashboard is open: within ten minutes of the report in the morning, or the moment you open the dashboard later in the day.</p>") +
      `<p>${sent ? `Last sent ${esc(sent)}${s.mailedTo ? `, to ${s.mailedTo} ${s.mailedTo === 1 ? "person" : "people"}` : ""}.` : "None sent yet. The first one goes out with the next new report."}</p>` +
      (bad ? `<p class="did">${esc(bad)}</p>` : "") +
      `<form method="post" action="/api/census/job" class="field">` +
      `<input type="hidden" name="turn" value="mail-to">` +
      `<label for="to">Also send it to</label>` +
      `<input id="to" name="to" type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(m.extras.join(", "))}" placeholder="name@example.com, another@example.com">` +
      `<p class="hint">Separate addresses with commas. Leave it empty and it goes to you alone.</p>` +
      `<button type="submit">Save</button>` +
      `</form>` +
      `<div class="row">${button("mail-test", "Send me one now")}${button("mail-off", "Turn off")}</div>`;
  }
  return `<section><h2>Daily census email</h2>${body}</section>`;
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
  input[type="text"] { box-sizing: border-box; width: 100%; font: inherit; min-height: 44px; padding: 8px 12px; border-radius: 10px; border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
  .hint { color: GrayText; margin: 8px 0 12px; }
  button { font: inherit; font-weight: 600; min-height: 44px; padding: 0 20px; border-radius: 10px; border: 1px solid CanvasText; background: Canvas; color: CanvasText; cursor: pointer; }
  button.primary { background: CanvasText; color: Canvas; }
  a { color: LinkText; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid Highlight; outline-offset: 3px; }
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
      ...(v.signedIn && v.mail ? { mail: { on: v.mail.on && v.mail.here, others: v.mail.extras.length, sent: s?.mailedAt || null, note: s?.mailNote || null } } : {}),
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
      mail: { on: mailIsOn(mem), extras: mailExtras(mem), self: await mailboxOf(board), here: canMail() },
    },
    200
  );
  const nt = board.refreshedToken();
  if (nt) {
    res.cookies.set({ name: "gmail_access_token", value: nt, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

// Today's email, to the owner alone, without touching what the job remembers.
// The subject says "Test", so the real one for the day still goes out: the
// job looks in Sent for the day's exact subject before it sends (daily.ts).
async function sendTest(board: Gmail): Promise<boolean> {
  const list = await listReports(board);
  for (let i = 0; i < list.ids.length; i++) {
    const ref = await reportAt(board, list.ids[i]);
    if (!ref) continue;
    const bytes = await workbookOf(board, ref);
    if (!bytes) return false;
    const report = await buildDaily(board, ref, readWorkbook(bytes), list.ids.slice(i + 1));
    const self = await mailboxOf(board);
    if (!report || !self) return false;
    const draft = await draftDaily(report);
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

  let turn = "";
  let to = "";
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = await req.json();
      turn = String(body?.turn || "");
      to = String(body?.to || "");
    } else {
      const form = await req.formData();
      turn = String(form.get("turn") || "");
      to = String(form.get("to") || "");
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
    const list = addressList(to);
    if (!list) return done("bad-address", 400);
    return (await saveMail(notionToken!, mem, { to: list })) ? done("mail-to") : done("failed", 502);
  }
  if (turn === "mail-test") {
    if (!canMail()) return done("mail-not-here", 409);
    try {
      return (await sendTest(board)) ? done("mail-test") : done("mail-test-failed", 502);
    } catch (e) {
      console.error("census mail test", e);
      return done("mail-test-failed", 502);
    }
  }
  return done("", 400);
}
