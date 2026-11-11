import { json, preflight } from "../blake/shared";
import { censusEdges, loadCensus } from "./shared";

// One month of the Health Center census log, for the graph on Blake's page.
// Totals only (how many residents, by payer group, per day). Public like the
// rest of the Blake API, so nothing here ever carries a name.
//
// GET /api/census            -> the latest month that has data
// GET /api/census?month=2026-10

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return json(req, { error: "not configured" }, 500);
  try {
    const { first, last } = await censusEdges(token);
    if (!first || !last) return json(req, { month: null, days: [], first: null, last: null });

    const asked = new URL(req.url).searchParams.get("month") || "";
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : last.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    const seen = new Set<string>();
    const rows = (await loadCensus(token, `${month}-01`, end)).filter((r) => (seen.has(r.date) ? false : (seen.add(r.date), true)));
    return json(req, {
      month,
      days: rows.map((r) => ({ date: r.date, total: r.total, private: r.private, medicaid: r.medicaid, snf: r.snf })),
      first,
      last,
    });
  } catch (e) {
    console.error("census GET", e);
    return json(req, { error: "notion" }, 502);
  }
}
