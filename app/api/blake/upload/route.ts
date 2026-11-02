import { NextResponse } from "next/server";

// Attach a dropped file to one of Blake's pages. Three Notion calls: open a
// file upload, send the bytes, append the result to the page as an image or
// file block. Vercel caps a function's request body around 4.5 MB, so the
// app downsizes photos before sending and anything larger is refused here.

export const revalidate = 0;
export const maxDuration = 60;

const NOTION = "https://api.notion.com/v1";
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  "https://kmvtesting.vercel.app",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://kmvtesting.vercel.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return json(req, { error: "not configured" }, 500);

  let form: FormData;
  try { form = await req.formData(); } catch { return json(req, { error: "bad form" }, 400); }
  const pageId = String(form.get("pageId") || "");
  const file = form.get("file");
  if (!pageId || !(file instanceof File)) return json(req, { error: "pageId and file required" }, 400);
  if (file.size === 0) return json(req, { error: "empty file" }, 400);
  if (file.size > MAX_BYTES) return json(req, { error: "too large", limit: MAX_BYTES }, 413);

  const auth = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" };
  const filename = (file.name || "file").slice(0, 120);
  const contentType = file.type || "application/octet-stream";

  try {
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

    // 3. hang it on the page
    const isImage = /^image\/(png|jpe?g|gif|webp|heic|heif|svg\+xml)$/i.test(contentType);
    const block = isImage
      ? { object: "block", type: "image", image: { type: "file_upload", file_upload: { id: opened.id } } }
      : { object: "block", type: "file", file: { type: "file_upload", file_upload: { id: opened.id }, name: filename } };
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
