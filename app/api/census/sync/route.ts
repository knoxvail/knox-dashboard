import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, preflight } from "../../blake/shared";
import { boardClient, gmailWith, opensTriadMailbox, type Gmail } from "../gmail";
import { censusDays, readWorkbook, type Sheet } from "../parse";
import { archiveCensusRow, createCensusDay, loadCensus, sameDay, updateCensusDay, type CensusRow } from "../shared";
import { mailExtras, mailIsOn, readMemory, rememberLogin, savedLogin, saveStatus, saveStatusFresh, type Memory, type StatusNote } from "../vault";
import { buildDaily, canMail, centralDate, draftDaily, listReports, recipients, reportAt, sendDraft, sentAlready, workbookOf, type ReportRef } from "../daily";

// Pulls the newest census report out of the Triad inbox, logs it, and sends
// the daily census email for it.
//
// The Health Center census workbook is emailed every weekday morning. This
// route finds the latest message, downloads the .xlsx in memory, reads the
// four total rows per day, and writes any new or corrected days to the Notion
// log. The first time it sees a report, on the day that report was sent, it
// also sends the daily email (see daily.ts and mail.ts): once per report,
// whoever gets there first.
//
// Two kinds of caller:
//
//   The board. A request that carries the dashboard's Gmail cookies, once
//   Gmail itself confirms they open a Triad mailbox. It reads with those
//   cookies and re-reads the whole year every time, unless it asks for
//   ?light=1 (its ten-minute morning look, which stops early like the job
//   does). It may ask for ?dry=1 (parse and return the days, write nothing,
//   send nothing). If the owner has turned the saved login on
//   (/api/census/job), a new sign-in also replaces the login the job holds,
//   sealed (see vault.ts).
//
//   Everyone else: the Vercel cron (vercel.json, a few times an hour through
//   the morning), Blake's page or the census tracker asking for fresh
//   numbers, or a stranger. There are no cookies to trust, so the job
//   reads with the saved login, if the owner has turned one on; otherwise it
//   answers "not connected" and does nothing. It runs at most once every five
//   minutes, stops early when the newest report is one it has already logged
//   and mailed (?full=1 re-reads anyway), and only ever answers with counts
//   and dates.
//
// Writes are capped per call to stay inside the function time limit;
// `remaining` says whether to call again.

export const revalidate = 0;
export const maxDuration = 60;

const WRITE_LIMIT = 90;
const CONCURRENCY = 3;
const JOB_GAP_MS = 5 * 60 * 1000;
const MAIL_CLAIM_MS = 10 * 60 * 1000;
const MAIL_TRIES = 5;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

// "<report id>#<n>": how many times the email for this report has failed
const triesFor = (status: StatusNote, id: string) => {
  const [of, n] = (status.mailTry || "").split("#");
  return of === id ? Number(n) || 0 : 0;
};

