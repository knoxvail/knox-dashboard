import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// The dashboard's ask box. Streams a Claude answer back as plain text.
// Key resolution: the server env key wins; otherwise the key Knox pasted
// into the panel rides in on a header (stored only in his browser).
// The key is never logged and never echoed back.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

const PERSONA = `You are the assistant built into Knox's personal command-center dashboard. Knox does multifamily and senior living acquisitions with his father, and runs a web design business on the side (UVRC, Triad).

Answer directly and lead with the answer. Keep it short, a few sentences unless he asks for depth. Plain concrete language. No em dashes. No bullet lists unless he asks for a list. The board snapshot below is live from his Notion; use it when the question touches his work, and don't recite it back to him.`;

type AskMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  let body: { messages?: AskMsg[]; digest?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const key = process.env.ANTHROPIC_API_KEY || req.headers.get("x-ask-key") || "";
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 401 });

  // sanitize history: role-checked, size-capped, last 20 turns
  const history = (body.messages || [])
    .filter((m): m is AskMsg => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const digest = typeof body.digest === "string" ? body.digest.slice(0, 6000) : "";
  const system = digest ? `${PERSONA}\n\nCurrent board:\n${digest}` : PERSONA;

  const client = new Anthropic({ apiKey: key });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: history,
    // a safety decline re-runs on a fallback model inside the same call
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as Parameters<typeof client.beta.messages.stream>[0]);

  // Pull the first event before committing to a 200 so auth/rate errors
  // come back as real statuses the panel can react to.
  const events = stream[Symbol.asyncIterator]();
  let first: IteratorResult<Anthropic.Beta.BetaRawMessageStreamEvent>;
  try {
    first = await events.next();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "bad_key" }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: err.message || "api_error" }, { status: typeof err.status === "number" ? err.status : 502 });
    }
    return NextResponse.json({ error: "network" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      const take = (ev: Anthropic.Beta.BetaRawMessageStreamEvent) => {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
          controller.enqueue(encoder.encode(ev.delta.text));
          wrote = true;
        }
      };
      try {
        if (!first.done) take(first.value);
        for (let r = await events.next(); !r.done; r = await events.next()) take(r.value);
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !wrote) {
          controller.enqueue(encoder.encode("Claude declined that one."));
        }
      } catch {
        if (!wrote) controller.enqueue(encoder.encode("The answer got cut off. Ask again."));
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
