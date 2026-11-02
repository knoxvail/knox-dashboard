import { NOTION, json, preflight, notionHeaders, richText, rowFromPage, queryBlake, listPageFiles, ensureBlakeFields, type Side } from "./shared";

// Blake's list, both directions. Rows live in the same tasks database as
// everything else, marked Dashboard = "Blake" so they stay out of Knox's
// buckets; Side says who asked (B = Blake, K = Knox). The static app at
// kmvtesting.vercel.app/blake/ talks to this route cross-origin, so every
// response carries CORS headers for that origin (and localhost while
// developing). Loose files Knox drops live under /api/blake/files, and the
// weekly sweep of finished items is /api/blake/sweep.

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);
  try {
    // each item carries its attachments both ways, so his page can show what
    // was sent and what came back; a failed listing degrades to empty lists
    const rows = await queryBlake(token, dbId);
    const items = await Promise.all(rows.map(async (r) => {
      try {
        const pf = await listPageFiles(token, r.id);
        return { ...r, files: pf.files, responseFiles: pf.responseFiles };
      } catch {
        return { ...r, files: [], responseFiles: [] };
      }
    }));
    return json(req, { items });
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
    // a new ask, from either side
    if (action === "add") {
      const title = String(body.title || "").trim().slice(0, 200);
      const notes = String(body.notes || "").trim().slice(0, 4000);
      const side: Side = body.side === "K" ? "K" : "B";
      if (!title) return json(req, { error: "title required" }, 400);
      await ensureBlakeFields(token, dbId);
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
            Side: { select: { name: side } },
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

    // the other side answers an ask: a written reply (kept in the Response
    // property) and the row goes Complete. Reply files come separately
    // through /api/blake/upload with section=response and by=B|K.
    if (action === "respond") {
      const id = String(body.id || "");
      if (!id) return json(req, { error: "id required" }, 400);
      const text = String(body.text || "").trim().slice(0, 1900);
      await ensureBlakeFields(token, dbId);
      const r = await fetch(`${NOTION}/pages/${id}`, {
        method: "PATCH",
        headers: notionHeaders(token),
        body: JSON.stringify({ properties: {
          Response: { rich_text: text ? richText(text) : [] },
          Status: { status: { name: "Complete" } },
        } }),
      });
      if (!r.ok) return json(req, { error: (await r.json())?.message || "notion" }, r.status);
      return json(req, { ok: true, response: text });
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
