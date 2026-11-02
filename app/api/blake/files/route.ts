import { del } from "@vercel/blob";
import { NOTION, json, preflight, notionHeaders, getFilesHolder, listFiles, listPageFiles } from "../shared";

// Files Knox dropped for Blake: the child blocks of the "Files from Knox"
// holder page. GET lists them (fresh signed URLs each time), POST removes one.
// GET ?page=<id> instead lists one request page's files, split into what
// Blake attached and what Knox sent back.

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);
  try {
    const page = new URL(req.url).searchParams.get("page");
    if (page) return json(req, await listPageFiles(token, page));
    const holder = await getFilesHolder(token, dbId, false);
    return json(req, { files: holder ? await listFiles(token, holder) : [] });
  } catch (e) {
    console.error("blake files GET", e);
    return json(req, { error: "notion" }, 502);
  }
}

export async function POST(req: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return json(req, { error: "not configured" }, 500);
  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }
  if (body?.action !== "remove" || !body.id) return json(req, { error: "unknown action" }, 400);
  try {
    const id = String(body.id);
    // a file that lives in the Blob store goes with its block
    let blobUrl = "";
    try {
      const b = await fetch(`${NOTION}/blocks/${id}`, { headers: notionHeaders(token), cache: "no-store" }).then((x) => x.json());
      const ext = b?.[b?.type]?.external?.url || "";
      if (/vercel-storage\.com$/i.test(new URL(ext).hostname)) blobUrl = ext;
    } catch {}
    const r = await fetch(`${NOTION}/blocks/${id}`, { method: "DELETE", headers: notionHeaders(token) });
    if (!r.ok) return json(req, { error: (await r.json())?.message || "notion" }, r.status);
    if (blobUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try { await del(blobUrl); } catch (e) { console.error("blob del", e); }
    }
    return json(req, { ok: true });
  } catch (e) {
    console.error("blake files POST", e);
    return json(req, { error: "notion" }, 502);
  }
}
