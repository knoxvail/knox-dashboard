import { NextRequest, NextResponse } from "next/server";
import { boardClient, opensTriadMailbox } from "../gmail";
import { forgetLogin, readMemory, rememberLogin, savedLogin, savedLoginOn, type StatusNote } from "../vault";

// The switch for the census job's saved login, and a look at how the job is
// doing.
//
// The census can only sync by itself (the cron, Blake's page) if the job
// holds a Gmail login to read Carmen's report with. Keeping one is the
// owner's choice, made here, from a browser signed in to Triad Gmail on the
// dashboard:
//
//   GET  /api/census/job           where the job stands, with an on/off button
//   POST /api/census/job  turn=on  keep this browser's Gmail login for the job
//   POST /api/census/job  turn=off forget it
//
// The switch is a POST so a link on some other site cannot flip it: the
// dashboard's cookies are SameSite=Lax and do not ride along on a cross-site
// POST, and the Origin is checked as well. A person gets a small page; code
// that asks for JSON gets JSON.

export const revalidate = 0;

type View = {
  signedIn: boolean;
  on: boolean; // a login is saved
  usable: boolean; // and the server can still open it
  blocked: boolean; // CENSUS_SAVED_LOGIN=off
  status: StatusNote | null;
  did: string; // what the last button press did
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
};

// what stopped the last run, in plain words
function trouble(note?: string): string {
  if (!note || note === "ok") return "";
  if (note === "gmail_login_rejected") {
    return "Google stopped accepting the saved sign-in. Reconnect Triad Gmail on the dashboard and load the dashboard once. The job picks up the new sign-in by itself.";
  }
  if (note === "no_census_email") return "The last check found no census email from Carmen in the inbox.";
  return `The last check stopped early (${note}). It tries again on the next run.`;
}

function page(v: View): string {
  const button = (turn: "on" | "off", label: string, primary: boolean) =>
    `<form method="post" action="/api/census/job"><input type="hidden" name="turn" value="${turn}"><button type="submit"${primary ? ' class="primary"' : ""}>${label}</button></form>`;
  const home = '<a href="/">Back to the dashboard</a>';
  const did = DID[v.did] ? `<p class="did" role="status">${esc(DID[v.did])}</p>` : "";

  let title = "Census job";
  let body = "";
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
    const s = v.status || { kind: "census-status" as const };
    const checked = centralTime(s.checked);
    const through = dayLabel(s.through);
    const line = checked
      ? `Last check: ${esc(checked)}.${through ? ` The log runs through ${esc(through)}.` : ""}`
      : "It has not run by itself yet. The first check comes with the next scheduled run, or the next time Blake's page is opened.";
    const bad = trouble(s.note);
    body =
      "<p>The dashboard checks Carmen's report by itself: three times a day, and whenever Blake's page is opened. Your dashboard does not need to be open.</p>" +
      `<p>${line}</p>` +
      (bad ? `<p class="did">${esc(bad)}</p>` : "") +
      `<div class="row">${button("off", "Turn off", false)}${home}</div>`;
  } else {
    title = "Census job is off";
    body =
      (v.on
        ? "<p>A sign-in was saved before, but the server can no longer open it. Turn it on again to save a fresh one.</p>"
        : "<p>Right now the census only updates while your dashboard is open.</p>") +
      "<p>Turn it on and the dashboard keeps your Triad Gmail sign-in, encrypted, so it can check Carmen's report with everything closed: three times a day, and whenever Blake's page is opened. It runs one fixed search for her census attachment and reads nothing else. You can turn it off here at any time.</p>" +
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
  p { margin: 0 0 14px; }
  .did { border-left: 3px solid currentColor; padding: 2px 0 2px 12px; font-weight: 600; }
  .row { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; margin-top: 22px; }
  form { margin: 0; }
  button { font: inherit; font-weight: 600; min-height: 44px; padding: 0 20px; border-radius: 10px; border: 1px solid CanvasText; background: Canvas; color: CanvasText; cursor: pointer; }
  button.primary { background: CanvasText; color: Canvas; }
  a { color: LinkText; }
  button:focus-visible, a:focus-visible { outline: 3px solid Highlight; outline-offset: 3px; }
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
${did}
${body}
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

  const res = show(req, { signedIn: true, on: !!mem.login.data.login, usable: !!savedLogin(mem), blocked: !savedLoginOn(), status: mem.status.data, did }, 200);
  const nt = board.refreshedToken();
  if (nt) {
    res.cookies.set({ name: "gmail_access_token", value: nt, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
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
  try {
    const type = req.headers.get("content-type") || "";
    turn = type.includes("application/json") ? String((await req.json())?.turn || "") : String((await req.formData()).get("turn") || "");
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
  return done("", 400);
}
