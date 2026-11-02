import { NOTION, json, preflight, richText, getFilesHolder } from "../shared";

// Attach a file to one of Blake's pages, or (target=files) to the "Files from
// Knox" holder page his app shows under From Knox. Three Notion calls: open a
// file upload, send the bytes, append the result to the page as an image or
// file block. Vercel caps a function's request body around 4.5 MB, so both
// apps downsize photos before sending and anything larger is refused here.

export const revalidate = 0;
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;
  if (!token || !dbId) return json(req, { error: "not configured" }, 500);

  let form: FormData;
  try { form = await req.formData(); } catch { return json(req, { error: "bad form" }, 400); }
  const target = String(form.get("target") || "");
  let pageId = String(form.get("pageId") || "");
  const file = form.get("file");
  if (!(file instanceof File)) return json(req, { error: "file required" }, 400);
  if (file.size === 0) return json(req, { error: "empty file" }, 400);
  if (file.size > MAX_BYTES) return json(req, { error: "too large", limit: MAX_BYTES }, 413);

  const auth = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" };
  const filename = (file.name || "file").slice(0, 120);
  const contentType = file.type || "application/octet-stream";

  try {
    if (target === "files") pageId = (await getFilesHolder(token, dbId, true)) || "";
    if (!pageId) return json(req, { error: "pageId or target required" }, 400);

    // 1. open the upload
    const open = await fetch(`${NOTION}/file_uploads`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content_type: contentType }),
    });
    const opened = await open.json();
    if (!open.ok) return json(req, { error: opened?.message || "notion open" }, open.status);

    // 2. send the bytes (multipart; the runtime sets the boundary)
    const fd = new FormData();
    fd.append("file", file, filename);
    const send = await fetch(opened.upload_url || `${NOTION}/file_uploads/${opened.id}/send`, {
      method: "POST",
      headers: auth,
      body: fd,
    });
    if (!send.ok) return json(req, { error: (await send.json())?.message || "notion send" }, send.status);

    // 3. hang it on the page; the caption carries the name so listings can show it
    const isImage = /^image\/(png|jpe?g|gif|webp|heic|heif|svg\+xml)$/i.test(contentType);
    const block = isImage
      ? { object: "block", type: "image", image: { type: "file_upload", file_upload: { id: opened.id }, caption: richText(filename) } }
      : { object: "block", type: "file", file: { type: "file_upload", file_upload: { id: opened.id }, name: filename, caption: richText(filename) } };
    const attach = await fetch(`${NOTION}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ children: [block] }),
    });
    if (!attach.ok) return json(req, { error: (await attach.json())?.message || "notion attach" }, attach.status);

    return json(req, { ok: true, name: filename });
  } catch (e) {
    console.error("blake upload", e);
    return json(req, { error: "upload failed" }, 502);
  }
}
