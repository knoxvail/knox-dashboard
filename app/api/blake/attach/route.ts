import { NOTION, json, preflight, richText, notionHeaders, getFilesHolder, ensureResponseHeading } from "../shared";

// After a browser has put a file in the Blob store, hang it on a Notion page
// as an external file or image block pointing at the Blob URL (public and
// permanent, unlike Notion-hosted links). Body: { url, name, contentType,
// pageId | target: "files", section?: "response", by?: "B" | "K" }.

export const revalidate = 0;

const BLOB_HOSTS = /\.(public\.blob\.vercel-storage\.com|vercel-storage\.com)$/i;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }
  const url = String(body?.url || "");
  const name = String(body?.name || "file").slice(0, 120);
  const contentType = String(body?.contentType || "");
  let host = "";
  try { host = new URL(url).hostname; } catch {}
  if (!url || !BLOB_HOSTS.test(host)) return json(req, { error: "url must be a Blob store link" }, 400);

  try {
    let pageId = String(body.pageId || "");
    if (body.target === "files") pageId = (await getFilesHolder(token, dbId, true)) || "";
    if (!pageId) return json(req, { error: "pageId or target required" }, 400);
    if (body.section === "response") await ensureResponseHeading(token, pageId, body.by === "B" ? "B" : "K");

    const isImage = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(contentType);
    const block = isImage
      ? { object: "block", type: "image", image: { type: "external", external: { url }, caption: richText(name) } }
      : { object: "block", type: "file", file: { type: "external", external: { url }, name, caption: richText(name) } };
    const attach = await fetch(`${NOTION}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ children: [block] }),
    });
    if (!attach.ok) return json(req, { error: (await attach.json())?.message || "notion attach" }, attach.status);
    return json(req, { ok: true, name, url });
  } catch (e) {
    console.error("blake attach", e);
    return json(req, { error: "attach failed" }, 502);
  }
}
