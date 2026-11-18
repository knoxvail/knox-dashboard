import type { Cell, Sheet } from "./parse";

// Counts move-ins and move-outs per day from the resident rows of the census
// workbook.
//
// The four totals say how many people are in the Health Center. They cannot
// say that two left and two arrived, and a change of payer (skilled to
// private pay, say) shows in them as one section down and another up. So this
// reads the resident rows themselves and follows each person from one day to
// the next.
//
// Privacy: a name is used in here as a key, to know that the person on one
// line is the person on another. It is never returned, logged, or stored.
// What leaves this file is a count per day.
//
// How the sheet marks a day, per resident row:
//   1            in the building that day
//   DC, D/C, EXP discharged or died that day; whatever is written in the
//                cells after it is a note about where they went
//   SFH, LOA...  any other short text on a day that follows a day in the
//                building: out at the hospital or on leave with the bed held.
//                Still a resident, so neither a move-out nor, on the way back,
//                a move-in.
//   blank        not here
//
// A move-in is a person who is here today and was not here yesterday. A
// move-out is the reverse. Someone who comes back after a discharge counts as
// a move-in again, and is also counted in `back`.

export type Moves = Record<string, { ins: number; back: number; outs: number }>;

const OUT_MARK = /^(d\/?c\b|disch|exp|deceased|died|death)/i;

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const dayBefore = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

const HERE = 1; // in the building
const HELD = 2; // away, bed held

/**
 * @param cutoff YYYY-MM-DD, the day the report was sent. Later days are
 *               pre-filled projections and are left out.
 */
export function readMoves(workbook: Sheet[], cutoff: string): Moves {
  const people = new Map<string, Map<string, number>>();
  const covered: string[] = [];

  const months = workbook.filter((s) => s.ym && s.rows.length).sort((a, b) => a.ym!.y - b.ym!.y || a.ym!.m - b.ym!.m);
  for (const sheet of months) {
    const { y, m } = sheet.ym!;
    const day1 = sheet.dayColumn ?? 5;
    const inMonth = new Date(y, m, 0).getDate();
    let last = 0;
    for (let d = 1; d <= inMonth; d++) {
      const date = `${y}-${pad(m)}-${pad(d)}`;
      if (date > cutoff) break;
      covered.push(date);
      last = d;
    }
    if (!last) continue;

    for (const cells of sheet.rows) {
      const labels = cells.filter((c) => c.col < day1);
      const name = labels.find((c) => c.col === 1 && c.str && c.str.trim());
      if (!name) continue; // subtotals, spacers, the day-number band
      if (/^total\b/i.test(name.str!.trim())) continue;
      // a resident line also carries a room or a payer beside the name; a line
      // with a label alone is a count typed in by hand, not a person
      if (!labels.some((c) => c.col > 1 && (c.num !== null || (c.str && c.str.trim())))) continue;

      const band: (Cell | undefined)[] = [];
      for (const c of cells) if (c.col >= day1 && c.col < day1 + inMonth) band[c.col - day1] = c;
      if (band.some((c) => c && c.num !== null && c.num > 1)) continue; // counts, not a person
      if (!band.some((c) => c && ((c.num !== null && c.num > 0) || (c.str && c.str.trim())))) continue;

      const key = keyOf(name.str!);
      if (!key) continue;
      let person = people.get(key);
      if (!person) people.set(key, (person = new Map()));

      let state = 0;
      for (let d = 1; d <= last; d++) {
        const c = band[d - 1];
        const text = c && c.str ? c.str.trim() : "";
        if (c && c.num !== null && c.num > 0) state = HERE;
        else if (text) {
          if (OUT_MARK.test(text)) state = 0;
          else if (state) state = HELD; // text after a discharge is only a note
        } else state = 0;
        if (!state) continue;
        // the same person on two lines the same day (a payer change): here wins
        const date = `${y}-${pad(m)}-${pad(d)}`;
        if (state === HERE || !person.has(date)) person.set(date, state);
      }
    }
  }

  // the first day each person was in the building, to tell a return from a first arrival
  const firstHere = new Map<string, string>();
  for (const [key, days] of people) {
    let first = "";
    for (const [date, state] of days) if (state === HERE && (!first || date < first)) first = date;
    if (first) firstHere.set(key, first);
  }

  const moves: Moves = {};
  for (let i = 1; i < covered.length; i++) {
    const date = covered[i];
    const prior = covered[i - 1];
    if (prior !== dayBefore(date)) continue; // a missing month: no way to compare
    let ins = 0;
    let back = 0;
    let outs = 0;
    for (const [key, days] of people) {
      const was = days.has(prior);
      const is = days.has(date);
      if (!was && is) {
        ins++;
        const first = firstHere.get(key);
        if (first && first < date) back++;
      } else if (was && !is) outs++;
    }
    if (ins || outs) moves[date] = { ins, back, outs };
  }
  return moves;
}

export type MoveCount = { ins: number; back: number; outs: number; days: { date: string; ins: number; back: number; outs: number }[] };

/**
 * What is new between two readings of the workbook: the moves in `now` that
 * `before` (the report sent the time before) did not have yet, across
 * from..to. Without a `before`, every move in the span counts.
 *
 * It compares counts per day, never names, so a spelling fixed in an old row
 * changes nothing. The totals are netted across the span, so a discharge that
 * is re-dated from one day to the next is not counted twice.
 */
export function movesSince(now: Moves, before: Moves | null, from: string, to: string): MoveCount {
  const days: MoveCount["days"] = [];
  const net = { ins: 0, back: 0, outs: 0 };
  const dates = new Set([...Object.keys(now), ...Object.keys(before || {})]);
  for (const date of [...dates].sort()) {
    if (date < from || date > to) continue;
    const a = now[date] || { ins: 0, back: 0, outs: 0 };
    const b = (before && before[date]) || { ins: 0, back: 0, outs: 0 };
    net.ins += a.ins - b.ins;
    net.back += a.back - b.back;
    net.outs += a.outs - b.outs;
    const day = { date, ins: Math.max(0, a.ins - b.ins), back: Math.max(0, a.back - b.back), outs: Math.max(0, a.outs - b.outs) };
    if (day.ins || day.outs) days.push(day);
  }
  const ins = Math.max(0, net.ins);
  const outs = Math.max(0, net.outs);
  // keep the day-by-day list in step with the netted totals, newest days first
  const trim = (field: "ins" | "outs", total: number) => {
    let left = total;
    for (let i = days.length - 1; i >= 0; i--) {
      const take = Math.min(days[i][field], left);
      if (field === "ins") days[i].back = Math.min(days[i].back, take);
      days[i][field] = take;
      left -= take;
    }
  };
  trim("ins", ins);
  trim("outs", outs);
  const kept = days.filter((d) => d.ins || d.outs);
  return { ins, back: Math.min(ins, Math.max(0, net.back), kept.reduce((n, d) => n + d.back, 0)), outs, days: kept };
}
