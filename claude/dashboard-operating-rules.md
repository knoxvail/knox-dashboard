# Dashboard operating rules

How the Notion task database, the dashboard, and the scheduled Cowork routines fit
together. Knox does multifamily and senior living acquisitions with his father, and
runs a web design business on the side (UVRC, Triad).

## Verified IDs

| Thing | ID |
| --- | --- |
| Tasks database | `203c40ab-ce39-8018-88d2-d2a9035be3ed` |
| Tasks data source | `collection://203c40ab-ce39-81aa-bc49-000b70ec35e6` |
| Dashboard board view | `view://3b4c40ab-ce39-8151-91dd-000c38d8fbba` |
| Schedule database | `79a404f0-c021-4c8d-8d0a-f5e76d655224` |
| Schedule data source | `collection://a211b24a-1a65-4cfd-b052-14261468b834` |
| Morning sweep task | `trig_01Ns4xBJhquK87DqmszEfTGQ` |

## Schema

**Tasks**: Name (title), Status (status: Short Term, Long Term, Complete), Type
(select: Client, Action), Dashboard (select: Deal, Client, Admin, Personal, Web),
Open (formula, auto), Deadline (date), Priority (checkbox), Order (number), Notes
(text), Links (text), Assignee (person).

**Schedule**: Name (title), Date (date), Type (select: Meeting, Appointment,
Deadline, Personal), Note (text).

`Type` and `Dashboard` are separate properties and both matter. `Type = "Action"`
is what the dashboard's Today panel reads. `Dashboard` is what places the row on
the Dashboard board view. Setting one without the other means the item shows up in
one place and vanishes from the other.

### The Web bucket

`Dashboard` gained a fifth option, **Web** (green), on 2026-07-06. UVRC, Triad, and
any site or SEO work route there. Before this, web work had to be filed under
Client, which conflated it with acquisitions clients.

## The Type = Action mechanism

The dashboard's Today panel queries the tasks database for rows where
`Type = "Action"`, sorts them by `Order`, and shows one card each. Clicking a card
opens the plan, which is read from that page's **body** (headings, paragraphs,
numbered items), not from a property. The card shows `Notes` as the one line why.

Marking an item done from the dashboard archives the page, same as any task.

### Clearing, not archiving

The Notion MCP connection has no trash or archive for database rows. `update_page`
has no archived flag, and `move_pages` only reparents, which would pull the row out
of the database and strip its properties.

So the routine clears rather than archives: at the start of each run, query every
row with `Type = "Action"` and set `Type` to null. Yesterday's items drop off the
Today panel, keep their plans in their page bodies, and stay in whatever Status
they were in.

## Do not create duplicates

Most of this work is already tracked. A new Action page about "triad seo" when a
"triad seo" task already exists means two rows for one job, and completing the
Action page does nothing to the real task.

Order of operations for each pick:

1. Query all open tasks (Status is not Complete).
2. Check whether a task for this action already exists.
3. If it does, tag that page: set `Type = "Action"`, `Order`, `Status`,
   `Dashboard`, `Notes`, and append the plan to its body. Do not create a page.
4. Create a new page only when the action is genuinely not tracked yet.

Appending, never replacing, matters because these pages already hold notes.

### Goal rows are not tasks either

Rows with Type = "Goal" feed the Today panel's progress bar: Percent (0 to
100), a one-line status in Notes, Order for display, Status Long Term. The
daily routine adjusts Percent and rewrites Notes only when something concrete
moved; otherwise it leaves them alone. Never tag a Goal row as Action, never
pick one for the daily three, never mark one Complete. Knox can also nudge a
percent by clicking the bar on the dashboard, so treat the number in Notion as
shared state, not routine-owned.

### Blake's rows are not tasks either

