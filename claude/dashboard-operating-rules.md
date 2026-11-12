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

Carmen Tyler (ctyler@uvrc.com, University Village billing) emails the Health
Center census every morning with one attachment, "2026 HC Census.xlsx": a
sheet per month, a column per day, a row per resident, and four total rows at
the bottom of each sheet (Total Private Pay, Total Medicaid, Total SNF,
TOTAL HC). Blake asked for those tracked daily so trends show.

- **Where it lives.** A Notion database, "HC Census Log", one row per day:
  Day (title, YYYY-MM-DD), Date, Total HC, Private Pay, Medicaid, SNF, Source.
  It sits inside a holder row of the tasks database named "HC Census Log
  (holds the census database, do not delete)", `Dashboard = "Census"`,
  Status Complete, which is what lets the dashboard's integration reach it.
  That row is not a task; nothing should pick, move, or delete it.
- **How it fills.** `/api/census/sync` on the dashboard finds Carmen's newest
  message through the Triad Gmail login, reads the workbook in memory, takes
  only those four total rows, and writes new or changed days. The board calls
  it a few seconds after it loads and every three hours, so the log stays
  current whenever the dashboard is open in a browser signed into Gmail. Each
  run re-reads the whole year, so a day Carmen corrects later gets corrected.
- **What it skips.** She pre-fills the rest of the month, so days after the
  report's date are projections and are left out. Resident names, rooms, and
  payer notes are never read into anything.
- **Who reads it.** `/api/census?month=YYYY-MM` serves a month of totals to
  the census view on Blake's page (kmvtesting.vercel.app/blake). It is public
  like the rest of that page, which is why it carries counts and nothing else.

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