// "<report id>@<time>#<run>": which run has claimed the send for a report
const claimOf = (s?: string) => {
  const m = (s || "").match(/^([^@]+)@([^#]+)(?:#(.*))?$/);
  return m ? { id: m[1], at: Date.parse(m[2]) || 0, run: m[3] || "" } : null;
};

// how long a run waits for a rival's claim to land before it reads its own back
const settleMs = () => Number(process.env.CENSUS_MAIL_SETTLE_MS || 3000);

// Sends the daily email for one report, unless another run already has.
// Returns what happened and what to write down about it.
//
// Two dashboards open at once (two tabs, a laptop and a phone) wake up and
// sync in the same second, and both see a report nobody has emailed yet. The
// first version of this checked for a claim, then wrote one; both runs
// checked before either wrote, and the email went out twice. Notion has no
// "write only if unchanged", so the guard is in three parts:
//
//   1. Each run writes its own claim, waits a few seconds, and reads the
//      note back. Notion keeps whichever claim was written last, so every
//      run but one finds a stranger's claim there and stands down.
//   2. Before sending, the run asks Gmail whether this exact subject has
//      already left this mailbox. The Sent folder is the record that cannot
//      be wrong, and it also heals a note that was overwritten.
//   3. The dashboard itself lets only one tab in a browser sync at a time
//      (see page.tsx).
async function mailOut(
  gm: Gmail,
  notionToken: string,
  mem: Memory,
  found: ReportRef,
  book: Sheet[],
  olderIds: string[]
): Promise<{ result: "sent" | "failed" | "skipped"; patch: Partial<StatusNote> }> {
  const skipped = (patch: Partial<StatusNote> = {}) => ({ result: "skipped" as const, patch });

  // The checks and the log writes above took a while. Look again. Without a
  // fresh look there is no telling what another run is doing, so do not send.
  const fresh = await readMemory(notionToken);
  if (!fresh) return skipped();
  mem.status = fresh.status;
  mem.mail = fresh.mail;
  if (!mailIsOn(fresh) || fresh.status.data.mailed === found.id) return skipped();
  const rival = claimOf(fresh.status.data.mailing);
  if (rival && rival.id === found.id && Date.now() - rival.at < MAIL_CLAIM_MS) return skipped();

  const claim = `${found.id}@${new Date(Date.now()).toISOString()}#${Math.random().toString(36).slice(2, 10)}`;
  await saveStatus(notionToken, mem, { mailing: claim });
  await new Promise((r) => setTimeout(r, settleMs()));
  const settled = await readMemory(notionToken);
  if (!settled || settled.status.data.mailing !== claim || settled.status.data.mailed === found.id) return skipped();
  mem.status = settled.status;
  mem.mail = settled.mail;

  const failed = (why: string) => ({
    result: "failed" as const,
    patch: { mailing: "", mailNote: why, mailTry: `${found.id}#${triesFor(mem.status.data, found.id) + 1}` },
  });
  try {
    const report = await buildDaily(gm, found, book, olderIds);
    if (!report) return failed("nothing_to_send");
    const to = await recipients(gm, mailExtras(mem));
    if (!to.length) return failed("no_mailbox");
    const draft = await draftDaily(report);
    // already in Sent: it went out, whatever the note says. Write that down.
    if (await sentAlready(gm, draft.subject)) return skipped({ mailed: found.id, mailing: "", mailTry: "" });
    const sent = await sendDraft(gm, draft, to);
    if (!sent.ok) return failed(`gmail_said_${sent.status}`);
    return {
      result: "sent",
      patch: { mailed: found.id, mailedAt: new Date(Date.now()).toISOString(), mailedTo: to.length, mailing: "", mailTry: "", mailNote: sent.chart ? "sent" : "sent_without_graph" },
    };
  } catch (e) {
    console.error("census mail", e);
    return failed("mail_failed");
  }
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) return NextResponse.json({ error: "not configured" }, { status: 500, headers: cors });

  const ask = req.nextUrl.searchParams;
  const cookieRefresh = req.cookies.get("gmail_refresh_token")?.value || "";

  // 0. who is asking: the signed-in dashboard, or anyone else
  const board = await boardClient(req);

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
  const stamp = () => new Date(Date.now()).toISOString();
  const dry = ask.get("dry") === "1";
  const full = (!!board && ask.get("light") !== "1") || ask.get("full") === "1";
  let remembered = !!(mem && savedLogin(mem));
  let gm: Gmail;

  if (board) {
    gm = board;
    // Keep the job's login current. This never creates one: the owner turns the
    // saved login on at /api/census/job, and only then does a block with a
    // login exist here. After that, a new sign-in replaces the old login, once
    // the refresh token has proven by itself that it opens a Triad mailbox.
    if (!dry && mem && mem.login.data.login && cookieRefresh && savedLogin(mem) !== cookieRefresh) {
      if (await opensTriadMailbox(cookieRefresh)) remembered = await rememberLogin(notionToken, mem, cookieRefresh);
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
    if (mem && !dry) await saveStatusFresh(notionToken, mem, patch);
  };

  try {
    // 1. the newest message that carries the census workbook
    const list = await listReports(gm);
    if (list.status === 401) {
      if (!board) await note({ note: gm.denied() ? "gmail_login_rejected" : "gmail_unreachable" });
      return reply({ error: "gmail_not_connected" }, 401);
    }
    if (list.status !== 200) return reply({ error: "gmail_list_failed" }, 502);

    let found: ReportRef | null = null;
    let at = -1;
    for (let i = 0; i < list.ids.length; i++) {
      const ref = await reportAt(gm, list.ids[i]);
      if (ref) {
        found = ref;
        at = i;
        break;
      }
    }
    if (!found) {
      await note({ checked: stamp(), by, note: "no_census_email" });
      return reply({ error: "no_census_email" }, 404);
    }

    const reportDate = centralDate(found.sent);

    // The daily email goes out once for each report, and only on the day the
    // report was sent. A report first seen on a later day (nothing was running
    // that day, or every send failed) is noted as handled and not sent:
    // nobody wants yesterday's count once today's is on its way.
    const status = mem ? mem.status.data : null;
    const mailOn = canMail() && !dry && !!mem && mailIsOn(mem);
    const unsent = mailOn && status!.mailed !== found.id;
    const mailStale = unsent && reportDate !== centralDate(Date.now());
    const mailDue = unsent && !mailStale && triesFor(status!, found.id) < MAIL_TRIES;
    const logged = !!status && status.report === found.id;

    // nothing new since the last complete run: the log already matches this
    // report, and its email has gone
    if (!full && logged && !mailDue) {
      await note({ checked: stamp(), by, note: "ok", ...(mailStale ? { mailed: found.id } : {}) });
      return reply({ ok: true, unchanged: true, reportDate, through: status!.through || null, written: 0, remaining: 0 });
    }

    // 2. the workbook, in memory only
    const bytes = await workbookOf(gm, found);
    if (!bytes) return reply({ error: "attachment_failed" }, 502);
    const book = readWorkbook(bytes);
    const parsed = censusDays(book, reportDate);
    const latest = parsed.days[parsed.days.length - 1] || null;

    if (dry) return reply({ dry: true, reportDate, filename: found.filename, sheets: parsed.sheets, days: parsed.days });
    if (!parsed.days.length) {
      await note({ checked: stamp(), by, note: "nothing_parsed" });
      return reply({ error: "nothing_parsed", reportDate, sheets: parsed.sheets }, 422);
    }

    // 3. write what is new or changed, unless this report is already in the
    // log and the only thing left to do is the email
    let written = 0;
    let failed = 0;
    let remaining = 0;
    if (full || !logged) {
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
      const source = `Census report of ${reportDate}`;

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
      remaining = Math.max(0, todo.length - written - failed);
    }
    const complete = failed === 0 && remaining === 0;

    // 4. the daily email, the first time this report is seen
    let mail: "sent" | "failed" | "skipped" | undefined;
    let mailPatch: Partial<StatusNote> = mailStale ? { mailed: found.id } : {};
    if (mailDue && mem) {
      const out = await mailOut(gm, notionToken, mem, found, book, list.ids.slice(at + 1));
      mail = out.result;
      mailPatch = out.patch;
    }

    await note({
      checked: stamp(),
      by,
      // only a report that is fully in the log lets the next job run stop early
      report: complete ? found.id : "",
      reportDate,
      through: latest?.date,
      note: complete ? "ok" : failed ? "some_days_failed_to_write" : "more_days_to_write",
      ...mailPatch,
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
      ...(mail ? { mail } : {}),
      ...(board ? { remembered } : {}),
    });
  } catch (e) {
    console.error("census sync", e);
    return reply({ error: "sync_failed" }, 502);
  }
}
