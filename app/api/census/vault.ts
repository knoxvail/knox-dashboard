import crypto from "crypto";

// What the census job remembers between runs: two small code blocks on the
// holder row in Notion (the row that carries the census database).
//
//   census-login   The Triad Gmail login the job uses when nobody has the
//                  dashboard open. It is the same refresh token the dashboard
//                  keeps in its cookie, sealed with AES-256-GCM under a key
//                  made from two secrets that exist only in the server's
//                  environment, so the text sitting in Notion is useless on
//                  its own. Only the signed-in dashboard writes it.
//   census-status  When the job last checked, which report it logged, and how
//                  far the log runs. Every run writes it.
//
// Two blocks, not one, so a status write can never undo a fresh login.
//
// Set CENSUS_SAVED_LOGIN=off in the environment to stop the job keeping or
// using a login at all; the census then only syncs while the dashboard is open.

const NOTION = "https://api.notion.com/v1";

export const CENSUS_HOLDER = process.env.NOTION_CENSUS_HOLDER_ID || "415c40ab-ce39-81b3-b2c1-ca411566195e";
export const SAVED_LOGIN_ON = process.env.CENSUS_SAVED_LOGIN !== "off";

export type LoginNote = { kind: "census-login"; login?: string; saved?: string };

export type StatusNote = {
  kind: "census-status";
  serverRun?: string; // last time the job started a check on its own login
  checked?: string; // last time any run read Carmen's mail
  by?: "board" | "job";
  report?: string; // Gmail id of the newest report that is fully logged
  reportDate?: string; // the day that report was sent
  through?: string; // newest day in the log
  note?: string; // "ok", or what stopped the last run
};

type Slot<T> = { id: string | null; data: T };
export type Memory = { login: Slot<LoginNote>; status: Slot<StatusNote> };

const CAPTIONS: Record<string, string> = {
  "census-login":
    "Census job login, sealed. Lets the job read Carmen's report with the dashboard closed. Rewritten when the dashboard signs in to Gmail again.",
  "census-status": "Census job status. Rewritten after every check.",
};

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

// ---------- sealing ----------

function key(): Buffer | null {
  const a = process.env.GOOGLE_CLIENT_SECRET;
  const b = process.env.NOTION_TOKEN;
  if (!a || !b) return null;
  return Buffer.from(crypto.hkdfSync("sha256", `${a}\n${b}`, "knox-dashboard", "census gmail login v1", 32));
}

// iv (12) + auth tag (16) + ciphertext, base64url
export function seal(text: string): string | null {
  const k = key();
  if (!k) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

// null for anything that is missing, edited, or sealed under other secrets
export function unseal(box: string | undefined): string | null {
  const k = key();
  if (!k || !box) return null;
  try {
    const raw = Buffer.from(box, "base64url");
    if (raw.length < 29) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8") || null;
  } catch {
    return null;
  }
}

// ---------- the two blocks ----------

// null when Notion cannot be read at all
export async function readMemory(token: string): Promise<Memory | null> {
  try {
    const r = await fetch(`${NOTION}/blocks/${CENSUS_HOLDER}/children?page_size=100`, { headers: headers(token), cache: "no-store" });
    if (!r.ok) return null;
    const mem: Memory = {
      login: { id: null, data: { kind: "census-login" } },
      status: { id: null, data: { kind: "census-status" } },
    };
    for (const b of (await r.json()).results || []) {
      if (b?.type !== "code") continue;
      const text = (b.code?.rich_text || []).map((t: { plain_text?: string }) => t.plain_text || "").join("");
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }
      if (data?.kind === "census-login" && !mem.login.id) mem.login = { id: b.id, data };
      else if (data?.kind === "census-status" && !mem.status.id) mem.status = { id: b.id, data };
    }
    return mem;
  } catch {
    return null;
  }
}

async function write(token: string, slot: Slot<LoginNote | StatusNote>): Promise<boolean> {
  const code = {
    language: "json",
    rich_text: [{ type: "text", text: { content: JSON.stringify(slot.data, null, 2) } }],
    caption: [{ type: "text", text: { content: CAPTIONS[slot.data.kind] } }],
  };
  try {
    if (slot.id) {
      const r = await fetch(`${NOTION}/blocks/${slot.id}`, { method: "PATCH", headers: headers(token), body: JSON.stringify({ code }) });
      return r.ok;
    }
    const r = await fetch(`${NOTION}/blocks/${CENSUS_HOLDER}/children`, {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ children: [{ object: "block", type: "code", code }] }),
    });
    if (!r.ok) return false;
    slot.id = (await r.json()).results?.[0]?.id || null;
    return true;
  } catch {
    return false;
  }
}

// the login the job holds, opened; null when there is none it can use
export function savedLogin(mem: Memory): string | null {
  return SAVED_LOGIN_ON ? unseal(mem.login.data.login) : null;
}

export async function rememberLogin(token: string, mem: Memory, refreshToken: string): Promise<boolean> {
  const box = SAVED_LOGIN_ON ? seal(refreshToken) : null;
  if (!box) return false;
  mem.login.data = { kind: "census-login", login: box, saved: new Date().toISOString() };
  return write(token, mem.login);
}

export async function saveStatus(token: string, mem: Memory, patch: Partial<StatusNote>): Promise<boolean> {
  mem.status.data = { ...mem.status.data, ...patch, kind: "census-status" };
  return write(token, mem.status);
}
