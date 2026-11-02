import { NOTION, json, preflight, notionHeaders, richText, rowFromPage, queryBlake } from "./shared";

// Blake's list. His rows live in the same tasks database as everything else,
// marked Dashboard = "Blake" so they stay out of Knox's buckets. The static
// app at kmvtesting.vercel.app/blake/ talks to this route cross-origin, so
// every response carries CORS headers for that origin (and localhost while
// developing). Files Knox drops for him live under /api/blake/files, and
// the weekly sweep of finished items is /api/blake/sweep.

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
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
