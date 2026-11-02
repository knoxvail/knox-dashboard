import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { corsHeaders, json, preflight } from "../shared";

// Token exchange for direct browser-to-Blob uploads. The file bytes never
// touch this function (Vercel caps a function body at 4.5 MB); the browser
// asks here for a short-lived client token, uploads straight to the Blob
// store, then tells /api/blake/attach where the file landed. Needs
// BLOB_READ_WRITE_TOKEN in the env, which the store connection added.

export const revalidate = 0;

const MAX_BYTES = 500 * 1024 * 1024;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(req, { error: "blob not configured" }, 500);
  let body: HandleUploadBody;
  try { body = (await req.json()) as HandleUploadBody; } catch { return json(req, { error: "bad json" }, 400); }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_BYTES,
        tokenPayload: JSON.stringify({ pathname }),
      }),
      // the browser reports completion itself by calling /api/blake/attach;
      // nothing to do on the webhook
      onUploadCompleted: async () => {},
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  } catch (e) {
    console.error("blake blob token", e);
    return json(req, { error: (e as Error)?.message || "blob" }, 400);
  }
}
