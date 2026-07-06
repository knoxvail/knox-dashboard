import { NextResponse } from "next/server";

export const revalidate = 0;

// A project's checklist items are stored as to_do blocks inside its Notion page.
// Notion pages don't expose a child count, so we fetch each project's children to
// show item counts and the hover preview. Errors are swallowed to [] so one bad
// project never fails the whole tasks GET.
async function fetchChecklist(token: string, pageId: string): Promise<{ id: string; text: string; checked: boolean }[]> {
  const headers = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" };
  const items: { id: string; text: string; checked: boolean }[] = [];
  try {
    let cursor: string | undefined;
    // page through ALL children (a page may hold >100 blocks) accumulating to_dos
    do {
      const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
      url.searchParams.set("page_size", "100");
      if (cursor) url.searchParams.set("start_cursor", cursor);

      let r = await fetch(url, { headers, cache: "no-store" });
      // one polite retry if rate-limited, so a burst doesn't blank a checklist
      if (r.status === 429) {
        const wait = (Number(r.headers.get("retry-after")) || 1) * 1000;
        await new Promise((res) => setTimeout(res, Math.min(wait, 3000)));
        r = await fetch(url, { headers, cache: "no-store" });
      }
      if (!r.ok) {
        // log the failure instead of masking a permission/rate error as "empty"
        console.error(`fetchChecklist ${pageId} -> ${r.status}`);
        return items;
      }
      const d = await r.json();
      for (const b of (d.results || [])) {
        if (b.type === "to_do") {
          items.push({
            id: b.id,
            text: (b.to_do?.rich_text || []).map((t: any) => t.plain_text).join(""),
            checked: !!b.to_do?.checked,
          });
        }
      }
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);
    return items;
  } catch (e) {
    console.error(`fetchChecklist ${pageId} error`, e);
    return items;
  }
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return NextResponse.json({ shortTerm: [], longTerm: [], clients: [] });

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 50,
      }),
      cache: "no-store",
    });
    const data = await res.json();

    const shortTerm: { id: string; title: string; priority: boolean; order: number | null }[] = [];
    const longTerm: { id: string; title: string; priority: boolean; order: number | null }[] = [];
    const clients: { id: string; title: string; order: number | null }[] = [];

    (data.results || []).forEach((page: any) => {
      const titleProp = Object.values(page.properties).find((p: any) => p.type === "title") as any;
      const title = titleProp?.title?.map((t: any) => t.plain_text).join("") || "";
      if (!title) return;

      // manual-reorder position (null until the user drags something)
      const order = (page.properties as any)["Order"]?.number ?? null;

      // Clients are tagged with the Type select (status options can't be
      // created via the API, but select options can)
      const typeProp = (page.properties as any)["Type"];
      if (typeProp?.select?.name === "Client") {
        clients.push({ id: page.id, title, order });
        return;
      }

      const statusProp = Object.values(page.properties).find((p: any) => p.type === "status") as any;
      const status = statusProp?.status?.name || "";
      const priority = !!(page.properties as any)["Priority"]?.checkbox;

      if (status === "Short Term") shortTerm.push({ id: page.id, title, priority, order });
      else if (status === "Long Term") longTerm.push({ id: page.id, title, priority, order });
    });

    // enrich Short Term and Long Term with their checklists (child to_do blocks)
    // so items persist when a task moves between the two lists. Promise.all keeps
    // wall-time to ~one round trip for a handful of tasks.
    const [longTermFull, shortTermFull] = await Promise.all([
      Promise.all(longTerm.map(async (p) => ({ ...p, items: await fetchChecklist(token, p.id) }))),
      Promise.all(shortTerm.map(async (t) => ({ ...t, items: await fetchChecklist(token, t.id) }))),
    ]);

    return NextResponse.json({ shortTerm: shortTermFull, longTerm: longTermFull, clients });
  } catch {
    return NextResponse.json({ shortTerm: [], longTerm: [], clients: [] });
  }
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, title, status, action } = body;

    // Handle moving a task between Short Term and Long Term (status change)
    if (action === "move") {
      if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });
      if (status !== "Short Term" && status !== "Long Term") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { Status: { status: { name: status } } },
        }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true });
    }

    // Handle task completion (archive)
    if (action === "complete") {
      if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true });
    }

    // Restore (un-archive) a page — used by Undo
    if (action === "restore") {
      if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });
      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: false }),
      });
      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }
      return NextResponse.json({ success: true });
    }

    // Handle task update (edit)
    if (action === "update") {
      if (!id || !title) {
        return NextResponse.json({ error: "Missing id or title" }, { status: 400 });
      }

      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
      }

      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            Name: {
              title: [{ text: { content: title.trim() } }],
            },
          },
        }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true });
    }

    // ----- Checklist items (to_do blocks inside a project's page) -----

    // Add a checklist item to a project (projectId = Notion PAGE id)
    if (action === "addChecklistItem") {
      const { projectId, text } = body;
      if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
      if (typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json({ error: "Invalid text" }, { status: 400 });
      }

      const notionRes = await fetch(`https://api.notion.com/v1/blocks/${projectId}/children`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          children: [
            { type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: text.trim() } }], checked: false } },
          ],
        }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      // return the real block id so the client can swap out its temp id
      const j = await notionRes.json();
      const blockId = j.results?.[0]?.id;
      return NextResponse.json({ success: true, item: { id: blockId, text: text.trim(), checked: false } });
    }

    // Delete (archive) a checklist item (itemId = Notion BLOCK id)
    if (action === "deleteChecklistItem") {
      const { itemId } = body;
      if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

      const notionRes = await fetch(`https://api.notion.com/v1/blocks/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }

      return NextResponse.json({ success: true, id: itemId });
    }

    // Rename a checklist item (itemId = Notion BLOCK id)
    if (action === "updateChecklistItem") {
      const { itemId, text } = body;
      if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
      if (typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json({ error: "Invalid text" }, { status: 400 });
      }
      const notionRes = await fetch(`https://api.notion.com/v1/blocks/${itemId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to_do: { rich_text: [{ type: "text", text: { content: text.trim() } }] } }),
      });
      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }
      return NextResponse.json({ success: true, item: { id: itemId, text: text.trim() } });
    }

    // Flag/unflag a task as high priority (Priority checkbox on the page)
    if (action === "setPriority") {
      if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });
      if (typeof body.priority !== "boolean") {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties: { Priority: { checkbox: body.priority } } }),
      });
      if (!notionRes.ok) {
        const err = await notionRes.json();
        return NextResponse.json({ error: err }, { status: notionRes.status });
      }
      return NextResponse.json({ success: true });
    }

    // Merge one task/project INTO another: append the source's title (and its
    // checklist items) as to_do blocks in the target page, then archive the source.
    if (action === "mergeInto") {
      const { targetId, sourceId, title, items } = body;
      if (!targetId || !sourceId) {
        return NextResponse.json({ error: "Missing targetId or sourceId" }, { status: 400 });
      }

      const children = [
        { type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: String(title || "Untitled").slice(0, 2000) } }], checked: false } },
        ...(Array.isArray(items) ? items : []).map((it: any) => ({
          type: "to_do",
          to_do: { rich_text: [{ type: "text", text: { content: String(it?.text || "").slice(0, 2000) } }], checked: !!it?.checked },
        })),
      ];

      const appendRes = await fetch(`https://api.notion.com/v1/blocks/${targetId}/children`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({ children }),
      });
      if (!appendRes.ok) {
        const err = await appendRes.json();
        return NextResponse.json({ error: err }, { status: appendRes.status });
      }
      const appendJson = await appendRes.json();
      const appendedIds = (appendJson.results || []).map((b: any) => b.id);

      // archive the now-merged source page
      const archiveRes = await fetch(`https://api.notion.com/v1/pages/${sourceId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!archiveRes.ok) {
        const err = await archiveRes.json();
        return NextResponse.json({ error: err, appended: true }, { status: archiveRes.status });
      }

      // return the appended block ids so an Undo can remove them again
      return NextResponse.json({ success: true, appendedIds });
    }

    // Undo a merge: restore the archived source page and delete the blocks that
    // were appended to the target.
    if (action === "unmerge") {
      const { sourceId, blockIds } = body;
      if (!sourceId) return NextResponse.json({ error: "Missing sourceId" }, { status: 400 });
      const H = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
      await fetch(`https://api.notion.com/v1/pages/${sourceId}`, {
        method: "PATCH", headers: H, body: JSON.stringify({ archived: false }),
      }).catch(() => {});
      if (Array.isArray(blockIds)) {
        await Promise.all(blockIds.map((bid: string) =>
          fetch(`https://api.notion.com/v1/blocks/${bid}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
          }).catch(() => {})
        ));
      }
      return NextResponse.json({ success: true });
    }

    // Ensure the tasks DB has an "Order" number property (used to persist manual
    // reordering). Idempotent — safe to call on every load.
    if (action === "ensureOrderField") {
      const dbId = process.env.NOTION_DB_ID;
      if (!dbId) return NextResponse.json({ error: "No db" }, { status: 500 });
      const H = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${dbId}`, { headers: H, cache: "no-store" });
      if (!dbRes.ok) return NextResponse.json({ error: await dbRes.json() }, { status: dbRes.status });
      const db = await dbRes.json();
      if (db.properties?.Order) return NextResponse.json({ success: true, existed: true });
      const patch = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        method: "PATCH", headers: H, body: JSON.stringify({ properties: { Order: { number: {} } } }),
      });
      if (!patch.ok) return NextResponse.json({ error: await patch.json() }, { status: patch.status });
      return NextResponse.json({ success: true, created: true });
    }

    // Persist a manual reorder: write Order = index for each page id in `ids`.
    if (action === "reorderTasks") {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "Missing ids" }, { status: 400 });
      const H = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
      const results = await Promise.all(ids.map((pid: string, i: number) =>
        fetch(`https://api.notion.com/v1/pages/${pid}`, {
          method: "PATCH", headers: H, body: JSON.stringify({ properties: { Order: { number: i } } }),
        }).then((r) => r.ok).catch(() => false)
      ));
      return NextResponse.json({ success: results.every(Boolean), written: results.filter(Boolean).length });
    }

    // Persist a checklist reorder. Notion has no block-move API, so recreate the
    // to_do blocks in the new order: append the new sequence FIRST, then delete
    // the old blocks (append-first so a failure duplicates rather than loses data).
    if (action === "reorderChecklist") {
      const { projectId, items, oldIds } = body;
      if (!projectId || !Array.isArray(items)) return NextResponse.json({ error: "Missing projectId or items" }, { status: 400 });
      const H = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
      const children = items.map((it: any) => ({
        type: "to_do",
        to_do: { rich_text: [{ type: "text", text: { content: String(it?.text || "").slice(0, 2000) } }], checked: !!it?.checked },
      }));
      const appendRes = await fetch(`https://api.notion.com/v1/blocks/${projectId}/children`, {
        method: "PATCH", headers: H, body: JSON.stringify({ children }),
      });
      if (!appendRes.ok) return NextResponse.json({ error: await appendRes.json() }, { status: appendRes.status });
      const appendJson = await appendRes.json();
      const newItems = (appendJson.results || []).map((b: any, i: number) => ({ id: b.id, text: items[i]?.text || "", checked: !!items[i]?.checked }));
      if (Array.isArray(oldIds)) {
        await Promise.all(oldIds.map((bid: string) =>
          fetch(`https://api.notion.com/v1/blocks/${bid}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" } }).catch(() => {})
        ));
      }
      return NextResponse.json({ success: true, items: newItems });
    }

    // Pull a checklist item out of a project into its own Short Term task:
    // create the task, then delete the item's block from the project.
    if (action === "extractItem") {
      const { projectId, itemId, text } = body;
      const dbId = process.env.NOTION_DB_ID;
      if (!dbId || !projectId || !itemId || typeof text !== "string") return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      const H = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
      const createRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers: H,
        body: JSON.stringify({ parent: { database_id: dbId }, properties: {
          Name: { title: [{ text: { content: (text.trim() || "Untitled").slice(0, 2000) } }] },
          Status: { status: { name: "Short Term" } },
        } }),
      });
      if (!createRes.ok) return NextResponse.json({ error: await createRes.json() }, { status: createRes.status });
      const created = await createRes.json();
      await fetch(`https://api.notion.com/v1/blocks/${itemId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" } }).catch(() => {});
      return NextResponse.json({ success: true, id: created.id });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/notion error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return NextResponse.json({ error: "No token" }, { status: 401 });

  try {
    const { title, status } = await request.json();

    if (!title || !status) {
      return NextResponse.json({ error: "Missing title or status" }, { status: 400 });
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    if (status !== "Short Term" && status !== "Long Term" && status !== "Clients") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Clients are tagged with the Type select property instead of Status
    // (the API can't create status options, but select options it can)
    const properties: Record<string, unknown> = {
      Name: { title: [{ text: { content: title.trim() } }] },
    };
    if (status === "Clients") {
      properties.Type = { select: { name: "Client" } };
    } else {
      properties.Status = { status: { name: status } };
    }

    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties,
      }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      return NextResponse.json({ error: err }, { status: notionRes.status });
    }

    // return the new page id so the client can swap its temp id in place
    const created = await notionRes.json();
    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error("PUT /api/notion error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}