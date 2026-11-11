import type { CensusDay } from "./parse";

// The Health Center census log: one Notion row per day with the four totals
// from Carmen's daily report. The database sits inside a holder row of the
// tasks database (Dashboard = "Census") so the dashboard's integration can
// reach it without a manual share.

export const CENSUS_DB = process.env.NOTION_CENSUS_DB_ID || "415c40ab-ce39-81ae-adc0-c788ccab2a4b";

const NOTION = "https://api.notion.com/v1";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

export type CensusRow = CensusDay & { id: string };

function rowFrom(page: any): CensusRow | null {
  const p = page?.properties || {};
  const date = p["Date"]?.date?.start;
  const total = p["Total HC"]?.number;
  if (typeof date !== "string" || typeof total !== "number") return null;
  const num = (name: string) => (typeof p[name]?.number === "number" ? (p[name].number as number) : null);
  return { id: page.id, date: date.slice(0, 10), total, private: num("Private Pay"), medicaid: num("Medicaid"), snf: num("SNF") };
}

async function query(token: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${NOTION}/databases/${CENSUS_DB}/query`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.message || `notion ${r.status}`);
  return d;
}

// rows between two dates (inclusive), oldest first; no bounds = the whole log
export async function loadCensus(token: string, from?: string, to?: string): Promise<CensusRow[]> {
  const and: unknown[] = [];
  if (from) and.push({ property: "Date", date: { on_or_after: from } });
  if (to) and.push({ property: "Date", date: { on_or_before: to } });
  const rows: CensusRow[] = [];
  let cursor: string | undefined;
  do {
    const d = await query(token, {
      ...(and.length ? { filter: { and } } : {}),
      sorts: [{ property: "Date", direction: "ascending" }],
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const p of d.results || []) {
      const row = rowFrom(p);
      if (row) rows.push(row);
    }
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// the first and last logged dates, for the month arrows
export async function censusEdges(token: string): Promise<{ first: string | null; last: string | null }> {
  const edge = async (direction: "ascending" | "descending") => {
    const d = await query(token, { sorts: [{ property: "Date", direction }], page_size: 1 });
    return rowFrom((d.results || [])[0])?.date || null;
  };
  const [first, last] = await Promise.all([edge("ascending"), edge("descending")]);
  return { first, last };
}

function propsFor(day: CensusDay, source: string) {
  return {
    Day: { title: [{ text: { content: day.date } }] },
    Date: { date: { start: day.date } },
    "Total HC": { number: day.total },
    "Private Pay": { number: day.private },
    Medicaid: { number: day.medicaid },
    SNF: { number: day.snf },
    Source: { rich_text: [{ text: { content: source.slice(0, 200) } }] },
  };
}

// one write, with a single patient retry when Notion says slow down
async function send(token: string, url: string, method: "POST" | "PATCH", body: unknown): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method, headers: headers(token), body: JSON.stringify(body) });
    if (r.ok) return true;
    if (r.status !== 429 && r.status < 500) return false;
    const wait = (Number(r.headers.get("retry-after")) || 1) * 1000;
    await new Promise((res) => setTimeout(res, Math.min(wait, 4000)));
  }
  return false;
}

export function createCensusDay(token: string, day: CensusDay, source: string) {
  return send(token, `${NOTION}/pages`, "POST", { parent: { database_id: CENSUS_DB }, properties: propsFor(day, source) });
}

export function updateCensusDay(token: string, id: string, day: CensusDay, source: string) {
  return send(token, `${NOTION}/pages/${id}`, "PATCH", { properties: propsFor(day, source) });
}

// two boards syncing at the same moment can each create the same day; the
// next sync keeps the first row and archives the rest
export function archiveCensusRow(token: string, id: string) {
  return send(token, `${NOTION}/pages/${id}`, "PATCH", { archived: true });
}

export const sameDay = (a: CensusDay, b: CensusDay) =>
  a.total === b.total && a.private === b.private && a.medicaid === b.medicaid && a.snf === b.snf;
