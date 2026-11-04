import { NextResponse } from "next/server";

// Shared bits for the Blake routes. His rows live in the main tasks database
// marked Dashboard = "Blake". Each row is an ask: Side = "B" means Blake asked
// Knox, Side = "K" means Knox asked Blake. The other party answers with a
// check, a written reply (the Response property), or files (appended under a
// "From Knox" or "From Blake" heading in the page body, which is also how a
// listing tells the asker's attachments from the answer). One extra row,
// "Files from Knox" (Type = "Files"), is a holder page whose child blocks are
// loose files Knox drops for him outside any ask.

export const NOTION = "https://api.notion.com/v1";
export const FILES_HOLDER_TITLE = "Files from Knox";
export type Side = "B" | "K";
export const RESPONSE_HEADINGS: Record<Side, string> = { K: "From Knox", B: "From Blake" };

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

const plain = (rt: any): string => (Array.isArray(rt) ? rt.map((t: any) => t.plain_text).join("") : "");

export type BlakeRow = { id: string; title: string; notes: string; done: boolean; response: string; side: Side; created: string; edited: string; url: string };

export function isFilesHolder(page: any): boolean {
  return (page?.properties as any)?.["Type"]?.select?.name === "Files";
}

export function sideOf(page: any): Side {
  return (page?.properties as any)?.["Side"]?.select?.name === "K" ? "K" : "B";
}

export function rowFromPage(page: any): BlakeRow | null {
  const titleProp = Object.values(page.properties || {}).find((p: any) => p.type === "title") as any;
  const title = plain(titleProp?.title);
  if (!title) return null;
  const status = (Object.values(page.properties).find((p: any) => p.type === "status") as any)?.status?.name || "";
  return {
    id: page.id,
    title,
    notes: plain((page.properties as any)["Notes"]?.rich_text),
    done: status === "Complete",
    response: plain((page.properties as any)["Response"]?.rich_text),
    side: sideOf(page),
    created: page.created_time || "",
    edited: page.last_edited_time || page.created_time || "",
    url: `https://www.notion.so/${String(page.id).replace(/-/g, "")}`,
  };
}

// every ask row, oldest first (the files holder is left out)
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

// The Response (text) and Side (select B/K) properties are added to the
// database on first use. Checked once per server instance.
let fieldsReady = false;
export async function ensureBlakeFields(token: string, dbId: string): Promise<void> {
  if (fieldsReady) return;
  const r = await fetch(`${NOTION}/databases/${dbId}`, { headers: notionHeaders(token), cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.message || `notion ${r.status}`);
  const missing: Record<string, unknown> = {};
  if (!d.properties?.Response) missing.Response = { rich_text: {} };
  if (!d.properties?.Side) missing.Side = { select: { options: [{ name: "B", color: "blue" }, { name: "K", color: "green" }] } };
  if (Object.keys(missing).length) {
    const p = await fetch(`${NOTION}/databases/${dbId}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties: missing }),
    });
    if (!p.ok) throw new Error((await p.json())?.message || `notion ${p.status}`);
  }
  fieldsReady = true;
}

// the holder page for Knox's loose drops; made on first use. Found by scanning
// the Blake rows rather than filtering on Type = "Files": Notion rejects a
// filter on a select option that doesn't exist yet, and creating the page is
// what brings the option into being.
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

function fileFromBlock(b: any): BlakeFile | null {
  if (b.type !== "image" && b.type !== "file") return null;
  const inner = b[b.type] || {};
  const href = inner.file?.url || inner.external?.url || "";
  if (!href) return null;
  let name = plain(inner.caption) || inner.name || "";
  if (!name) {
    try { name = decodeURIComponent(new URL(href).pathname.split("/").pop() || ""); } catch { name = "file"; }
  }
  return { id: b.id, name, url: href, kind: b.type === "image" ? "image" : "file", created: b.created_time || "" };
}

async function* childBlocks(token: string, pageId: string) {
  let cursor: string | undefined;
  do {
    const url = new URL(`${NOTION}/blocks/${pageId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const r = await fetch(url, { headers: notionHeaders(token), cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || `notion ${r.status}`);
    for (const b of d.results || []) yield b;
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
}

const HEADING_TEXTS = new Set(Object.values(RESPONSE_HEADINGS));
const isResponseHeading = (b: any) =>
  typeof b?.type === "string" && b.type.startsWith("heading_") && HEADING_TEXTS.has(plain(b[b.type]?.rich_text).trim());

// the holder page's file and image blocks, newest first. Notion signs the
// URLs for about an hour, so callers re-fetch rather than cache these.
export async function listFiles(token: string, holderId: string): Promise<BlakeFile[]> {
  const out: BlakeFile[] = [];
  for await (const b of childBlocks(token, holderId)) {
    const f = fileFromBlock(b);
    if (f) out.push(f);
  }
  return out.reverse();
}

// An ask page's files, split: what the asker attached (before the answer
// heading) and what came back (after it). Oldest first in each.
export type PageFiles = { files: BlakeFile[]; responseFiles: BlakeFile[] };
export async function listPageFiles(token: string, pageId: string): Promise<PageFiles> {
  const files: BlakeFile[] = [];
  const responseFiles: BlakeFile[] = [];
  let inResponse = false;
  for await (const b of childBlocks(token, pageId)) {
    if (isResponseHeading(b)) { inResponse = true; continue; }
    const f = fileFromBlock(b);
    if (f) (inResponse ? responseFiles : files).push(f);
  }
  return { files, responseFiles };
}

// make sure the page has its answer heading so reply files land under it
export async function ensureResponseHeading(token: string, pageId: string, by: Side): Promise<void> {
  for await (const b of childBlocks(token, pageId)) if (isResponseHeading(b)) return;
  const r = await fetch(`${NOTION}/blocks/${pageId}/children`, {
    method: "PATCH",
    headers: notionHeaders(token),
    body: JSON.stringify({ children: [{ object: "block", type: "heading_2", heading_2: { rich_text: richText(RESPONSE_HEADINGS[by]) } }] }),
  });
  if (!r.ok) throw new Error((await r.json())?.message || `notion ${r.status}`);
}
