import { NOTION, json, preflight, notionHeaders } from "../shared";

// A cheap fingerprint of Blake's rows for both pages to poll: row ids and
// their last-edited times (Notion bumps a page's time when its blocks
// change, so attachments count too). One Notion query, no block listings.
// When the value changes, the caller pulls the full data.

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);
  try {
    const stamps: string[] = [];
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
      for (const p of d.results || []) stamps.push(`${p.id}:${p.last_edited_time}`);
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);
    stamps.sort();
    // FNV-1a over the joined stamps; short, stable, good enough to spot a change
    let h = 2166136261;
    for (const ch of stamps.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return json(req, { v: `${stamps.length}-${h.toString(16)}` });
  } catch (e) {
    console.error("blake version", e);
    return json(req, { error: "notion" }, 502);
  }
}
