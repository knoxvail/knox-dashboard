import crypto from "crypto";

// What the census job remembers between runs: three small code blocks on the
// holder row in Notion (the row that carries the census database).
//
//   census-login   The Triad Gmail login the job uses when nobody has the
//                  dashboard open. It is the same refresh token the dashboard
//                  keeps in its cookie, sealed with AES-256-GCM under a key
//                  made from two secrets that exist only in the server's
//                  environment, so the text sitting in Notion is useless on
//                  its own. Only the signed-in dashboard writes it, and
//                  only once the owner has turned it on.
//   census-status  When the job last checked, which report it logged, how far
//                  the log runs, and which report the daily email last went
//                  out for. Every run writes it.
//   census-mail    The census email's settings: off or on, who else gets it
//                  besides the owner, and how often each of them does (every
//                  report, Fridays, or the first report of the month). Only
//                  the owner writes it, from /api/census/job. It does not
//                  exist until they change something; until then the email
//                  is on and goes to the owner alone.
//
// Separate blocks, so a status write can never undo a fresh login or a
// change to who gets the email.
//
// Keeping a login is the owner's choice. No login is written until they turn
// it on at /api/census/job, and turning it off there empties that block.
//
// Set CENSUS_SAVED_LOGIN=off in the environment to stop the job keeping or
// using a login at all; the census then only syncs while the dashboard is open.

const NOTION = "https://api.notion.com/v1";

export const CENSUS_HOLDER = process.env.NOTION_CENSUS_HOLDER_ID || "415c40ab-ce39-81b3-b2c1-ca411566195e";

// read at call time, so a changed setting needs no code change
export const savedLoginOn = () => process.env.CENSUS_SAVED_LOGIN !== "off";

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
  // the daily email (see daily.ts)
  mailed?: string; // Gmail id of the newest report the email has gone out for
  mailedAt?: string;
  mailedTo?: number; // how many people it went to
  mailing?: string; // "<report id>@<time>": a run has claimed the send
  mailTry?: string; // "<report id>#<n>": failed sends for that report; it stops trying at five
  mailNote?: string; // "sent", or what stopped the last send
  // the slower schedules (see daily.ts): which period's email is done, and when it went
  weekly?: string; // the Friday, YYYY-MM-DD, that starts the week whose email is done
  weeklyAt?: string;
  monthly?: string; // YYYY-MM, the month whose email is done
  monthlyAt?: string;
};

// how often someone gets the email: with every report, with the first report
// of each week (Friday), or with the first report of each month
export type Every = "day" | "week" | "month";

export type MailNote = {
  kind: "census-mail";
  off?: boolean; // the owner turned the daily email off
  to?: string[]; // who else gets it; the owner always does, with every report
  every?: Record<string, "week" | "month">; // anyone in `to` on a slower schedule
  changed?: string;
};

type Slot<T> = { id: string | null; data: T };
export type Memory = { login: Slot<LoginNote>; status: Slot<StatusNote>; mail: Slot<MailNote> };

const CAPTIONS: Record<string, string> = {
  "census-login":
    "Census job login, sealed. Lets the job read the census report with the dashboard closed. Rewritten when the dashboard signs in to Gmail again.",
  "census-status": "Census job status. Rewritten after every check.",
  "census-mail": "Census email settings: on or off, who else gets it, and how often. Changed from the census job page.",
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

// ---------- the blocks ----------

// null when Notion cannot be read at all
export async function readMemory(token: string): Promise<Memory | null> {
  try {
    const r = await fetch(`${NOTION}/blocks/${CENSUS_HOLDER}/children?page_size=100`, { headers: headers(token), cache: "no-store" });
    if (!r.ok) return null;
    const mem: Memory = {
      login: { id: null, data: { kind: "census-login" } },
      status: { id: null, data: { kind: "census-status" } },
      mail: { id: null, data: { kind: "census-mail" } },
    };
    for (const b of (await r.json()).results || []) {
      if (b?.type !== "code") continue;
      const text = (b.code?.rich_text || []).map((t: { plain_text?: string }) => t.plain_text || "").join("");
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }
      if (data?.kind === "census-login" && !mem.login.id) mem.login = { id: b.id, data };
      else if (data?.kind === "census-status" && !mem.status.id) mem.status = { id: b.id, data };
      else if (data?.kind === "census-mail" && !mem.mail.id) mem.mail = { id: b.id, data };
    }
    return mem;
  } catch {
    return null;
  }
}

