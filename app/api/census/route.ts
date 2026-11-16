import { json, preflight } from "../blake/shared";
import { censusEdges, loadCensus, type CensusRow } from "./shared";

// The Health Center census log, for the graph on Blake's page and the census
// tracker. Totals only (how many residents, by payer group, per day). Public
// like the rest of the Blake API, so nothing here ever carries a name.
//
// GET /api/census                -> the latest month that has data
// GET /api/census?month=2026-10  -> that month
// GET /api/census?all=1          -> every logged day
// GET /api/census?from=2026-08-01&to=2026-11-16  -> a span (either end optional)

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// one row per date, oldest first, without Notion's row ids
function days(rows: CensusRow[]) {
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.date) ? false : (seen.add(r.date), true)))
    .map((r) => ({ date: r.date, total: r.total, private: r.private, medicaid: r.medicaid, snf: r.snf }));
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return json(req, { error: "not configured" }, 500);
  try {
    const q = new URL(req.url).searchParams;

    if (q.get("all") === "1" || q.has("from") || q.has("to")) {
      const from = q.get("from");
      const to = q.get("to");
      const list = days(await loadCensus(token, isDay(from) ? from : undefined, isDay(to) ? to : undefined));
      return json(req, { days: list, first: list.length ? list[0].date : null, last: list.length ? list[list.length - 1].date : null });
    }

    const { first, last } = await censusEdges(token);
    if (!first || !last) return json(req, { month: null, days: [], first: null, last: null });

    const asked = q.get("month") || "";
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : last.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    return json(req, { month, days: days(await loadCensus(token, `${month}-01`, end)), first, last });
  } catch (e) {
    console.error("census GET", e);
    return json(req, { error: "notion" }, 502);
  }
}