Rows with `Dashboard = "Blake"` belong to Knox's dad, Blake. He adds and
removes them from a small app at kmvtesting.vercel.app/blake (which talks to
the dashboard's `/api/blake` route); the dashboard shows them in their own
narrow Blake column and Knox checks them off there. Status Short Term /
Complete is the open/done switch for them. The routine never picks, tags,
renames, moves, or clears a Blake row.

Blake rows are a two-way ask system. `Side` (select, created on first use)
says who asked: B = Blake asked Knox, K = Knox asked Blake. The asker's title,
details, and files live on the row and in its page body. The other side
answers with a bare check (Status Complete), a written reply (the `Response`
text property), or files sent back (appended under a "From Knox" or "From
Blake" heading in the page body, which is how the API tells the asker's files
from the answer). Knox asks from the column's input and reads Blake's answers
(with his files) in the row's window; Blake's page shows a B side (his asks,
and Knox's answers to them) and a K side (Knox's asks with an answer box).

Files on Blake rows are links, not Notion uploads: the browser puts the
file straight into the project's Vercel Blob store (public, permanent URL,
no practical size cap) and the dashboard attaches it to the page as an
external file or image block. A dropped or pasted web link is saved as a
bookmark block on the same page and shows up for Blake as a tappable row.
Knox can delete any attachment from the row window or the shelf view on
the dashboard (two clicks: × then SURE?); that removes the block and the
blob. Removing a file from the shelf deletes the
blob too; the weekly sweep only archives pages and leaves blobs alone.

One Blake row is not a task at all: "Files from Knox" (`Type = "Files"`).
Its child blocks are files Knox drops on the Blake column, and Blake's page
shows them under From Knox. Leave it alone too. A Vercel cron hits
`/api/blake/sweep` every Monday at 12:00 UTC and archives Blake's Complete
rows, so his Done list resets weekly on its own.

### The Health Center census log

Carmen Tyler (University Village billing) emails the Health Center census
every weekday morning, usually between 7 and 11 Central, with one attachment,
"2026 HC Census.xlsx": a sheet per month, a column per day, a row per
resident, and four total rows at the bottom of each sheet (Total Private Pay,
Total Medicaid, Total SNF, TOTAL HC). Monday's workbook fills in the weekend.
Blake asked for those tracked daily so trends show.

- **Where it lives.** A Notion database, "HC Census Log", one row per day:
  Day (title, YYYY-MM-DD), Date, Total HC, Private Pay, Medicaid, SNF, Source.
  It sits inside a holder row of the tasks database named "HC Census Log
  (holds the census database, do not delete)", `Dashboard = "Census"`,
  Status Complete, which is what lets the dashboard's integration reach it.
  That row is not a task; nothing should pick, move, or delete it.
- **How it fills.** `/api/census/sync` on the dashboard finds Carmen's newest
  message in the Triad inbox, reads the workbook in memory, takes only those
  four total rows, and writes new or changed days. No agent is involved; it
  is plain code, so the same report always gives the same numbers. Three
  things call it:
  1. The dashboard itself, a few seconds after it loads and every three hours,
     plus a light look every ten minutes through the morning in Tulsa (6am to
     1pm Central). This always works while the board is open and signed in to
     Gmail.
     Only one tab in a browser syncs at a time (a browser lock in `page.tsx`).
  2. Vercel crons, three an hour from 12:00 to 18:00 UTC and one an hour from
     then to 22:00 (`vercel.json`). On this plan each cron runs once a day and
     fires somewhere inside its hour, so the three may land close together.
     Count on one check an hour, not three. That is 6am to 5pm in Tulsa in
     winter, 7am to 6pm in summer.
  3. Blake's page and the census tracker, when they open and every ten minutes
     while they are on screen.
  Callers 2 and 3 only do anything once the census job is switched on (next
  point). Until then they get "not connected" and the log fills only from 1.
  A GitHub Action on a ten-minute schedule was tried on 2026-11-18 and
  removed the next day: GitHub ran it once in two mornings, five hours late.
  A check within minutes of the report, with the dashboard closed, would
  need Gmail push notifications (a Google Cloud Pub/Sub topic), which is
  not set up.
