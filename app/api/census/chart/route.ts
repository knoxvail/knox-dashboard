import { NextResponse } from "next/server";
import { censusChartPng } from "../chart";
import { loadCensus } from "../shared";

// GET /api/census/chart -> the last 30 days of the census log as a PNG, the
// same picture the daily email carries. Drawn from the log's daily totals, so
// it shows nothing the open /api/census does not.

export const revalidate = 0;

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "not configured" }, { status: 500 });
  try {
    const from = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
    const png = await censusChartPng((await loadCensus(token, from)).slice(-30));
    if (!png) return NextResponse.json({ error: "no_chart" }, { status: 502 });
    return new NextResponse(new Blob([png as unknown as BlobPart], { type: "image/png" }), { headers: { "Content-Type": "image/png" } });
  } catch (e) {
    console.error("census chart route", e);
    return NextResponse.json({ error: "chart_failed" }, { status: 502 });
  }
}
