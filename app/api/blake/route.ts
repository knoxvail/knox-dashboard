import { NextResponse } from "next/server";

// Blake's list. His rows live in the same tasks database as everything else,
// marked Dashboard = "Blake" so they stay out of Knox's buckets. The static
// app at kmvtesting.vercel.app/blake/ talks to this route cross-origin, so
// every response carries CORS headers for that origin (and localhost while
// developing).

export const revalidate = 0;

const NOTION = "https://api.notion.com/v1";
const ALLOWED_ORIGINS = new Set([
  "https://kmvtesting.vercel.app",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://kmvtesting.vercel.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

type BlakeRow = { id: string; title: string; notes: string; done: boolean; created: string; url: string };

function rowFromPage(page: any): BlakeRow | null {
  const titleProp = Object.values(page.properties || {}).find((p: any) => p.type === "title") as any;
  const title = titleProp?.title?.map((t: any) => t.plain_text).join("") || "";
  if (!title) return null;
  const status = (Object.values(page.properties).find((p: any) => p.type === "status") as any)?.status?.name || "";
  const notes = ((page.properties as any)["Notes"]?.rich_text || []).map((t: any) => t.plain_text).join("");
  return {
    id: page.id,
    title,
    notes,
    done: status === "Complete",
    created: page.created_time || "",
    url: `https://www.notion.so/${String(page.id).replace(/-/g, "")}`,
  };
}

// every Blake row, oldest first
async function queryBlake(token: string, dbId: string): Promise<BlakeRow[]> {
  const rows: BlakeRow[] = [];
  let cursor: string | undefined;
  do {
    const r = await fetch(`${NOTION}/databases/${dbId}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: { property: "Dashboard", select: { equals: "Blake" } },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || `notion ${r.status}`);
    for (const p of d.results || []) {
      const row = rowFromPage(p);
      if (row) rows.push(row);
    }
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// Notion caps a rich_text chunk at 2000 chars
function richText(s: string) {
  const parts = s.match(/[\s\S]{1,2000}/g) || [];
  return parts.map((p) => ({ type: "text", text: { content: p } }));
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);
  try {
    return json(req, { items: await queryBlake(token, dbId) });
  } catch (e) {
    console.error("blake GET", e);
    return json(req, { error: "notion" }, 502);
  }
}

export async function POST(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }
  const action = body?.action;

  try {
    if (action === "add") {
      const title = String(body.title || "").trim().slice(0, 200);
      const notes = String(body.notes || "").trim().slice(0, 4000);
      if (!title) return json(req, { error: "title required" }, 400);
      // the description goes in the page body (no length cap there) and the
      // first stretch of it into Notes so the dashboard can show a one-liner
      const children = notes
        ? notes.split(/\n+/).filter(Boolean).map((line) => ({
            object: "block", type: "paragraph", paragraph: { rich_text: richText(line) },
          }))
        : [];
      const r = await fetch(`${NOTION}/pages`, {
        method: "POST",
        headers: notionHeaders(token),
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            Name: { title: [{ text: { content: title } }] },
            Dashboard: { select: { name: "Blake" } },
            Status: { status: { name: "Short Term" } },
            ...(notes ? { Notes: { rich_text: richText(notes.slice(0, 1900)) } } : {}),
          },
          children,
        }),
      });
      const d = await r.json();
      if (!r.ok) return json(req, { error: d?.message || "notion" }, r.status);
      return json(req, { item: rowFromPage(d) });
    }

    if (action === "toggle") {
      const id = String(body.id || "");
      if (!id) return json(req, { error: "id required" }, 400);
      const r = await fetch(`${NOTION}/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({ properties: { Status: { status: { name: body.done ? "Complete" : "Short Term" } } } }),
      });
      if (!r.ok) return json(req, { error: (await r.json())?.message || "notion" }, r.status);
      return json(req, { ok: true });
    }

    if (action === "remove") {
      const id = String(body.id || "");
      if (!id) return json(req, { error: "id required" }, 400);
      const r = await fetch(`${NOTION}/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({ archived: true }),
      });
      if (!r.ok) return json(req, { error: (await r.json())?.message || "notion" }, r.status);
      return json(req, { ok: true });
    }

    if (action === "clearDone") {
      const done = (await queryBlake(token, dbId)).filter((r) => r.done);
      await Promise.all(done.map((r) =>
        fetch(`${NOTION}/pages/${r.id}`, { method: "PATCH", headers: notionHeaders(token), body: JSON.stringify({ archived: true }) })
      ));
      return json(req, { ok: true, cleared: done.length });
    }

    return json(req, { error: "unknown action" }, 400);
  } catch (e) {
    console.error("blake POST", e);
    return json(req, { error: "notion" }, 502);
  }
}