- **The census job switch.** `/api/census/job` is a small page with an on/off
  button. It only answers a browser signed in to Triad Gmail on the dashboard.
  Turning it on is Knox's choice: the dashboard then keeps his Gmail sign-in
  (the refresh token, sealed with AES-256-GCM under a key made from
  server-only secrets) in a code block on the holder row, and the cron and
  Blake's page read Carmen's report with it. Turning it off empties that
  block. Nothing saves a login without that button being pressed. The same
  page shows the last check and what stopped it, if anything. With the job
  on, the only thing it ever sends from that mailbox is the daily census
  email described below.
- **Whose login a call reads with.** A call from the dashboard uses the
  dashboard's own Gmail cookies, but only after Gmail confirms they open a
  Triad mailbox; any other login is treated as a stranger. The cron and
  Blake's page have no cookies, so they read with the saved login. For them
  the job runs at most once every five minutes, stops early if Carmen's
  newest report is already logged, and answers with counts and dates only.
  While the job is on, a fresh dashboard sign-in replaces the saved login
  without another button press.
- **What it remembers.** Three code blocks on the holder row: `census-login`
  (the sealed login, empty while the job is off), `census-status` (last
  check, which report is logged, how far the log runs, which report the
  daily email last went out for, and `note`, which reads "ok" or says what
  stopped the last run), and `census-mail` (the daily email's settings,
  which only exists once Knox changes something). Leave all three alone.
