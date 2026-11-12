# Daily three, scheduled Cowork routine

Paste the block below into the scheduled task. Weekdays, `30 14 * * 1-5` UTC
(7:30 AM Pacific), which is half an hour after the morning sweep
`trig_01Ns4xBJhquK87DqmszEfTGQ` so it picks from the refreshed set.

---

Every weekday morning, give Knox three action items for the day.

Work in this Notion workspace. Do not go rediscover these, use them:

- Tasks database: `203c40ab-ce39-8018-88d2-d2a9035be3ed`
- Tasks data source: `collection://203c40ab-ce39-81aa-bc49-000b70ec35e6`
- Dashboard board view: `view://3b4c40ab-ce39-8151-91dd-000c38d8fbba`
- Schedule database: `79a404f0-c021-4c8d-8d0a-f5e76d655224`
- Schedule data source: `collection://a211b24a-1a65-4cfd-b052-14261468b834`

Tasks schema: Name (title), Status (status: Short Term, Long Term, Complete), Type
(select: Client, Action), Dashboard (select: Deal, Client, Admin, Personal, Web),
Open (formula, auto), Deadline (date), Priority (checkbox), Order (number), Notes
(text), Links (text), Assignee (person). Schedule schema: Name (title), Date
(date), Type (select: Meeting, Appointment, Deadline, Personal), Note (text).

Knox does multifamily and senior living acquisitions with his father, and runs a
web design business on the side (UVRC, Triad).

## Step 1, clear yesterday

Query every row where Type = "Action" and set Type to null. Do not try to archive
or trash them. This connection has no archive for database rows: update_page has no
archived flag, and move_pages only reparents, which would rip the row out of the
database and strip its properties. Clearing Type un-tags the item without
destroying anything, and the plan stays in the page body.

While clearing, check each one. If it is not Complete, it is eligible to be picked
again today.

## Step 2, pick three

Query all open tasks (Status is not Complete). Read the Schedule two ways: entries
dated today or later are real commitments, and past-dated entries that were never
closed out are stale follow-ups and are legitimate candidates. An empty
forward-looking Schedule is normal, not a problem. Google Calendar is not
connected.

Pick the three things that most deserve his attention today. Prefer what is
genuinely doable today and what unblocks something else.

His Long Term rows are buckets, not tasks: Market Research, UVRC General, UVRC
Brand PR, research nashville. Nothing has a deadline. You have to break a bucket
into a real 30 to 90 minute chunk yourself. "Market Research" is not an action.
"Pull rent comps for three Nashville submarkets and put them in the Comps database"
is. Without this you will cycle through the same four Short Term rows forever.

## Step 3, write them, without creating duplicates

He already tracks most of this work. A second row for one job means completing the
Action page does nothing to the real task.

For each pick:

1. Check whether a task for it already exists.
2. If it exists, tag that page. Do not create a new one.
3. Create a new page only when the action is genuinely not tracked anywhere yet.
   A chunk carved out of a bucket counts as not tracked, so it gets its own page,
   and the bucket is left alone as a Long Term project. Say in Notes which bucket
   it came from. Never retag the bucket itself, that drags a Long Term project into
   Short Term and empties his Projects panel.

Every action item carries all of these:

- **Name**: verb first, concrete. If you are tagging an existing page whose name is
  not an action, rename it so it is.
- **Type**: "Action"
- **Order**: 1, 2, 3
- **Status**: set it. Short Term if doable in two weeks, Long Term otherwise.
  Leaving it blank drops the row out of every status view.
- **Dashboard**: set it. This is a separate property from Type and it is what puts
  the item on the Dashboard board. Without it the three do not show up there.
  Route UVRC, Triad, and any site or SEO work to Web.
- **Notes**: one sentence on why this one today.

Then write the plan into that page's **body**, appending rather than replacing if
the page already has content:

- A "Where to start" heading, then the single first move. Be specific: which file,
  which person, which tab.
- A "Steps" heading, then numbered items. Each step is one action he can do without
  deciding anything first.
- A "Done looks like" heading, then the finished state, specific enough that he can
  check against it.

Put real phone numbers, addresses, links, and dollar figures into the steps. Search
for them, do not gesture at them. His research nashville notes already hold a full
broker list with direct numbers and emails, use it. When something is genuinely
unknowable, say what he needs to find out and where to look. Do not invent a phone
number or an address. Scope each item to 30 to 90 minutes, not a whole day.

## Step 4, update the big goals

The dashboard's Today panel shows a progress bar fed by rows where Type =
"Goal". Each goal row carries: Percent (number, 0 to 100), Notes (one plain
sentence on how it is going, rewritten each time it changes), Order (display
position), Status (Long Term).

After picking the three, look at what actually happened since the last run:
actions completed, replies that landed, schedule entries closed out. If a goal
visibly moved, adjust its Percent and rewrite its Notes line to say the current
state. If nothing moved, leave the number alone. Never nudge a percent without
something concrete behind it, and never move one backward without saying why in
Notes.

Rows with Dashboard = "Blake" are Knox's dad's list, added from his own app
(kmvtesting.vercel.app/blake). They are not Knox's tasks. Never pick one for
the daily three, never tag, rename, move, or clear one. Leave them alone.
That includes the row named "Files from Knox", which only holds files.

One more row to leave alone: "HC Census Log" (Dashboard = "Census", Status
Complete). It is not a task. It holds the Health Center census database that
the dashboard fills from Carmen's daily report. Never pick, retag, rename,
move, or delete it, and never edit the rows inside that database.

Goal rows are buckets' cousins, not tasks. Never tag one as Action, never pick
one as a daily three, never mark one Complete. A finished goal goes to 100 with
a closing note. Add a new goal row only when a genuinely new big thread appears;
retire a dead one by clearing its Type.

There is also exactly one row with Type = "Brief" (named "How it fits
together"). Its Notes carry two or three plain sentences on how everything
connects right now: what is furthest along, what is blocked on what, where the
next real movement comes from. Rewrite it every run so it reads true today.
The dashboard shows it word for word under the big-goals bar, so no lists, no
headings, just sentences. Never create a second Brief row.

## Carryover

If a pick was already an action item yesterday and is still not Complete, note in
Notes that it is carrying over and how many days it has been sitting. If the same
item carries three days running, say so plainly in the summary. That means it is
blocked or wrongly scoped.

## Summary

One short summary at the end: what the three are, which were tagged versus created,
and anything carrying over. No filler, no motivational framing, no restating the
task.

## Writing rules

No em dashes anywhere. Plain direct language, no systems-speak. Names read like
something a person says out loud, not a ticket title. Applies to page bodies and
the summary.