async function write(token: string, slot: Slot<LoginNote | StatusNote | MailNote>): Promise<boolean> {
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
  return savedLoginOn() ? unseal(mem.login.data.login) : null;
}

export async function rememberLogin(token: string, mem: Memory, refreshToken: string): Promise<boolean> {
  const box = savedLoginOn() ? seal(refreshToken) : null;
  if (!box) return false;
  mem.login.data = { kind: "census-login", login: box, saved: new Date().toISOString() };
  return write(token, mem.login);
}

// keeps the block, empties it: no login, and no standing consent to keep one
export async function forgetLogin(token: string, mem: Memory): Promise<boolean> {
  if (!mem.login.id) return true;
  mem.login.data = { kind: "census-login" };
  return write(token, mem.login);
}

export async function saveStatus(token: string, mem: Memory, patch: Partial<StatusNote>): Promise<boolean> {
  mem.status.data = { ...mem.status.data, ...patch, kind: "census-status" };
  return write(token, mem.status);
}

// The same, on top of what is in Notion right now instead of what this run
// read when it started. A run can take ten seconds, and another may have
// written in the meantime, most importantly that it sent the daily email.
// Writing an old copy back over that would send the email twice.
export async function saveStatusFresh(token: string, mem: Memory, patch: Partial<StatusNote>): Promise<boolean> {
  const now = await readMemory(token);
  if (now && now.status.id) mem.status = now.status;
  return saveStatus(token, mem, patch);
}

// ---------- the daily email's settings ----------

const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// "a@x.com, B@y.com; c@z.com" -> a clean list, or null if any piece is not an address
export function addressList(text: string): string[] | null {
  const out: string[] = [];
  for (const piece of text.split(/[\s,;]+/)) {
    const a = piece.trim().toLowerCase();
    if (!a) continue;
    if (!ADDRESS.test(a) || a.length > 120) return null;
    if (!out.includes(a)) out.push(a);
  }
  return out.length > 12 ? null : out;
}

// who else gets the email; anything in the block that is not an address is dropped
export const mailExtras = (mem: Memory): string[] =>
  (Array.isArray(mem.mail.data.to) ? mem.mail.data.to : []).filter((a) => typeof a === "string" && ADDRESS.test(a)).slice(0, 12);

// everyone besides the owner, each with how often they get it
export function mailPlan(mem: Memory): { address: string; every: Every }[] {
  const slow = mem.mail.data.every && typeof mem.mail.data.every === "object" ? mem.mail.data.every : {};
  return mailExtras(mem).map((address) => {
    const e = slow[address];
    return { address, every: e === "week" || e === "month" ? e : "day" };
  });
}

// The list as the owner typed it on the page: an address per row and a
// schedule beside each. Blank rows drop out; an address typed twice keeps its
// first schedule. null if any row is not an address.
export function planFrom(addresses: string[], everies: string[]): Pick<MailNote, "to" | "every"> | null {
  const to: string[] = [];
  const every: Record<string, "week" | "month"> = {};
  for (let i = 0; i < addresses.length; i++) {
    const list = addressList(addresses[i] || "");
    if (!list) return null;
    const e = everies[i];
    for (const a of list) {
      if (to.includes(a)) continue;
      to.push(a);
      if (e === "week" || e === "month") every[a] = e;
    }
  }
  return to.length > 12 ? null : { to, every };
}

export const mailIsOn = (mem: Memory): boolean => mem.mail.data.off !== true;

export async function saveMail(token: string, mem: Memory, patch: Partial<MailNote>): Promise<boolean> {
  mem.mail.data = { ...mem.mail.data, ...patch, kind: "census-mail", changed: new Date().toISOString() };
  return write(token, mem.mail);
}