- **The census email.** The first time any caller sees a new report, the
  same run sends one email from the Triad mailbox that read it: the count in
  house, a 30-day graph, the payer split, and the move-ins and move-outs. It
  is on from the start and goes to Knox with every report. Who else gets it
  and how often (every report, Fridays, or the 1st of the month), turning it
  off, and a "Send me one now" button for each version are all on
  `/api/census/job`; the addresses and schedules live in the `census-mail`
  block, never in the code. Details that matter:
  - It compares two reports, the new one and the one before it. A morning
    report shows last night's count carried forward, and the day's arrivals
    and departures are only written in by the next morning. So the change
    in the headline is against the number in the last email, and the moves
    are whatever the new workbook has that the last one did not.
  - Moves are counted from the resident rows, in memory, in
    `app/api/census/moves.ts`. A move-in is someone in the building today
    who was not yesterday; a move-out is the reverse. A change of payer the
    same day is not a move. A hospital stay with the bed held (SFH, LOA and
    the like in the day's cell) is not a move. A discharge to the hospital
    is a move-out, and the return is a move-in counted as "returning". Names
    are used only to match one line to another and never leave that file.
  - One email per report, and only on the day the report was sent. `mailed`
    in `census-status` is the report it last went out for. A failed send is
    retried on the next check, five times at most. A report first seen on a
    later day (nothing was running that day) is marked as handled and not
    sent late.
  - The Friday and monthly versions are the same email compared with an
    older report: the Friday one with the first report of the week before
    (normally last Friday's), the monthly one with the first report of the
    month before. Each goes out once per week or month, with the first
    report of the period that is seen on its own day: Friday's report, or
    the next one when a Friday has no report or it was seen too late; the
    1st's report, or the next weekday's. `weekly` and `monthly` in
    `census-status` say which week and month are done. Someone on a slower
    schedule never gets the every-report email, and Knox gets only the
    every-report one unless he lists himself. If the every-report email
    goes out and a slower one fails, the report stays unmailed and the next
    check sends only what is missing (the Sent folder check skips the rest).
  - Two runs at the same moment are normal here: two tabs of the board wake
    up together. On 2026-11-19 that sent the first automatic email twice.
    Notion cannot do "write only if unchanged", so each run writes its own
    claim (`mailing`), waits three seconds, and reads it back; Notion keeps
    the last claim written, so all but one run stand down. Then, before
    sending, the run asks Gmail whether that exact subject is already in
    Sent. The subject carries the schedule ("HC census", "Weekly HC census",
    "Monthly HC census"), the day and the count, so it is one per report and
    schedule. The "Send me one now" button puts "Test:" in front of the
    subject so it never counts as the day's email.
  - The graph is a PNG drawn on the server (`chart.ts`, with next/og) and
    carried inside the message, so it shows in Gmail without a "show images"
    step. `/api/census/chart` serves the same picture from the log.
  - Only the live site sends. A dev server or a preview build never does.
    `CENSUS_MAIL=off` in Vercel stops it everywhere.
- **When it stops.** If Google rejects the saved login (password change,
  access revoked, or the app's test-mode expiry), `note` reads
  `gmail_login_rejected`, the job page says so, and Blake's card says "No new
  report since" with the last date once it is four days behind. The fix is to
  reconnect Triad Gmail on the dashboard; the next load saves the new login.
  Setting `CENSUS_SAVED_LOGIN=off` in Vercel turns the saved login off
  entirely. Nothing is lost either way: every workbook carries the whole
  year, so the next good run fills any gap.
- **What it skips.** She pre-fills the rest of the month, so days after the
  report's date are projections and are left out. Resident names, rooms, and
  payer notes are never read into anything.
- **Who reads it.** Two pages on kmvtesting. The census tracker
  (kmvtesting.vercel.app/census) is the full-page view: it loads the whole
  log with `/api/census?all=1` and draws the flowsheet, the monthly ledger,
  and the daily log. The census card on Blake's page
  (kmvtesting.vercel.app/blake) reads one month at a time with
  `/api/census?month=YYYY-MM`. Both pages open for anyone who has the link
  (only the kmvtesting hub, the page that lists every project, asks for a
  code), and so does this API, which is why it carries counts and nothing
  else.

### Buckets are not tasks

The Long Term rows are buckets: Market Research, UVRC General, UVRC Brand PR,
research nashville. "Market Research" is not an action. "Pull rent comps for three
Nashville submarkets and put them in the Comps database" is.

When a pick comes out of a bucket, the chunk is not itself tracked anywhere, so it
gets a **new page**, and the bucket is left alone as a Long Term project. Say in
`Notes` which bucket it came from. Retagging the bucket itself would drag a Long
Term project into Short Term and empty the Projects panel.

## Carryover

When clearing `Type`, check each former Action item. If it is not Complete it is
eligible to be picked again. If it is picked again, note in `Notes` that it is
carrying over and how many days it has been sitting. If the same item carries three
days running, say so plainly in the run summary. That means it is blocked or
wrongly scoped, and repeating it silently hides that.

## Schedule is a follow-up log, not a calendar

Nothing is dated past 2026-08-05, and entries like snow goose, the antiquary,
rustic roost, and the love shop sit there unresolved. Treat it as two things:

- Entries dated today or later: real upcoming commitments.
- Past-dated entries never closed out: stale follow-ups, and legitimate candidates
  for the daily three.

An empty forward-looking Schedule is the normal state, not a problem. Google
Calendar is not connected. If it ever is, that becomes the real calendar source.

## Scheduled routines

Knox is America/Los_Angeles, currently UTC-7.

| Routine | When | What |
| --- | --- | --- |
| Morning sweep (`trig_01Ns4xBJhquK87DqmszEfTGQ`) | `0 14 * * *` UTC, 7:00 AM Pacific, daily | Pulls new items from Gmail, Drive, and Notion into the tasks database |
| Daily three | `30 14 * * 1-5` UTC, 7:30 AM Pacific, weekdays | Clears yesterday's Action tags, picks three, writes plans |

Both write to the same database, so the daily three runs half an hour after the
sweep and picks from the refreshed set. If they ever move to the same minute they
will collide. The alternative is merging them into one task that sweeps first and
then picks, with one summary.

## Plan format

Every Action page body gets three sections, in this order:

- **Where to start** — one specific first move. Which file, which person, which tab.
- **Steps** — numbered, each a single action he can do without deciding anything first.
- **Done looks like** — a finished state specific enough to check against.

Real phone numbers, addresses, links, and dollar figures go in the steps. Search
for them rather than gesturing at them. When something is genuinely unknowable, say
what he needs to find out and where to look. Scope each item to 30 to 90 minutes,
not a whole day.

## Writing rules

No em dashes anywhere. Plain direct language, no systems-speak. Task names read
like something a person says out loud, not a ticket title. This applies to page
bodies and the run summary, not just the dashboard copy.
