import { NOTION, json, preflight, notionHeaders, getFilesHolder, listFiles } from "../shared";

// Files Knox dropped for Blake: the child blocks of the "Files from Knox"
// holder page. GET lists them (fresh signed URLs each time), POST removes one.

export const revalidate = 0;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);
  try {
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
    const r = await fetch(`${NOTION}/blocks/${String(body.id)}`, { method: "DELETE", headers: notionHeaders(token) });
    if (!r.ok) return json(req, { error: (await r.json())?.message || "notion" }, r.status);
    return json(req, { ok: true });
  } catch (e) {
    console.error("blake files POST", e);
    return json(req, { error: "notion" }, 502);
  }
}
