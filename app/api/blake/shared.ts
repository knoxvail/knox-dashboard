import { NextResponse } from "next/server";

// Shared bits for the Blake routes. His rows live in the main tasks database
// marked Dashboard = "Blake". One extra row, "Files from Knox" (Type = "Files"),
// is a holder page whose child blocks are the files Knox drops for him.

export const NOTION = "https://api.notion.com/v1";
export const FILES_HOLDER_TITLE = "Files from Knox";

const ALLOWED_ORIGINS = new Set([
  "https://kmvtesting.vercel.app",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:3000",
]);

export function corsHeaders(req: Request): Record<string, string> {
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

export function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

// Notion caps a rich_text chunk at 2000 chars
export function richText(s: string) {
  const parts = s.match(/[\s\S]{1,2000}/g) || [];
  return parts.map((p) => ({ type: "text", text: { content: p } }));
}

export type BlakeRow = { id: string; title: string; notes: string; done: boolean; created: string; url: string };

export function isFilesHolder(page: any): boolean {
  return (page?.properties as any)?.["Type"]?.select?.name === "Files";
}

export function rowFromPage(page: any): BlakeRow | null {
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

// every Blake task row, oldest first (the files holder is left out)
export async function queryBlake(token: string, dbId: string): Promise<BlakeRow[]> {
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
      if (isFilesHolder(p)) continue;
      const row = rowFromPage(p);
      if (row) rows.push(row);
    }
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// the holder page for Knox's drops; made on first use. Found by scanning the
// Blake rows rather than filtering on Type = "Files": Notion rejects a filter
// on a select option that doesn't exist yet, and creating the page is what
// brings the option into being.
export async function getFilesHolder(token: string, dbId: string, create: boolean): Promise<string | null> {
  let cursor: string | undefined;
  do {
    const r = await fetch(`${NOTION}/databases/${dbId}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: { property: "Dashboard", select: { equals: "Blake" } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || `notion ${r.status}`);
    for (const p of d.results || []) if (isFilesHolder(p)) return p.id;
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  if (!create) return null;
  const c = await fetch(`${NOTION}/pages`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        Name: { title: [{ text: { content: FILES_HOLDER_TITLE } }] },
        Dashboard: { select: { name: "Blake" } },
        Type: { select: { name: "Files" } },
        Status: { status: { name: "Long Term" } },
      },
    }),
  });
  const made = await c.json();
  if (!c.ok) throw new Error(made?.message || `notion ${c.status}`);
  return made.id;
}

export type BlakeFile = { id: string; name: string; url: string; kind: "image" | "file"; created: string };

// the holder page's file and image blocks, newest first. Notion signs the
// URLs for about an hour, so callers re-fetch rather than cache these.
export async function listFiles(token: string, holderId: string): Promise<BlakeFile[]> {
  const out: BlakeFile[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`${NOTION}/blocks/${holderId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const r = await fetch(url, { headers: notionHeaders(token), cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || `notion ${r.status}`);
    for (const b of d.results || []) {
      if (b.type !== "image" && b.type !== "file") continue;
      const inner = b[b.type] || {};
      const href = inner.file?.url || inner.external?.url || "";
      if (!href) continue;
      const caption = (inner.caption || []).map((t: any) => t.plain_text).join("");
      let name = caption || inner.name || "";
      if (!name) {
        try { name = decodeURIComponent(new URL(href).pathname.split("/").pop() || ""); } catch { name = "file"; }
      }
      out.push({ id: b.id, name, url: href, kind: b.type === "image" ? "image" : "file", created: b.created_time || "" });
    }
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return out.reverse();
}
