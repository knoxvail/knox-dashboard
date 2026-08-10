"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning
// while still measuring/positioning before paint in the browser).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Task = { id: string; title: string; order?: number | null; notes?: string; rating?: number | null };
type ChecklistItem = { id: string; text: string; checked: boolean }; // id = Notion BLOCK id
type Project = { id: string; title: string; items: ChecklistItem[]; priority?: boolean; order?: number | null; notes?: string; links?: string }; // id = Notion PAGE id
type SavedLink = { label: string; url: string };
// An action item written by the Cowork routine: a headline, a one-line why, and
// a full plan (its Notion page body) rendered in the same notes format.
type ActionItem = { id: string; title: string; notes?: string; plan?: string; order?: number | null; done?: boolean; status?: string };
type Verse = { ref: string; text: string };
type Email = { id: string; from: string; subject: string; date: string; link: string };
type Event = { id: string; title: string; displayDate: string; displayTime: string; type: string; editDate?: string; editTime?: string };
type NowPlaying = {
  connected: boolean; expired?: boolean; playing?: boolean;
  track?: string; artist?: string; album?: string;
  albumArt?: string; progress?: number; duration?: number;
};
type Playlist = { id: string; name: string; uri: string; image?: string };

// Glowy waves background — thin, subtle mouse-reactive lines kept up in the
// clock/time band so they don't read as being over the panel text.
function GlowyWaves() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, time = 0, raf = 0, baseY = 0;

    // thin waves kept up in the clock/time band (small amplitudes so they never
    // reach down over the panel text below)
    const waves = [
      { offset: 0, amplitude: 46, frequency: 0.003, color: "rgb(228,228,228)", opacity: 0.17 },
      { offset: Math.PI / 2, amplitude: 60, frequency: 0.0026, color: "rgb(200,200,200)", opacity: 0.14 },
      { offset: Math.PI, amplitude: 38, frequency: 0.0034, color: "rgb(180,180,180)", opacity: 0.12 },
      { offset: Math.PI * 1.5, amplitude: 52, frequency: 0.0022, color: "rgb(165,165,165)", opacity: 0.10 },
      { offset: Math.PI * 2, amplitude: 34, frequency: 0.004, color: "rgb(214,214,214)", opacity: 0.085 },
    ];

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const influenceRadius = prefersReduced ? 180 : 300;
    const mouseInfluence = prefersReduced ? 8 : 34;
    const smoothing = prefersReduced ? 0.04 : 0.1;

    const resize = () => {
      const de = document.documentElement;
      w = de.clientWidth || window.innerWidth;
      h = de.clientHeight || window.innerHeight;
      if (w < 2) w = 1280; // guard against bad viewport-width reads
      if (h < 2) h = 800;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseY = Math.min(h * 0.15, 150); // up near the time, clear of the panels
      mouse.current = { x: w / 2, y: baseY };
      target.current = { x: w / 2, y: baseY };
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => { target.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { target.current = { x: w / 2, y: baseY }; };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);

    const drawWave = (wave: typeof waves[number]) => {
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const dx = x - mouse.current.x;
        const dy = baseY - mouse.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / influenceRadius);
        const mouseEffect = influence * mouseInfluence * Math.sin(time * 0.001 + x * 0.01 + wave.offset);
        const y = baseY
          + Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude
          + Math.sin(x * wave.frequency * 0.4 + time * 0.003) * (wave.amplitude * 0.45)
          + mouseEffect;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      ctx.shadowBlur = 16;
      ctx.shadowColor = wave.color;
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      time += 1;
      mouse.current.x += (target.current.x - mouse.current.x) * smoothing;
      mouse.current.y += (target.current.y - mouse.current.y) * smoothing;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      waves.forEach(drawWave);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}

// One email line — click to read it in the dashboard; archive with the ✓.
function EmailRow({ email, onArchive, onOpen, onMakeTask }: { email: Email; onArchive: (id: string) => void; onOpen: (email: Email) => void; onMakeTask?: (email: Email) => void }) {
  return (
    <div className="reveal-row" style={{ borderBottom: "1px solid #1e1e1e", padding: "9px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, transition: "border-color 0.2s" }}
      onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "#555")}
      onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1e1e1e")}
    >
      <div role="button" tabIndex={0}
        onClick={() => onOpen(email)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(email); } }}
        style={{ minWidth: 0, flex: 1, cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
          <span style={{ fontSize: 12, color: "#d8d8d8", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{email.from}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#808080", flexShrink: 0 }}>{email.date}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#808080", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.subject}</p>
      </div>
      {onMakeTask && (
        <button
          className="row-action"
          aria-label={`Make a task from "${email.subject}"`}
          title="Make a Short Term task from this email"
          onClick={(e) => { e.stopPropagation(); onMakeTask(email); }}
          style={{
            background: "#1e1e1e", border: "1px solid #505050", borderRadius: 3, cursor: "pointer",
            color: "#aaa", lineHeight: 1, padding: "4px 7px", flexShrink: 0, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#aaa"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#505050"; }}
        ><span aria-hidden style={{ lineHeight: 1 }}>+</span></button>
      )}
      <DoneButton onClick={() => onArchive(email.id)} />
    </div>
  );
}

// Reads a single email inside the dashboard (sandboxed iframe for HTML, no
// scripts) with a link out to the original message.
function EmailReader({ source, email, onClose }: { source: "gmail" | "zoho"; email: Email; onClose: () => void }) {
  const [state, setState] = useState<{ loading: boolean; err: boolean; html?: string; text?: string; link?: string }>({ loading: true, err: false });
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [replyErr, setReplyErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setState({ loading: true, err: false });
    fetch(`/api/${source}?content=${encodeURIComponent(email.id)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!cancel) setState({ loading: false, err: false, html: d.html, text: d.text, link: d.link }); })
      .catch(() => { if (!cancel) setState({ loading: false, err: true }); });
    return () => { cancel = true; };
  }, [source, email.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link = state.link || email.link;
  const hasHtml = !!state.html && state.html.trim().length > 0;
  const hasText = !!state.text && state.text.trim().length > 0;

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true); setReplyErr(null);
    try {
      const res = await fetch(`/api/${source}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", id: email.id, body: replyText }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) { setSent(true); setReplying(false); setReplyText(""); }
      else if (d.needsReconnect) setReplyErr("Reconnect Gmail (Triad) to grant send permission, then try again.");
      else setReplyErr("Couldn’t send the reply.");
    } catch { setReplyErr("Couldn’t send the reply."); }
    setSending(false);
  };

  // wrap the email HTML in a dark base document so it matches the theme
  const darkDoc = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><base target="_blank"><style>:root{color-scheme:dark;}html,body{background:#0e1014;color:#e6e6e6;margin:0;padding:14px 16px;font-family:-apple-system,'DM Sans',Segoe UI,sans-serif;font-size:14px;line-height:1.55;word-break:break-word;}
/* Force every bit of the sender's text to a readable light color and strip their
   own (usually white) backgrounds, so black-on-white email content can't turn
   invisible on the dark reader. Overrides inline styles + bgcolor/color attrs. */
body *{color:#e6e6e6 !important;background-color:transparent !important;background-image:none !important;}
body a,body a *{color:#9fc0ff !important;}
img{max-width:100%;height:auto;}table{max-width:100%!important;}blockquote{border-left:2px solid #3a3a3a;margin:0 0 0 4px;padding-left:12px;}pre{white-space:pre-wrap;}</style></head><body>${html}</body></html>`;

  const btnSolid: React.CSSProperties = { background: "#1e1e1e", border: "1px solid #505050", color: "#ddd", fontSize: 11, padding: "5px 14px", borderRadius: 3, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase" };
  const btnGhost: React.CSSProperties = { background: "none", border: "1px solid #333", color: "#9a9a9a", fontSize: 11, padding: "5px 12px", borderRadius: 3, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase" };

  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9000, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", animation: "fadeIn 0.18s ease-out" }}>
      <div role="dialog" aria-modal="true" aria-label={email.subject}
        style={{ width: "min(680px, 94vw)", height: "min(80vh, 820px)", background: "rgba(12,14,18,0.96)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid #3a3a3a", borderRadius: 6, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", overflow: "hidden", animation: "modalIn 0.2s ease-out" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #242424", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, color: "#e8e8e8", fontWeight: 500, lineHeight: 1.35, wordBreak: "break-word" }}>{email.subject}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9a9a9a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.from}{email.date ? ` · ${email.date}` : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#808080", fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {state.loading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#808080", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em" }}>LOADING…</div>
          ) : hasHtml ? (
            <iframe title="Email content" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={darkDoc(state.html!)} style={{ flex: 1, width: "100%", border: "none", background: "#0e1014" }} />
          ) : hasText ? (
            <pre style={{ flex: 1, margin: 0, padding: "16px 18px", overflow: "auto", color: "#cfcfcf", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'DM Sans', sans-serif" }}>{state.text}</pre>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <p style={{ color: "#808080", fontSize: 13, textAlign: "center" }}>{state.err ? "Couldn’t load this message. " : "No preview available. "}Open the original below.</p>
            </div>
          )}
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid #242424", display: "flex", flexDirection: "column", gap: 8 }}>
          {replying && (
            <>
              <textarea autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder={`Reply to ${email.from}… (Enter to send, Shift+Enter for a new line)`} rows={4}
                style={{ width: "100%", boxSizing: "border-box", background: "#1a1a1a", border: "1px solid #333", color: "#ddd", fontSize: 13, padding: "8px 10px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 4, resize: "vertical", lineHeight: 1.5 }} />
              {replyErr && <span style={{ color: "#c06464", fontSize: 11, lineHeight: 1.4 }}>{replyErr}</span>}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#9a9a9a", textTransform: "uppercase", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e8e8")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9a9a9a")}>Open original ↗</a>
            {replying ? (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => { setReplying(false); setReplyText(""); setReplyErr(null); }} style={btnGhost}>Cancel</button>
                <button onClick={sendReply} disabled={sending || !replyText.trim()} style={{ ...btnSolid, opacity: (sending || !replyText.trim()) ? 0.5 : 1, cursor: (sending || !replyText.trim()) ? "default" : "pointer" }}>{sending ? "Sending…" : "Send"}</button>
              </div>
            ) : sent ? (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#7bd88f", textTransform: "uppercase", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>Sent <CheckIcon size={9} /></span>
            ) : (
              <button onClick={() => setReplying(true)} style={btnSolid}>Reply</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function useClock() {
  const [time, setTime] = useState({ h: "", m: "", s: "", date: "", day: "" });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime({
        h: String(now.getHours()).padStart(2, "0"),
        m: String(now.getMinutes()).padStart(2, "0"),
        s: String(now.getSeconds()).padStart(2, "0"),
        date: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        day: now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase(),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      letterSpacing: "0.15em",
      textTransform: "uppercase" as const,
      color: accent ? "#e8e8e8" : "#808080",
    }}>{children}</span>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      // translucent so the lake's glow shows through, with a blur that turns it
      // into a soft fog behind the content rather than a sharp distraction
      background: "rgba(12,14,18,0.5)",
      backdropFilter: "blur(7px)",
      WebkitBackdropFilter: "blur(7px)",
      border: "1px solid #2a2a2a",
      position: "relative",
      padding: "18px 20px",
      overflow: "hidden",
      ...style,
    }}>
      <div style={{ position: "absolute", top: -1, left: 16, width: 32, height: 1, background: "#999" }} />
      <div style={{ position: "absolute", top: -1, left: -1, width: 10, height: 10, borderTop: "1px solid #999", borderLeft: "1px solid #999" }} />
      {children}
    </div>
  );
}

function PanelHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      {/* real heading for the screen-reader outline, styled to match the accent Tag */}
      <h2 style={{
        margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 400,
        letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "#e8e8e8",
      }}>{label}</h2>
      {right}
    </div>
  );
}

function ConnectButton({ href, label }: { href: string; label: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <a href={href} style={{
        display: "inline-block", padding: "8px 16px",
        border: "1px solid #444", color: "#ddd",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
        letterSpacing: "0.15em", textDecoration: "none", textTransform: "uppercase" as const,
        transition: "border-color 0.2s, background 0.2s",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#999"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#444"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >{label}</a>
    </div>
  );
}

// A hairline check drawn as SVG rather than typed as a character. The ✓ glyph
// (U+2713) isn't in DM Sans, so Windows falls back to Segoe UI Emoji and it
// renders fat and colored, which reads as an emoji next to the hairline borders.
// Drawing it keeps the stroke thin at any size, and currentColor means it still
// inherits each button's existing hover color transition for free.
function CheckIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" style={{ display: "block" }}>
      <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Hairline calendar, same SVG treatment as CheckIcon so the two sit together.
function CalIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" style={{ display: "block" }}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth={2.2} />
      <path d="M3.5 10.5h17M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="row-action"
      aria-label="Done"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        background: "#1e1e1e",
        border: "1px solid #505050",
        cursor: "pointer",
        color: "#aaa",
        padding: "4px 8px",
        flexShrink: 0,
        borderRadius: 3,
        transition: "color 0.2s, border-color 0.2s, background 0.2s, opacity 0.15s",
        lineHeight: 1,
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={e => { (e.currentTarget.style.color = "#fff"); (e.currentTarget.style.borderColor = "#aaa"); (e.currentTarget.style.background = "#2a2a2a"); }}
      onMouseLeave={e => { (e.currentTarget.style.color = "#aaa"); (e.currentTarget.style.borderColor = "#505050"); (e.currentTarget.style.background = "#1e1e1e"); }}
    ><CheckIcon /></button>
  );
}

// 1–5 priority stars. Click a star to set it; click the current top star again to
// clear. stopPropagation everywhere so it never triggers the row's open/drag.
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div
      role="radiogroup" aria-label={`Priority ${value} of 5`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseLeave={() => setHover(0)}
      style={{ display: "flex", gap: 1, flexShrink: 0, alignItems: "center" }}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button
            key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-checked={value === n} role="radio"
            onMouseEnter={() => setHover(n)}
            onClick={(e) => { e.stopPropagation(); onChange(value === n ? 0 : n); }}
            style={{
              background: "none", border: "none", padding: "0 0.5px", cursor: "pointer", lineHeight: 1,
              fontSize: 11, color: on ? "#e8e8e8" : "#3a3a3a", transition: "color 0.12s",
            }}
          >★</button>
        );
      })}
    </div>
  );
}

function TaskItem({
  task,
  itemCount = 0,
  isEditing,
  onEdit,
  onComplete,
  onStartEdit,
  onCancelEdit,
  onOpen,
  onHover,
  onLeave,
  listKey,
  onReorder,
  hasNote = false,
  onRate,
  onToCalendar,
}: {
  task: Task;
  itemCount?: number; // how many checklist items this task/project holds (drives the hover preview)
  hasNote?: boolean; // show a small dot when this row (a client) has a saved note
  isEditing: boolean;
  onEdit: (id: string, newTitle: string) => Promise<void>;
  onComplete: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onOpen?: (id: string) => void; // when set, clicking the row opens the modal instead of inline-editing
  onHover?: (id: string, rect: DOMRect) => void; // preview this row's checklist on hover (only when it has content)
  onLeave?: () => void;
  listKey?: string; // which list this row belongs to (for same-list drag-reorder)
  onReorder?: (draggedId: string, targetId: string, placeBefore: boolean) => boolean;
  onRate?: (id: string, rating: number) => void; // when set (clients), show 1–5 priority stars
  onToCalendar?: (id: string) => void; // when set, show a calendar button that schedules this task
}) {
  const [inputValue, setInputValue] = useState(task.title);
  const [overSide, setOverSide] = useState<null | "top" | "bottom">(null); // reorder drop indicator
  const inputRef = useRef<HTMLInputElement>(null);
  const reorderType = `x-list/${listKey}`; // custom drag type, readable during dragover to detect same-list drags

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(task.title);
    }
  }, [task.title, isEditing]);

  const handleSubmit = async () => {
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== task.title) {
      await onEdit(task.id, trimmed);
    }
    onCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setInputValue(task.title);
      onCancelEdit();
    }
  };

  return (
    <div
      className="reveal-row"
      draggable={!isEditing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        if (listKey) e.dataTransfer.setData(reorderType, ""); // marks the source list so peers can detect same-list reorder
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.style.opacity = "0.4";
        onLeave?.(); // don't leave a stale preview pinned while dragging
      }}
      onDragEnd={(e) => { e.currentTarget.style.opacity = "1"; setOverSide(null); }}
      // same-list drag hovering → show an insertion line; always preventDefault so
      // cross-list drops still land here and bubble to the move/priority zone
      onDragOver={onReorder ? (e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes(reorderType)) {
          const b = e.currentTarget.getBoundingClientRect();
          setOverSide(e.clientY - b.top < b.height / 2 ? "top" : "bottom");
        }
      } : undefined}
      onDragLeave={onReorder ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverSide(null); } : undefined}
      onDrop={onReorder ? (e) => {
        const draggedId = e.dataTransfer.getData("text/plain");
        const before = overSide ? overSide === "top" : true;
        setOverSide(null);
        if (e.dataTransfer.types.includes(reorderType)) {
          const handled = onReorder(draggedId, task.id, before);
          if (handled) { e.preventDefault(); e.stopPropagation(); } // else let it bubble to the move/priority drop zone
        }
      } : undefined}
      style={{
        borderLeft: "1px solid #2a2a2a",
        paddingLeft: 10,
        transition: "border-color 0.2s, padding-left 0.2s",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
        cursor: isEditing ? "auto" : "grab",
        boxShadow: overSide === "top" ? "inset 0 2px 0 #8a8a8a" : overSide === "bottom" ? "inset 0 -2px 0 #8a8a8a" : "none",
      }}
      onMouseEnter={e => {
        if (!isEditing) {
          (e.currentTarget as HTMLElement).style.borderLeftColor = "#777";
          (e.currentTarget as HTMLElement).style.paddingLeft = "12px";
          // preview the checklist only when there's actually content to show
          if (onHover && itemCount > 0) onHover(task.id, (e.currentTarget as HTMLElement).getBoundingClientRect());
        }
      }}
      onMouseLeave={e => {
        if (!isEditing) {
          (e.currentTarget as HTMLElement).style.borderLeftColor = "#2a2a2a";
          (e.currentTarget as HTMLElement).style.paddingLeft = "10px";
        }
        onLeave?.();
      }}
    >
      {isEditing ? (
        <textarea
          ref={inputRef as any}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && e.ctrlKey) {
              handleSubmit();
            } else if (e.key === "Escape") {
              setInputValue(task.title);
              onCancelEdit();
            }
          }}
          placeholder="Task name..."
          style={{
            flex: 1,
            background: "#1a1a1a",
            border: "1px solid #333",
            color: "#ccc",
            fontSize: 12,
            padding: "5px 8px",
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            borderRadius: 2,
            minWidth: 0,
            resize: "none",
            overflow: "hidden",
            lineHeight: "1.5",
          }}
        />
      ) : (
        <p
          onClick={() => (onOpen ? onOpen(task.id) : onStartEdit(task.id))}
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(task.id); } } : undefined}
          style={{
            margin: 0,
            fontSize: 13,
            color: "#b0b0b0",
            lineHeight: 1.5,
            minWidth: 0,
            cursor: "pointer",
            flex: 1,
            transition: "color 0.2s, background-color 0.2s",
            padding: "2px 4px",
            borderRadius: 2,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "#e8e8e8";
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255, 255, 255, 0.05)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "#b0b0b0";
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
        >
          {hasNote && <span aria-label="has a note" title="Has a note" style={{ color: "#7fb0d8", marginRight: 6, fontSize: 9, verticalAlign: "middle" }}>●</span>}
          {task.title}
        </p>
      )}
      {onRate && !isEditing && <StarRating value={task.rating ?? 0} onChange={(v) => onRate(task.id, v)} />}
      {onToCalendar && !isEditing && (
        <button
          className="row-action"
          aria-label={`Send "${task.title}" to the calendar`}
          title="Put this on the calendar (reads any date in the title; otherwise today)"
          onClick={(e) => { e.stopPropagation(); onToCalendar(task.id); }}
          style={{
            background: "#1e1e1e", border: "1px solid #505050", borderRadius: 3, cursor: "pointer",
            color: "#aaa", lineHeight: 1, padding: "4px 7px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#aaa"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#505050"; }}
        ><CalIcon size={10} /></button>
      )}
      <DoneButton onClick={() => onComplete(task.id)} />
    </div>
  );
}

function TaskList({ tasks, onComplete, onEdit, onOpen, onHover, onLeave, listKey, onReorder, onRate, onToCalendar }: { tasks: Task[]; onComplete: (id: string) => void; onEdit: (id: string, newTitle: string) => Promise<void>; onOpen?: (id: string) => void; onHover?: (id: string, rect: DOMRect) => void; onLeave?: () => void; listKey?: string; onReorder?: (draggedId: string, targetId: string, placeBefore: boolean) => boolean; onRate?: (id: string, rating: number) => void; onToCalendar?: (id: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  if (tasks.length === 0) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#808080", fontSize: 12, textAlign: "center" }}>None</p>
    </div>
  );
  return (
    <>
      {tasks.map((t) => (
        <TaskItem
          key={t.id}
          task={t}
          itemCount={(t as Project).items?.length ?? 0}
          hasNote={!!t.notes?.trim()}
          isEditing={editingId === t.id}
          onEdit={onEdit}
          onComplete={onComplete}
          onStartEdit={(id) => setEditingId(id)}
          onCancelEdit={() => setEditingId(null)}
          onOpen={onOpen}
          onHover={onHover}
          onLeave={onLeave}
          listKey={listKey}
          onReorder={onReorder}
          onRate={onRate}
          onToCalendar={onToCalendar}
        />
      ))}
    </>
  );
}

type AddHandle = { open: () => void; openWith?: (seed: string) => void };
const AddTaskInput = forwardRef<AddHandle, { onAdd: (title: string) => Promise<unknown>; placeholder?: string }>(
  function AddTaskInput({ onAdd, placeholder = "New task..." }, ref) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // let the surrounding panel open the input by clicking empty space, and let
  // the type-anywhere shortcut open it already carrying the first keystroke
  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    openWith: (seed: string) => { setValue(v => v + seed); setOpen(true); },
  }), []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // auto-collapse when you interact anywhere outside the input and nothing was
  // typed (doesn't rely on focus/blur, so it always fires)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node) && !value.trim()) {
        setOpen(false); setValue("");
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, value]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    await onAdd(trimmed);
    setValue("");
    setOpen(false);
    setLoading(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} aria-label="Add new" title="Add new" style={{
      background: "none", border: "1px solid #2a2a2a", cursor: "pointer",
      marginTop: 10, width: 26, height: 26, borderRadius: 4, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", color: "#808080",
      transition: "color 0.2s, border-color 0.2s, background 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "#808080"; e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "none"; }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>
    </button>
  );

  return (
    <div ref={wrapRef} style={{ marginTop: 10, display: "flex", gap: 6 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }}
        // auto-collapse when you click away and nothing was typed
        onBlur={() => { if (!value.trim()) { setOpen(false); setValue(""); } }}
        placeholder={placeholder}
        style={{
          flex: 1, background: "#1a1a1a", border: "1px solid #333",
          color: "#ccc", fontSize: 12, padding: "5px 8px",
          fontFamily: "'DM Sans', sans-serif", outline: "none",
          borderRadius: 2,
        }}
      />
      <button onClick={submit} disabled={loading} style={{
        background: "#1e1e1e", border: "1px solid #505050",
        color: "#aaa", fontSize: 11, padding: "4px 10px",
        cursor: "pointer", borderRadius: 2, flexShrink: 0,
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em",
      }}>
        {loading ? "..." : "ADD"}
      </button>
      <button onClick={() => { setOpen(false); setValue(""); }} aria-label="Cancel" style={{
        background: "none", border: "none", color: "#808080",
        fontSize: 14, cursor: "pointer", padding: "0 4px",
      }}>✕</button>
    </div>
  );
});

// Add a scheduled event (title + date, optional time + type) from the dashboard.
const AddEventInput = forwardRef<AddHandle, { onAdd: (title: string, date: string, time: string, type: string) => Promise<void> }>(
  function AddEventInput({ onAdd }, ref) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
  useEffect(() => { if (open) setTimeout(() => titleRef.current?.focus(), 50); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node) && !title.trim() && !date && !time) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, title, date, time]);

  const canSubmit = !!title.trim() && !!date;
  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    await onAdd(title.trim(), date, time, type); // time may be "" → all-day event
    setTitle(""); setDate(""); setTime(""); setType(""); setOpen(false); setLoading(false);
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); };
  // Enter in the title advances to the date field and pops its picker open
  const onTitleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      dateRef.current?.focus();
      try { (dateRef.current as any)?.showPicker?.(); } catch {}
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} aria-label="Add event" title="Add event" style={{
      background: "none", border: "1px solid #2a2a2a", cursor: "pointer",
      marginTop: 10, width: 26, height: 26, borderRadius: 4, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", color: "#808080",
      transition: "color 0.2s, border-color 0.2s, background 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "#808080"; e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "none"; }}
    ><span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span></button>
  );

  const field: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", color: "#ccc",
    fontSize: 12, padding: "5px 8px", fontFamily: "'DM Sans', sans-serif",
    outline: "none", borderRadius: 2, colorScheme: "dark",
  };
  return (
    <div ref={wrapRef} style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={onTitleKey}
        placeholder="Event…" aria-label="Event name" style={{ ...field, flex: "1 1 100px", minWidth: 0 }} />
      <input ref={dateRef} type="date" value={date} onChange={e => setDate(e.target.value)} onKeyDown={onKey}
        aria-label="Date" style={field} />
      <input type="time" value={time} onChange={e => setTime(e.target.value)} onKeyDown={onKey}
        aria-label="Time (optional)" title="Time (optional)" style={field} />
      <select value={type} onChange={e => setType(e.target.value)} onKeyDown={onKey} aria-label="Type" style={{ ...field, cursor: "pointer" }}>
        <option value="">Type…</option>
        <option value="Appointment">Appointment</option>
        <option value="Meeting">Meeting</option>
        <option value="Deadline">Deadline</option>
        <option value="Personal">Personal</option>
      </select>
      <button onClick={submit} disabled={loading || !canSubmit} style={{
        background: "#1e1e1e", border: "1px solid #505050", color: "#aaa",
        fontSize: 11, padding: "4px 10px", cursor: canSubmit ? "pointer" : "default", borderRadius: 2, flexShrink: 0,
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", opacity: (loading || !canSubmit) ? 0.5 : 1,
      }}>{loading ? "..." : "ADD"}</button>
      <button onClick={() => setOpen(false)} aria-label="Cancel" style={{
        background: "none", border: "none", color: "#808080", fontSize: 14, cursor: "pointer", padding: "0 4px",
      }}>✕</button>
    </div>
  );
});

// Faint pastel that warms one tier per checklist item — green (nothing to do)
// through warm tones to purple (lots to do). Everything else stays monochrome.
const TASK_HUES = [140, 118, 96, 74, 54, 38, 22, 8, 352, 336, 320, 302, 285];
const taskHue = (count: number) => TASK_HUES[Math.min(Math.max(count, 0), TASK_HUES.length - 1)];

// ---- Saved reference links ("label|url" per line) -------------------------
// Only http(s) is ever turned into a real link, so a stored value can't smuggle
// in a javascript: URL.
const safeUrl = (raw: string) => {
  const u = raw.trim();
  if (!u) return "";
  const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try { const p = new URL(withProto); return p.protocol === "http:" || p.protocol === "https:" ? p.href : ""; }
  catch { return ""; }
};
const hostLabel = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const parseLinks = (src: string): SavedLink[] =>
  (src || "").split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const i = line.indexOf("|");
    const label = i >= 0 ? line.slice(0, i).trim() : "";
    const url = safeUrl(i >= 0 ? line.slice(i + 1) : line);
    return { label: label || hostLabel(url), url };
  }).filter(l => !!l.url);
const serializeLinks = (links: SavedLink[]) => links.map(l => `${l.label}|${l.url}`).join("\n");

// How "heavy" a project is — drives its tint and its position in the warmth sort.
// Counting items alone under-weights a project with two dense, detailed items, so
// factor in how much is actually written: the item text AND the notes.
const projectWeight = (p: Project) => {
  const itemChars = p.items.reduce((n, it) => n + (it.text || "").length, 0);
  const noteChars = (p.notes || "").length;
  return p.items.length + Math.floor((itemChars + noteChars) / 150);
};

// stable sort by manual Order; unordered items (null) keep their fetch order (last)
const byOrder = (a: { order?: number | null }, b: { order?: number | null }) => (a.order ?? Infinity) - (b.order ?? Infinity);

// clients sort by priority rating (5 → 0, highest first), then by manual Order
const byClient = (a: Task, b: Task) => (b.rating ?? 0) - (a.rating ?? 0) || byOrder(a, b);

// A Long Term "project" bucket: a draggable box that opens a modal on click and
// previews its checklist on hover. Drag (move to Short Term) and click (open) are
// disambiguated by a per-card drag flag.
function BucketCard({ project, onOpen, onHover, onLeave, onMerge }: {
  project: Project;
  onOpen: (id: string) => void;
  onHover: (id: string, rect: DOMRect) => void;
  onLeave: () => void;
  onMerge: (targetId: string, sourceId: string) => void; // drop another item onto this box
}) {
  const dragging = useRef(false);
  const [dropTarget, setDropTarget] = useState(false); // another item is hovering over this box
  const count = project.items.length;
  // faint pastel keyed to the workload — weighted by how much is actually
  // written in the project, not just how many lines it has
  const hue = taskHue(projectWeight(project));
  const baseBg = `hsla(${hue}, 55%, 55%, 0.08)`;
  const hoverBg = `hsla(${hue}, 55%, 55%, 0.15)`;
  const badgeColor = `hsl(${hue}, 45%, 72%)`;

  return (
    <div
      draggable
      tabIndex={0}
      role="button"
      aria-label={`${project.title}, ${count} task${count === 1 ? "" : "s"}. Open project`}
      onDragStart={(e) => {
        dragging.current = true;
        e.dataTransfer.setData("text/plain", project.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.style.opacity = "0.4";
        onLeave();
      }}
      onDragEnd={(e) => { setTimeout(() => { dragging.current = false; }, 0); setDropTarget(false); e.currentTarget.style.opacity = "1"; }}
      // accept another item dropped onto this box (merge it in)
      onDragOver={(e) => { if (dragging.current) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; if (!dropTarget) setDropTarget(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(false); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        setDropTarget(false);
        const sourceId = e.dataTransfer.getData("text/plain");
        if (sourceId) onMerge(project.id, sourceId);
      }}
      onClick={() => { if (dragging.current) return; onOpen(project.id); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(project.id); } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#777";
        e.currentTarget.style.background = hoverBg;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        onLeave();
        e.currentTarget.style.borderColor = dropTarget ? "#9a9a9a" : "#2a2a2a";
        e.currentTarget.style.background = dropTarget ? "rgba(255,255,255,0.08)" : baseBg;
        e.currentTarget.style.transform = "translateY(0)";
      }}
      style={{
        position: "relative",
        background: dropTarget ? "rgba(255,255,255,0.08)" : baseBg,
        border: dropTarget ? "1px solid #9a9a9a" : "1px solid #2a2a2a",
        borderRadius: 5,
        padding: "13px 16px 11px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "border-color 0.2s, background 0.2s, transform 0.2s",
      }}
    >
      {/* merge affordance: an absolute banner over the top edge, so the project's
          title + tasks stay visible AND the card height never changes (no reflow
          of the masonry) while another item is dragged over it */}
      {dropTarget && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em",
          color: "#f0f0f0", background: "rgba(255,255,255,0.14)", borderRadius: "5px 5px 0 0",
          padding: "4px 6px", textAlign: "center",
        }}>MERGE INTO ▾</div>
      )}
      {/* project title — shown as a heading (auto-capitalized) */}
      <span style={{
        fontSize: 15, color: "#f0f0f0", fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
        lineHeight: 1.35, overflowWrap: "break-word", textTransform: "capitalize",
      }}>{project.title}</span>
      {/* every task in the project, listed under the title */}
      {count > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {project.items.map((it) => (
            <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
              <span aria-hidden style={{ color: badgeColor, fontSize: 11, lineHeight: 1.4, flexShrink: 0 }}>›</span>
              <span style={{ fontSize: 12, color: "#9a9a9a", lineHeight: 1.4, overflowWrap: "break-word", minWidth: 0 }}>{it.text || "Untitled"}</span>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#808080" }}>NO TASKS</span>
      )}
    </div>
  );
}

// True masonry with "upward gravity": every bubble drops into the currently
// SHORTEST column, so the topmost open slot always fills first and no gaps are
// left behind. Heights are measured at the real column width (so wrapping is
// exact), packed before paint, and re-packed on resize. CSS columns can't do
// this — they balance/flow and leave holes — so we measure + absolutely place.
function ProjectGrid({ projects, onOpen, onHover, onLeave, onMerge, onAddNew }: {
  projects: Project[];
  onOpen: (id: string) => void;
  onHover: (id: string, rect: DOMRect) => void;
  onLeave: () => void;
  onMerge: (targetId: string, sourceId: string) => void;
  onAddNew?: () => void; // click empty space (gaps / below the cards) to start a new project
}) {
  const COL_W = 210, GAP = 10, TOP_PAD = 3; // wider columns so long text wraps comfortably (not word-by-word); TOP_PAD leaves room for the hover lift
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [pos, setPos] = useState<{ left: number; top: number; w: number }[]>([]);
  const [wrapH, setWrapH] = useState(0);
  const [ready, setReady] = useState(false); // gate transitions so cards don't slide in on first paint

  // pack order = color temperature: warmest bubbles first (fill the top slots),
  // coolest last. Warmth = cos(hue) on the same count→hue scale the tints use, so
  // red/orange (busiest) lead and green (empty) trails; ties keep their order.
  const ordered = useMemo(() => {
    const warmth = (p: Project) => Math.cos((taskHue(projectWeight(p)) * Math.PI) / 180);
    return projects
      .map((p, i) => ({ p, i }))
      .sort((a, b) => warmth(b.p) - warmth(a.p) || a.i - b.i)
      .map(({ p }) => p);
  }, [projects]);

  // Measure every card at the real column width, then drop each into the
  // currently-shortest column. Reads clientWidth live, so it's correct whenever
  // it runs.
  const relayout = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    if (cw <= 0) return;
    const n = Math.max(1, Math.floor((cw + GAP) / (COL_W + GAP)));
    const colW = (cw - (n - 1) * GAP) / n;
    // force every card to the real column width so offsetHeight reflects the
    // actual wrapped height regardless of which column it currently sits in
    cardRefs.current.forEach((node) => { node.style.width = `${colW}px`; });
    const heights = new Array(n).fill(TOP_PAD);
    const next = ordered.map((p) => {
      // shortest column wins (ties go left → fills top-left first)
      let t = 0;
      for (let c = 1; c < n; c++) if (heights[c] < heights[t] - 0.5) t = c;
      const left = t * (colW + GAP);
      const top = heights[t];
      const h = cardRefs.current.get(p.id)?.offsetHeight ?? 90;
      heights[t] += h + GAP;
      return { left, top, w: colW };
    });
    setPos(next);
    setWrapH(Math.max(TOP_PAD, ...heights) - GAP);
  }, [ordered]);

  // Re-pack on mount, when the set/order of projects changes, and — crucially —
  // when the container OR ANY CARD changes size. The per-card observer is what
  // catches a title (or item) growing AND shrinking back down; a container-only
  // observer misses a card getting shorter because the container height is what
  // we're driving. rAF-debounced so our own height writes don't loop.
  useIsoLayoutEffect(() => {
    relayout();
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(relayout); };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    cardRefs.current.forEach((node) => ro.observe(node));
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [relayout]);

  // enable the reflow animation only after the first (already-correct) paint
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  if (projects.length === 0) return (
    <div
      onClick={() => onAddNew?.()}
      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 60, cursor: "pointer" }}
    >
      <p style={{ color: "#808080", fontSize: 12, textAlign: "center" }}>No projects yet — click anywhere to add one</p>
    </div>
  );

  // relative + measured height so the absolutely-placed cards have a container
  // sized to exactly what it holds. Clicks in the GAPS between bubbles land on
  // this div (the cards are absolutely positioned, so gaps aren't covered) and
  // clicks BELOW the last card fall through to the scroll container, which runs
  // the same add-new handler. Both paths reach "click black space → new project".
  return (
    <div
      ref={wrapRef}
      onClick={(e) => { if (e.target === e.currentTarget) onAddNew?.(); }}
      style={{ position: "relative", height: wrapH || undefined, cursor: "pointer" }}
    >
      {ordered.map((p, i) => (
        <div
          key={p.id}
          ref={(node) => { if (node) cardRefs.current.set(p.id, node); else cardRefs.current.delete(p.id); }}
          style={{
            position: "absolute",
            left: pos[i]?.left ?? 0,
            top: pos[i]?.top ?? TOP_PAD,
            width: pos[i]?.w ?? COL_W,
            transition: ready ? "left 0.22s ease, top 0.22s ease" : "none",
          }}
        >
          <BucketCard project={p} onOpen={onOpen} onHover={onHover} onLeave={onLeave} onMerge={onMerge} />
        </div>
      ))}
    </div>
  );
}

// Fixed-position preview anchored to a hovered card. Rendered at the Dashboard
// root (not inside the panel) so the panel's overflow:hidden can't clip it, and
// pointerEvents:none so it never blocks the click/drag underneath.
function HoverPopover({ project, rect }: { project: Project; rect: DOMRect }) {
  const W = 200;
  const items = project.items;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const estH = Math.min(40 + Math.min(items.length, 6) * 20 + (items.length > 6 ? 16 : 0), 220);
  // open to the RIGHT of the hovered row (aligned to its top), so it never covers
  // the sibling rows above/below in the list; flip to the left only if it would
  // overflow the right edge of the viewport
  const GAP = 8;
  const rightOverflow = rect.right + GAP + W > vw - 8;
  const left = rightOverflow ? Math.max(rect.left - GAP - W, 8) : rect.right + GAP;
  const top = Math.min(Math.max(rect.top, 8), Math.max(vh - estH - 8, 8));
  const pos: React.CSSProperties = { top, maxHeight: Math.max(vh - top - 8, 60) };

  return (
    <div style={{
      position: "fixed", left, width: W, ...pos, overflow: "hidden",
      background: "rgba(14,16,20,0.96)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      border: "1px solid #3a3a3a", borderRadius: 4,
      boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
      padding: "10px 12px", zIndex: 9500, pointerEvents: "none",
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em",
        color: "#808080", textTransform: "uppercase", marginBottom: items.length ? 8 : 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{project.title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#808080" }}>Empty</div>
      ) : (
        <>
          {items.slice(0, 6).map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: it.checked ? "#cfcfcf" : "#555", flexShrink: 0 }}>{it.checked ? "▪" : "▫"}</span>
              <span style={{
                fontSize: 12, color: it.checked ? "#555" : "#9a9a9a",
                textDecoration: it.checked ? "line-through" : "none",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{it.text || "Untitled"}</span>
            </div>
          ))}
          {items.length > 6 && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#808080", marginTop: 2 }}>+{items.length - 6} MORE</div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Project notes: a live, Google-Docs-style writing surface --------------
// Exactly two commands: "# " makes a heading, "* " makes a circular bullet that
// auto-continues on Enter. No other syntax, no read/preview mode — what you see
// while typing IS the document. Stored as plain lines ("# x" / "* x" / "x").
type NBlock = { cls: "nb-p" | "nb-h" | "nb-li"; text: string };

function parseNotes(src: string): NBlock[] {
  const lines = (src || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = lines.map((line): NBlock => {
    if (/^#\s/.test(line)) return { cls: "nb-h", text: line.replace(/^#\s+/, "") };
    if (/^\*\s/.test(line)) return { cls: "nb-li", text: line.replace(/^\*\s+/, "") };
    return { cls: "nb-p", text: line };
  });
  return blocks.length ? blocks : [{ cls: "nb-p", text: "" }];
}
function serializeNotes(root: HTMLElement): string {
  return Array.from(root.children).map((el) => {
    const t = el.textContent || "";
    if (el.classList.contains("nb-h")) return "# " + t;
    if (el.classList.contains("nb-li")) return "* " + t;
    return t;
  }).join("\n");
}
// an empty block still needs a <br> to hold its line height / stay selectable
function setBlockText(block: HTMLElement, text: string) {
  if (text === "") block.innerHTML = "<br>";
  else block.textContent = text;
}
function makeBlock(cls: NBlock["cls"], text: string) {
  const d = document.createElement("div");
  d.className = cls;
  setBlockText(d, text);
  return d;
}
function blockAtCaret(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.getRangeAt(0).startContainer;
  while (node && node.parentNode && node.parentNode !== root) node = node.parentNode;
  return node && node.parentNode === root ? (node as HTMLElement) : null;
}
function putCaret(block: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const first = block.firstChild;
  if (!first || first.nodeName === "BR") range.setStart(block, 0);
  else range.setStart(first, Math.max(0, Math.min(offset, first.textContent?.length ?? 0)));
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
const countWords = (s: string) => (s.trim().match(/\S+/g) || []).length;

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRef = useRef(value);
  const latestRef = useRef(value);
  const timerRef = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [words, setWords] = useState(countWords(value));

  // Build the document. Skipped while the editor has focus so a background
  // refetch can never yank the text out from under the cursor.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (document.activeElement === root) return;
    root.innerHTML = "";
    for (const b of parseNotes(value)) root.appendChild(makeBlock(b.cls, b.text));
    root.dataset.empty = value.trim() === "" ? "1" : "0";
    savedRef.current = value;
    latestRef.current = value;
    setWords(countWords(value));
  }, [value]);

  // focus the notes on open so you can just start typing
  useEffect(() => {
    const t = setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      root.focus();
      const last = root.lastElementChild as HTMLElement | null;
      if (last) putCaret(last, (last.textContent || "").length);
    }, 90);
    return () => clearTimeout(t);
  }, []);

  const commit = useCallback(() => {
    if (latestRef.current !== savedRef.current) {
      savedRef.current = latestRef.current;
      onSave(latestRef.current);
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
    }
  }, [onSave]);

  // Copy the notes to the clipboard, keeping the "# " / "* " marks so headings
  // and bullets survive the paste.
  const copyNotes = async () => {
    const root = ref.current;
    const text = root ? serializeNotes(root) : latestRef.current;
    const ok = await navigator.clipboard?.writeText(text).then(() => true).catch(() => false);
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const sync = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const s = serializeNotes(root);
    latestRef.current = s;
    root.dataset.empty = s.trim() === "" ? "1" : "0";
    setWords(countWords(s));
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(commit, 700);
  }, [commit]);
  // save anything unsaved when the window closes
  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    if (latestRef.current !== savedRef.current) onSave(latestRef.current);
  }, [onSave]);

  const normalize = (root: HTMLElement) => {
    if (root.children.length === 0) { root.appendChild(makeBlock("nb-p", "")); return; }
    Array.from(root.childNodes).forEach((n) => {
      if (n.nodeType === 3) { // stray text node (paste / select-all delete)
        const d = makeBlock("nb-p", n.textContent || "");
        root.replaceChild(d, n);
      }
    });
  };

  const onInput = () => {
    const root = ref.current;
    if (!root) return;
    normalize(root);
    const block = blockAtCaret(root);
    if (block) {
      const text = block.textContent || "";
      const sel = window.getSelection();
      const caret = sel && sel.rangeCount ? sel.getRangeAt(0).startOffset : text.length;
      // "# " → heading, "* " → bullet (consumed, like Google Docs)
      if (!block.classList.contains("nb-h") && /^#\s/.test(text)) {
        block.className = "nb-h";
        setBlockText(block, text.replace(/^#\s/, ""));
        putCaret(block, Math.max(0, caret - 2));
      } else if (!block.classList.contains("nb-li") && /^\*\s/.test(text)) {
        block.className = "nb-li";
        setBlockText(block, text.replace(/^\*\s/, ""));
        putCaret(block, Math.max(0, caret - 2));
      }
    }
    sync();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const root = ref.current;
    if (!root) return;
    if (e.key === "Escape") { e.stopPropagation(); (e.target as HTMLElement).blur(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      normalize(root);
      const block = blockAtCaret(root);
      if (!block) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = block.textContent || "";
      const r = sel.getRangeAt(0);
      const caret = r.startContainer.nodeType === 3 ? r.startOffset : (r.startOffset === 0 ? 0 : text.length);
      // Enter on an empty bullet exits the list (Google Docs behaviour)
      if (block.classList.contains("nb-li") && text.trim() === "") {
        block.className = "nb-p";
        setBlockText(block, "");
        putCaret(block, 0);
        sync();
        return;
      }
      setBlockText(block, text.slice(0, caret));
      // bullets continue; a heading drops back to body text on the next line
      const next = makeBlock(block.classList.contains("nb-li") ? "nb-li" : "nb-p", text.slice(caret));
      block.after(next);
      putCaret(next, 0);
      sync();
      return;
    }
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      const block = blockAtCaret(root);
      if (block && sel && sel.isCollapsed && sel.getRangeAt(0).startOffset === 0 &&
          (block.classList.contains("nb-li") || block.classList.contains("nb-h"))) {
        e.preventDefault(); // first backspace just removes the block style
        block.className = "nb-p";
        sync();
      }
    }
  };

  // paste as plain text so the document can't get polluted with foreign markup
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    sync();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}
        onClick={(e) => {
          // clicking the empty space below the text keeps writing at the end
          if (e.target !== e.currentTarget) return;
          const root = ref.current;
          const last = root?.lastElementChild as HTMLElement | null;
          if (root && last) { root.focus(); putCaret(last, (last.textContent || "").length); }
        }}
      >
        <div style={{ width: "100%", padding: "26px 26px 80px" }}>
          <div
            ref={ref}
            className="notes-edit"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            role="textbox"
            aria-multiline="true"
            aria-label="Project notes"
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={commit}
            style={{
              fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
              fontSize: 18, lineHeight: 1.8, color: "#d4d1cb",
              outline: "none", minHeight: "64vh", caretColor: "#e8c15a",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 22px", borderTop: "1px solid #1a1a1a", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#5a5a5a", textTransform: "uppercase", flexShrink: 0 }}>
        <span>{words} {words === 1 ? "word" : "words"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: flash ? "#7bd88f" : "#5a5a5a", transition: "color 0.2s", display: "inline-flex", alignItems: "center", gap: 5 }}>{flash ? <>Saved <CheckIcon size={9} /></> : "# heading · * bullet"}</span>
          <button onClick={copyNotes} aria-label="Copy notes to clipboard" style={{
            background: "none", border: "1px solid #3a3a3a", cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "3px 9px", borderRadius: 3, transition: "color 0.15s, border-color 0.15s",
            color: copied ? "#7bd88f" : "#9a9a9a", borderColor: copied ? "#3f6f4a" : "#3a3a3a",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}
            onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; } }}
            onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.color = "#9a9a9a"; e.currentTarget.style.borderColor = "#3a3a3a"; } }}
          >{copied ? <>Copied <CheckIcon size={9} /></> : "Copy Text"}</button>
        </span>
      </div>
    </div>
  );
}

// One of today's action items: headline + the one-line why, click for the plan.
// One of the three fixed Today slots. Finishing an item does NOT remove it: it
// crosses out in place and stays clickable so the plan is still readable, and the
// check toggles back off.
function ActionCard({ action, index, onOpen, onToggleDone }: {
  action: ActionItem; index: number; onOpen: () => void; onToggleDone: (done: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  const done = !!action.done;
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="reveal-row"
      style={{
        display: "flex", flexDirection: "column", gap: 6, minWidth: 0, cursor: "pointer",
        // bounded by the grid row; the note is the part that gives when it's tight
        minHeight: 0, overflow: "hidden",
        background: done
          ? (hover ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.012)")
          : (hover ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.022)"),
        border: `1px solid ${hover ? (done ? "#4a4a4a" : "#6a6a6a") : (done ? "#242424" : "#2a2a2a")}`,
        borderRadius: 5, padding: "9px 12px 8px",
        opacity: done ? 0.72 : 1,
        // No hover lift here. The card is sized to fill its grid row exactly, so
        // any translateY pushes its top edge past the scroll container's clip box
        // and shaves the top border off. Background + border + title color carry
        // the hover state instead.
        transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", color: done ? "#7bd88f" : "#7a7a7a", transition: "color 0.15s" }}>
          {done ? "DONE" : String(index + 1).padStart(2, "0")}
        </span>
        <button
          // once finished the check stays visible (not hover-gated) so it's
          // obvious what happened and the item can be reopened with one click
          className={done ? undefined : "row-action"}
          aria-label={done ? "Reopen this item" : "Mark done"}
          aria-pressed={done}
          onClick={(e) => { e.stopPropagation(); onToggleDone(!done); }}
          style={{
            background: done ? "#20301f" : "#1e1e1e",
            border: `1px solid ${done ? "#3f6f4a" : "#505050"}`,
            borderRadius: 3, cursor: "pointer",
            color: done ? "#7bd88f" : "#aaa", lineHeight: 1, padding: "3px 7px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.15s, border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => { if (!done) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#aaa"; } }}
          onMouseLeave={(e) => { if (!done) { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#505050"; } }}
        ><CheckIcon /></button>
      </div>
      <span style={{
        fontSize: 13, lineHeight: 1.35, overflowWrap: "break-word", transition: "color 0.15s", flexShrink: 0,
        color: done ? "#6f6f6f" : (hover ? "#ffffff" : "#e8e8e8"),
        textDecoration: done ? "line-through" : "none",
        textDecorationColor: done ? "#5a5a5a" : undefined,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{action.title}</span>
      {action.notes?.trim() && (
        <span style={{
          fontSize: 11, lineHeight: 1.4, color: done ? "#5a5a5a" : "#8a8a8a", transition: "color 0.15s",
          // flexes into whatever room is left, so the card never outgrows its slot
          flex: "1 1 auto", minHeight: 0,
          display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{action.notes}</span>
      )}
      {/* marginTop:auto pins the footer to the bottom so all three line up even
          when their titles wrap to different depths */}
      <span style={{ marginTop: "auto", paddingTop: 4, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: "0.14em", color: hover ? "#cfcfcf" : "#6a6a6a", transition: "color 0.15s" }}>
        {action.plan?.trim() ? "OPEN PLAN →" : "NO PLAN YET"}
      </span>
    </div>
  );
}

// The full plan for an action item, rendered read-only from its Notion page body.
function ActionPlanModal({ action, onClose, onComplete }: {
  action: ActionItem; onClose: () => void; onComplete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const blocks = parseNotes(action.plan || "");
  const hasPlan = !!action.plan?.trim();

  // Copy this one item: its headline, the why-line, and the whole plan body.
  // Bullets normalise to "- " so it pastes as clean markdown; headings already
  // carry their "# " from the stored format.
  const copyPlan = async () => {
    const parts = [action.title];
    if (action.notes?.trim()) parts.push("", action.notes.trim());
    if (hasPlan) {
      parts.push("");
      for (const line of (action.plan || "").replace(/\r\n/g, "\n").split("\n")) {
        parts.push(/^\*\s/.test(line) ? line.replace(/^\*\s+/, "- ") : line);
      }
    }
    const text = parts.join("\n");
    const ok = await navigator.clipboard?.writeText(text).then(() => true).catch(() => false);
    if (!ok) {
      // fallback for non-secure contexts / older browsers
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", zIndex: 9000, display: "grid", placeItems: "center", padding: 16, animation: "fadeIn 0.18s ease-out" }}>
      <div role="dialog" aria-modal="true" aria-label={`Plan: ${action.title}`}
        style={{ width: "min(900px, 94vw)", maxHeight: "88vh", background: "rgba(11,13,17,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid #333", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.75)", animation: "modalIn 0.2s ease-out" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px 14px", borderBottom: "1px solid #202020", flexShrink: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", color: "#7a7a7a", textTransform: "uppercase", marginBottom: 5 }}>Today · Action</div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 500, color: "#f2f2f2", lineHeight: 1.3, overflowWrap: "break-word" }}>{action.title}</h2>
            {action.notes?.trim() && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9a9a9a", lineHeight: 1.5 }}>{action.notes}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#808080", fontSize: 20, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 0 }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 30px 40px" }}>
            {hasPlan ? (
              <div className="notes-edit" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', fontSize: 16, lineHeight: 1.75, color: "#d4d1cb" }}>
                {blocks.map((b, i) => <div key={i} className={b.cls}>{b.text || " "}</div>)}
              </div>
            ) : (
              <p style={{ color: "#808080", fontSize: 13, lineHeight: 1.7 }}>
                No plan written for this one yet. The Cowork routine writes the full plan into this item&rsquo;s Notion page body: where to start, the steps, and what a finished version looks like.
              </p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 20px 14px", borderTop: "1px solid #1a1a1a", flexShrink: 0 }}>
          <button onClick={copyPlan} aria-label="Copy this item and its plan to clipboard" style={{
            background: "none", cursor: "pointer",
            border: `1px solid ${copied ? "#3f6f4a" : "#4a4a4a"}`,
            color: copied ? "#7bd88f" : "#9a9a9a",
            fontSize: 11, padding: "5px 14px", borderRadius: 3,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 6,
            transition: "color 0.15s, border-color 0.15s",
          }}
            onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; } }}
            onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.color = "#9a9a9a"; e.currentTarget.style.borderColor = "#4a4a4a"; } }}
          >{copied ? <>Copied <CheckIcon size={10} /></> : "Copy"}</button>
          <button onClick={() => { onComplete(); onClose(); }} style={{
            background: action.done ? "#20301f" : "#1e1e1e",
            border: `1px solid ${action.done ? "#3f6f4a" : "#505050"}`,
            color: action.done ? "#7bd88f" : "#ddd",
            fontSize: 11, padding: "5px 14px", borderRadius: 3, cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase",
          }}>{action.done ? "Reopen" : "Mark Done"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// A small "memory" shelf for a project: paste a URL and it's saved as a
// clickable link you can come back to. Accepts "Label | url" or a bare url
// (which is labelled by its hostname).
function LinksCard({ links, onChange }: { links: SavedLink[]; onChange: (next: SavedLink[]) => void }) {
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);
  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const i = raw.indexOf("|");
    const label = i >= 0 ? raw.slice(0, i).trim() : "";
    const url = safeUrl(i >= 0 ? raw.slice(i + 1) : raw);
    if (!url) { setBad(true); setTimeout(() => setBad(false), 1200); return; } // keep the text so it can be fixed
    onChange([...links, { label: label || hostLabel(url), url }]);
    setDraft("");
  };
  return (
    <section style={{
      background: "rgba(255,255,255,0.022)", border: "1px solid #1c1c1c", borderRadius: 8,
      padding: "12px 3px 8px", display: "flex", flexDirection: "column", minHeight: 0, flexShrink: 0, maxHeight: "42%",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 9px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", color: "#6a6a6a", textTransform: "uppercase" }}>Links</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#5a5a5a" }}>{links.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 0, padding: "0 14px" }}>
        {links.length === 0 ? (
          <p style={{ margin: "2px 0 8px", color: "#5f5f5f", fontSize: 11, lineHeight: 1.5 }}>Paste a link below to keep it here.</p>
        ) : links.map((l, i) => (
          <div key={`${l.url}-${i}`} className="reveal-row" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid #1a1a1a" }}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}
              style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#8ea9cc", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#b9d0ef")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8ea9cc")}
            >{l.label}</a>
            <button className="row-action" aria-label={`Remove ${l.label}`} onClick={() => onChange(links.filter((_, n) => n !== i))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#707070", fontSize: 11, lineHeight: 1, padding: "0 2px", flexShrink: 0, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#c06464")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#707070")}
            >✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 5, padding: "9px 14px 2px" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={bad ? "Not a valid link…" : "Paste a link…"} aria-label="Add a link"
          style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.03)", border: `1px solid ${bad ? "#6f3f3f" : "#262626"}`, color: "#bbb", fontSize: 11, padding: "5px 7px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 3, transition: "border-color 0.15s" }} />
        <button onClick={add} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #3a3a3a", color: "#9a9a9a", fontSize: 10, padding: "4px 9px", cursor: "pointer", borderRadius: 3, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>ADD</button>
      </div>
    </section>
  );
}

// Click-to-open editor for a project's checklist. Portalled to document.body so
// the panel's overflow/backdrop-filter stacking context can't clip it.
function ProjectModal({ project, list, onClose, onAddItem, onDeleteItem, onEditItem, onEditTitle, onArchive, onMove, onReorderItems, onExtractItem, onSaveNotes, onSaveLinks }: {
  project: Project;
  list: "Short Term" | "Long Term" | null; // which list the project is in (for the Move control)
  onClose: () => void;
  onAddItem: (projectId: string, text: string) => void;
  onDeleteItem: (projectId: string, itemId: string) => void;
  onEditItem: (projectId: string, itemId: string, text: string) => void;
  onEditTitle: (id: string, title: string) => Promise<void>;
  onArchive: (id: string) => void;
  onMove: (id: string, target: "Short Term" | "Long Term") => void;
  onReorderItems: (projectId: string, items: ChecklistItem[]) => void; // drag-reorder the checklist
  onExtractItem: (projectId: string, itemId: string) => void; // drag an item out of the checklist → its own task
  onSaveNotes: (projectId: string, notes: string) => void; // autosave the project notes
  onSaveLinks: (projectId: string, links: SavedLink[]) => void; // the project's saved reference links
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(project.title);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState("");
  const [newItem, setNewItem] = useState("");
  const [copied, setCopied] = useState(false);
  const [focus, setFocus] = useState(false); // distraction-free: hide the checklist, widen the notes
  const [itemOver, setItemOver] = useState<{ id: string; side: "top" | "bottom" } | null>(null); // reorder drop indicator
  const addRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const isTemp = project.id.startsWith("temp-");
  const titleId = "proj-modal-title";
  const accent = `hsl(${taskHue(projectWeight(project))}, 55%, 62%)`;

  useEffect(() => { setTitleValue(project.title); }, [project.title]);
  useEffect(() => {
    // Escape closes the modal, but not while renaming (that Escape cancels the edit)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editingTitle) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editingTitle]);
  // NOTE: deliberately do NOT autofocus the checklist's add-item box. The notes
  // are the main canvas — NotesEditor puts the cursor there so that opening a
  // project and just typing goes into the notes, not the sidebar's add field.
  // return focus to whatever opened the modal when it closes
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { try { opener?.focus?.(); } catch {} };
  }, []);
  // keep Tab focus inside the dialog
  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const submitTitle = async () => {
    const t = titleValue.trim();
    if (t && t !== project.title) await onEditTitle(project.id, t);
    setEditingTitle(false);
  };
  const submitItem = () => {
    const t = newItem.trim();
    if (!t || isTemp) return;
    onAddItem(project.id, t);
    setNewItem("");
    setTimeout(() => addRef.current?.focus(), 0);
  };

  // Copy the whole project — title + every checklist item (as a markdown task
  // list, preserving checked state) — to the clipboard.
  const copyAll = async () => {
    const lines = [project.title];
    if (project.items.length) {
      lines.push("");
      for (const it of project.items) lines.push(`- [${it.checked ? "x" : " "}] ${it.text || "Untitled"}`);
    }
    const text = lines.join("\n");
    const ok = await navigator.clipboard?.writeText(text).then(() => true).catch(() => false);
    if (!ok) {
      // fallback for non-secure contexts / older browsers
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)",
        backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
        zIndex: 9000, display: "grid", placeItems: "center", padding: 16,
        fontFamily: "'DM Sans', sans-serif", animation: "fadeIn 0.18s ease-out",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
        style={{
          width: "min(2100px, 95vw)", height: "93vh",
          background: "rgba(11,13,17,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1px solid #333", borderRadius: 8,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.75)", position: "relative",
          animation: "modalIn 0.2s ease-out",
        }}>
        {/* header: warmth dot · editable title · focus · close */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px 13px", borderBottom: "1px solid #202020", flexShrink: 0 }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: accent, boxShadow: `0 0 10px ${accent}`, flexShrink: 0 }} />
          {editingTitle ? (
            <input autoFocus value={titleValue} onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitTitle(); if (e.key === "Escape") { e.stopPropagation(); setTitleValue(project.title); setEditingTitle(false); } }}
              onBlur={submitTitle}
              style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#f0f0f0", fontSize: 20, padding: "3px 8px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 4, minWidth: 0 }} />
          ) : (
            <h2 id={titleId} onClick={() => !isTemp && setEditingTitle(true)} title={isTemp ? undefined : "Click to rename"}
              style={{ margin: 0, fontSize: 20, fontWeight: 500, color: "#f0f0f0", lineHeight: 1.25, cursor: isTemp ? "default" : "pointer", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.title}</h2>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setFocus(f => !f)} aria-pressed={focus} title="Focus — hide the checklist and widen the notes"
              style={{ background: focus ? "rgba(255,255,255,0.09)" : "none", border: "1px solid #3a3a3a", cursor: "pointer", color: focus ? "#e8e8e8" : "#9a9a9a", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 3, transition: "color 0.15s, background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e8e8")} onMouseLeave={(e) => (e.currentTarget.style.color = focus ? "#e8e8e8" : "#9a9a9a")}>Focus</button>
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#808080", fontSize: 20, lineHeight: 1, padding: "0 2px", transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>✕</button>
          </div>
        </div>

        {/* body: notes ARE the page; the checklist is a small floating card far right */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <NotesEditor value={project.notes || ""} onSave={(v) => onSaveNotes(project.id, v)} />
          </div>

          {!focus && (
          <div style={{ width: 228, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, margin: "14px 12px 14px 0", minHeight: 0 }}>
            <aside ref={asideRef} style={{
              flex: "1 1 auto", padding: "12px 3px 8px",
              background: "rgba(255,255,255,0.022)", border: "1px solid #1c1c1c", borderRadius: 8,
              display: "flex", flexDirection: "column", minHeight: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 9px" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", color: "#6a6a6a", textTransform: "uppercase" }}>Checklist</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#5a5a5a" }}>{project.items.length}</span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 40, padding: "0 14px" }}>
                {project.items.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
                    <p style={{ color: "#808080", fontSize: 12, textAlign: "center" }}>No items yet.<br />Add one below, or drag one out to make it a task.</p>
                  </div>
                ) : project.items.map((it) => {
                  const temp = it.id.startsWith("temp-");
                  const draggableItem = !temp && editingItemId !== it.id;
                  return (
                    <div
                      key={it.id}
                      draggable={draggableItem}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", it.id);
                        e.dataTransfer.setData("x-checklist", "");
                        e.dataTransfer.effectAllowed = "move";
                        e.currentTarget.style.opacity = "0.4";
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = "1";
                        // released outside the checklist column → pull it out into its own task
                        const r = asideRef.current?.getBoundingClientRect();
                        const outside = r ? (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) : false;
                        if (outside && !temp) onExtractItem(project.id, it.id);
                        setItemOver(null);
                      }}
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes("x-checklist")) return;
                        e.preventDefault();
                        const b = e.currentTarget.getBoundingClientRect();
                        setItemOver({ id: it.id, side: e.clientY - b.top < b.height / 2 ? "top" : "bottom" });
                      }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setItemOver(cur => (cur?.id === it.id ? null : cur)); }}
                      onDrop={(e) => {
                        const draggedId = e.dataTransfer.getData("text/plain");
                        const side = itemOver?.id === it.id ? itemOver.side : "top";
                        setItemOver(null);
                        if (!draggedId || draggedId === it.id || !e.dataTransfer.types.includes("x-checklist")) return;
                        e.preventDefault(); e.stopPropagation();
                        const dr = project.items.find(x => x.id === draggedId);
                        if (!dr) return;
                        const arr = project.items.filter(x => x.id !== draggedId);
                        const ti = arr.findIndex(x => x.id === it.id);
                        if (ti < 0) return;
                        arr.splice(side === "top" ? ti : ti + 1, 0, dr);
                        onReorderItems(project.id, arr);
                      }}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "1px solid #1a1a1a",
                        cursor: draggableItem ? "grab" : "default",
                        boxShadow: itemOver?.id === it.id ? (itemOver.side === "top" ? "inset 0 2px 0 #8a8a8a" : "inset 0 -2px 0 #8a8a8a") : "none",
                      }}
                    >
                      <button
                        disabled={temp} title="Remove" aria-label="Remove item"
                        onClick={() => onDeleteItem(project.id, it.id)}
                        style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, background: "#1e1e1e", border: "1px solid #505050", borderRadius: 3, color: "#aaa", lineHeight: 1, cursor: temp ? "default" : "pointer", opacity: temp ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s, border-color 0.15s, background 0.15s" }}
                        onMouseEnter={(e) => { if (temp) return; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#aaa"; e.currentTarget.style.background = "#2a2a2a"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#505050"; e.currentTarget.style.background = "#1e1e1e"; }}
                      ><CheckIcon size={10} /></button>
                      {editingItemId === it.id ? (
                        <input autoFocus value={itemDraft} onChange={(e) => setItemDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { onEditItem(project.id, it.id, itemDraft); setEditingItemId(null); } if (e.key === "Escape") setEditingItemId(null); }}
                          onBlur={() => { onEditItem(project.id, it.id, itemDraft); setEditingItemId(null); }}
                          style={{ flex: 1, minWidth: 0, background: "#1a1a1a", border: "1px solid #333", color: "#ddd", fontSize: 13, padding: "2px 6px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 3 }} />
                      ) : (
                        <span onClick={() => { if (!temp) { setEditingItemId(it.id); setItemDraft(it.text); } }} title={temp ? undefined : "Click to edit"}
                          style={{ flex: 1, fontSize: 12, color: "#9a9a9a", lineHeight: 1.4, minWidth: 0, wordBreak: "break-word", cursor: temp ? "default" : "text" }}
                        >{it.text || "Untitled"}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 5, padding: "9px 14px 4px" }}>
                <input ref={addRef} value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitItem(); }}
                  placeholder={isTemp ? "Saving project…" : "Add item…"} disabled={isTemp}
                  style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.03)", border: "1px solid #262626", color: "#bbb", fontSize: 11, padding: "5px 7px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 3, opacity: isTemp ? 0.5 : 1 }} />
                <button onClick={submitItem} disabled={isTemp} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #3a3a3a", color: "#9a9a9a", fontSize: 10, padding: "4px 9px", cursor: isTemp ? "default" : "pointer", borderRadius: 3, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", opacity: isTemp ? 0.5 : 1 }}>ADD</button>
              </div>

              <div style={{ padding: "7px 14px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={copyAll} aria-label="Copy project contents to clipboard" style={{ background: "none", border: "1px solid #4a4a4a", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: copied ? "#7bd88f" : "#9a9a9a", textTransform: "uppercase", padding: "4px 9px", borderRadius: 3, borderColor: copied ? "#3f6f4a" : "#4a4a4a", transition: "color 0.15s, border-color 0.15s", display: "inline-flex", alignItems: "center", gap: 5 }}
                    onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; } }} onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.color = "#9a9a9a"; e.currentTarget.style.borderColor = "#4a4a4a"; } }}
                  >{copied ? <>Copied <CheckIcon size={9} /></> : "Copy"}</button>
                  {list && !isTemp && (
                    <button onClick={() => { onMove(project.id, list === "Short Term" ? "Long Term" : "Short Term"); onClose(); }} style={{ background: "none", border: "1px solid #4a4a4a", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#9a9a9a", textTransform: "uppercase", padding: "4px 9px", borderRadius: 3, transition: "color 0.15s, border-color 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#9a9a9a"; e.currentTarget.style.borderColor = "#4a4a4a"; }}
                    >{list === "Short Term" ? "→ Long Term" : "→ Short Term"}</button>
                  )}
                </div>
                <button onClick={() => onArchive(project.id)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#808080", textTransform: "uppercase", padding: 0, transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#c06464")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>Archive</button>
              </div>
            </aside>

            <LinksCard links={parseLinks(project.links || "")} onChange={(next) => onSaveLinks(project.id, next)} />
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// A little note box for a client — opened by clicking the client's name. The name
// stays editable (click it), and the note autosaves when the box closes.
function ClientNoteModal({ client, onClose, onSaveNotes, onEditTitle }: {
  client: Task;
  onClose: () => void;
  onSaveNotes: (id: string, notes: string) => void;
  onEditTitle: (id: string, title: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(client.notes || "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(client.title);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const isTemp = client.id.startsWith("temp-");

  useEffect(() => { setNotes(client.notes || ""); }, [client.notes]);
  useEffect(() => { setTitleValue(client.title); }, [client.title]);
  useEffect(() => { if (!isTemp) setTimeout(() => taRef.current?.focus(), 60); }, [isTemp]);

  // persist the note (if it changed) as the box closes
  const close = useCallback(() => {
    if (!isTemp && (client.notes || "") !== notesRef.current) onSaveNotes(client.id, notesRef.current);
    onClose();
  }, [isTemp, client.notes, client.id, onSaveNotes, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editingTitle) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, editingTitle]);

  const submitTitle = async () => {
    const t = titleValue.trim();
    if (t && t !== client.title) await onEditTitle(client.id, t);
    setEditingTitle(false);
  };

  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9000, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", animation: "fadeIn 0.18s ease-out" }}>
      <div role="dialog" aria-modal="true" aria-label={`Notes for ${client.title}`}
        style={{ width: "min(360px, 92vw)", background: "rgba(12,14,18,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid #3a3a3a", borderRadius: 6, padding: "16px 18px", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", position: "relative", animation: "modalIn 0.2s ease-out" }}>
        <div style={{ position: "absolute", top: -1, left: 16, width: 32, height: 1, background: "#999" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          {editingTitle ? (
            <input autoFocus value={titleValue} onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitTitle(); if (e.key === "Escape") { e.stopPropagation(); setTitleValue(client.title); setEditingTitle(false); } }}
              onBlur={submitTitle}
              style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#e8e8e8", fontSize: 15, padding: "4px 8px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 3, minWidth: 0 }} />
          ) : (
            <h2 onClick={() => !isTemp && setEditingTitle(true)} title={isTemp ? undefined : "Click to rename"}
              style={{ margin: 0, fontSize: 15, color: "#e8e8e8", fontWeight: 500, cursor: isTemp ? "default" : "text", minWidth: 0, overflowWrap: "anywhere" }}>{client.title}</h2>
          )}
          <button onClick={close} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#808080", fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>✕</button>
        </div>
        <textarea ref={taRef} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={isTemp ? "Saving client…" : "Write a note…"} rows={6} disabled={isTemp}
          style={{ width: "100%", boxSizing: "border-box", background: "#1a1a1a", border: "1px solid #333", color: "#ddd", fontSize: 13, padding: "8px 10px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 4, resize: "vertical", lineHeight: 1.5, minHeight: 96 }} />
        <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#6a6a6a", textTransform: "uppercase" }}>Saved automatically on close</div>
      </div>
    </div>,
    document.body
  );
}

// Edit a scheduled event — title, date, optional time, and type. Opened by
// clicking an event in Up Next.
function EventEditModal({ event, onClose, onSave, onDelete }: {
  event: Event;
  onClose: () => void;
  onSave: (id: string, title: string, date: string, time: string, type: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.editDate || "");
  const [time, setTime] = useState(event.editTime || "");
  const [type, setType] = useState(event.type || "");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const isTemp = event.id.startsWith("temp-");

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 60); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = !!title.trim() && !!date && !isTemp && !saving;
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave(event.id, title.trim(), date, time, type);
    onClose();
  };

  const field: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #333", color: "#ddd", fontSize: 13, padding: "6px 8px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 3, colorScheme: "dark" };
  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9000, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", animation: "fadeIn 0.18s ease-out" }}>
      <div role="dialog" aria-modal="true" aria-label="Edit event"
        style={{ width: "min(380px, 92vw)", background: "rgba(12,14,18,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid #3a3a3a", borderRadius: 6, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.7)", position: "relative", animation: "modalIn 0.2s ease-out" }}>
        <div style={{ position: "absolute", top: -1, left: 16, width: 32, height: 1, background: "#999" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <h2 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase", color: "#f0f0f0" }}>Edit Event</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#808080", fontSize: 18, lineHeight: 1, padding: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>✕</button>
        </div>
        <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="Event…" aria-label="Event name" style={field} />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" style={{ ...field, flex: 1, minWidth: 0 }} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (optional)" title="Time (optional)" style={{ ...field, flex: 1, minWidth: 0 }} />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" style={{ ...field, cursor: "pointer" }}>
          <option value="">Type…</option>
          <option value="Appointment">Appointment</option>
          <option value="Meeting">Meeting</option>
          <option value="Deadline">Deadline</option>
          <option value="Personal">Personal</option>
        </select>
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <button onClick={() => { onDelete(event.id); onClose(); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#808080", textTransform: "uppercase", padding: 0, transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#c06464")} onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}>Delete</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #333", color: "#9a9a9a", fontSize: 11, padding: "5px 12px", borderRadius: 3, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cancel</button>
            <button onClick={save} disabled={!canSave} style={{ background: "#1e1e1e", border: "1px solid #505050", color: "#ddd", fontSize: 11, padding: "5px 14px", borderRadius: 3, cursor: canSave ? "pointer" : "default", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase", opacity: canSave ? 1 : 0.5 }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Quick capture ("make task") -------------------------------------------
// One input that routes by what you typed: anything with a recognisable date or
// time ("lunch fri 12pm", "dentist 8/21", "call bob tomorrow") becomes a
// Schedule entry; everything else becomes a Short Term task. The matched date
// words are stripped so the title stays clean.
const QC_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const QC_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseQuickCapture(raw: string):
  | { kind: "task"; title: string }
  | { kind: "event"; title: string; date: string; time: string } {
  let s = ` ${raw.trim()} `;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date: Date | null = null;
  let time = "";

  const take = (m: RegExpMatchArray | null) => { if (m) s = s.replace(m[0], " "); return m; };

  // time — "3pm", "3:30pm", "at 3pm", "15:00"
  let m = take(s.match(/ (?:at )?(\d{1,2})(?::(\d{2}))? ?(am|pm) /i));
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    time = `${String(h).padStart(2, "0")}:${m[2] || "00"}`;
  } else if ((m = take(s.match(/ (?:at )?(\d{1,2}):(\d{2}) /)))) {
    time = `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
  }

  // date — relative words, weekday names, month-day, numeric m/d
  if (take(s.match(/ (today|tonight) /i))) date = today;
  else if (take(s.match(/ (tomorrow|tmrw|tmr) /i))) date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  else if ((m = take(s.match(new RegExp(` (?:this |next |on )?(${QC_WEEKDAYS.join("|")}|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun) `, "i"))))) {
    const target = QC_WEEKDAYS.findIndex(d => d.startsWith(m![1].toLowerCase().slice(0, 3)));
    const ahead = ((target - now.getDay() + 7) % 7) || 7; // bare weekday = its next occurrence
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
  } else if ((m = take(s.match(new RegExp(` (?:on )?(${QC_MONTHS.join("|")}|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.? (\\d{1,2})(?:st|nd|rd|th)? `, "i"))))) {
    const mo = QC_MONTHS.findIndex(x => x.startsWith(m![1].toLowerCase().slice(0, 3)));
    date = new Date(now.getFullYear(), mo, parseInt(m![2], 10));
    if (date < today) date = new Date(now.getFullYear() + 1, mo, parseInt(m![2], 10));
  } else if ((m = take(s.match(/ (?:on )?(\d{1,2})[\/\-](\d{1,2}) /)))) {
    const mo = parseInt(m[1], 10) - 1, d = parseInt(m[2], 10);
    date = new Date(now.getFullYear(), mo, d);
    if (date < today) date = new Date(now.getFullYear() + 1, mo, d);
  }

  // a bare time means today
  if (time && !date) date = today;

  const title = s.replace(/\s+/g, " ").trim().replace(/^(on|at|this|next)\s+/i, "").trim();
  if (!date) return { kind: "task", title: title || raw.trim() };
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { kind: "event", title: title || raw.trim(), date: iso, time };
}

// ---- Themes ----------------------------------------------------------------
// The app is monochrome, which makes theming almost free: a single full-screen
// mix-blend-mode:"color" layer re-hues every grey beneath it, so one tint color
// restyles the whole board without touching a line of the grey palette. Each
// theme = page background + tint + how hard the tint bites. PAPER is the odd
// one out: a real luminance inversion (light mode), with images/iframes
// double-inverted back to normal.
type Theme = { name: string; bg: string; tint?: string; tintOpacity?: number; invert?: boolean };
const THEMES: Theme[] = [
  { name: "MONO", bg: "#0a0a0a" },
  { name: "BLUE", bg: "#080b12", tint: "#4a7dbf", tintOpacity: 0.55 },
  { name: "GREEN", bg: "#07100a", tint: "#4fae62", tintOpacity: 0.5 },
  { name: "AMBER", bg: "#100c06", tint: "#c8862a", tintOpacity: 0.55 },
  { name: "PURPLE", bg: "#0c0814", tint: "#8a63c9", tintOpacity: 0.5 },
  { name: "STEEL", bg: "#0a0c0f", tint: "#7d93a8", tintOpacity: 0.4 },
  { name: "CRIMSON", bg: "#120808", tint: "#c05050", tintOpacity: 0.45 },
  { name: "PAPER", bg: "#0a0a0a", invert: true },
];

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Insert text at the caret of a (possibly React-controlled) field. The native
// value setter + input event is what makes React's onChange see the change;
// execCommand covers the contentEditable notes canvas.
function insertTextAtCursor(el: HTMLElement, text: string, smartPad = true) {
  el.focus();
  if (el.isContentEditable) {
    document.execCommand("insertText", false, text);
    return;
  }
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  // breathing room when dictating onto the end of existing text (not for
  // literal single characters like the tap-typed backtick)
  const pad = smartPad && start > 0 && !/\s/.test(input.value[start - 1] || "") && !/^\s/.test(text) ? " " : "";
  const next = input.value.slice(0, start) + pad + text + input.value.slice(end);
  setter.call(input, next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  try { input.setSelectionRange(start + pad.length + text.length, start + pad.length + text.length); } catch {}
}

// plain boolean on purpose — an "el is HTMLElement" predicate would narrow the
// else-branch to never and break the checks that follow it
const isTextField = (el: Element | null): boolean =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);

function Dashboard() {
  const clock = useClock();
  const [shortTerm, setShortTerm] = useState<Project[]>([]);
  const [longTerm, setLongTerm] = useState<Project[]>([]);
  const [clients, setClients] = useState<Task[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [allVerses, setAllVerses] = useState<Verse[]>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const [aphorismo, setAphorismo] = useState<string | null>(null);
  const [aphorismoLoading, setAphorismoLoading] = useState(false);
  const [aphAdding, setAphAdding] = useState(false);
  const [aphDraft, setAphDraft] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [sorenEmails, setSorenEmails] = useState<Email[]>([]);
  const [sorenConnected, setSorenConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>({ connected: false });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [volume, setVolume] = useState(50);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState<"Short Term" | "Long Term" | null>(null);
  const [priorityDrag, setPriorityDrag] = useState<"high" | "normal" | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [openEmail, setOpenEmail] = useState<{ source: "gmail" | "zoho"; email: Email } | null>(null);
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; undo?: () => void; actionLabel?: string }[]>([]);
  const spotifyInterval = useRef<NodeJS.Timeout | null>(null);
  // let each list open its add-input when its empty space is clicked
  const shortAddRef = useRef<AddHandle>(null);
  const longAddRef = useRef<AddHandle>(null);
  const clientsAddRef = useRef<AddHandle>(null);
  const highAddRef = useRef<AddHandle>(null);
  const scheduleAddRef = useRef<AddHandle>(null);

  // actionLabel renames the toast's button (default "Undo") — voice capture uses
  // it to offer "Calendar" as the alternate destination.
  const toast = useCallback((msg: string, undo?: () => void, actionLabel?: string) => {
    const id = (typeof performance !== "undefined" ? performance.now() : 0) + Math.random();
    setToasts(prev => [...prev, { id, msg, undo, actionLabel }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), undo ? 7000 : 4000);
  }, []);

  // Global undo stack. Every mutation pushes an inverse closure; Ctrl/Cmd+Z pops
  // and runs the most recent one. Capped so it can't grow without bound.
  const undoStack = useRef<{ label: string; run: () => Promise<void> }[]>([]);
  const pushUndo = useCallback((label: string, run: () => Promise<void>) => {
    undoStack.current.push({ label, run });
    if (undoStack.current.length > 40) undoStack.current.shift();
  }, []);
  const undoLast = useCallback(async () => {
    const item = undoStack.current.pop();
    if (!item) { toast("Nothing to undo"); return; }
    try { await item.run(); toast(`Undid: ${item.label}`); }
    catch { toast("Undo failed"); }
  }, [toast]);

  // Ctrl/Cmd+Z anywhere undoes the last mutation. Skip when the user is typing in
  // a text field so the browser's native text-undo keeps working there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "z" && e.key !== "Z") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      e.preventDefault();
      undoLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLast]);

  // ensure the tasks DB has an "Order" field so manual reordering can persist
  useEffect(() => {
    fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ensureOrderField" }) }).catch(() => {});
  }, []);

  // Each source fetches independently so one slow endpoint never blocks the
  // others — no single-dependency bottleneck.
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/notion");
      const data = await res.json();
      // Short Term + Clients honor the manual Order (persisted in Notion); Long
      // Term is arranged by warmth in ProjectGrid so its order is left alone.
      setShortTerm((data.shortTerm || []).slice().sort(byOrder));
      setLongTerm(data.longTerm || []);
      setClients((data.clients || []).slice().sort(byClient));
      setActions((data.actions || []).slice().sort(byOrder));
    } catch {}
  }, []);

  const fetchVerse = useCallback(async () => {
    try {
      const res = await fetch("/api/verse");
      const data = await res.json();
      setVerse(data.verse || data); // handle both old and new format
      setAllVerses(data.allVerses || []);
      setVerseIndex(data.dayOfYear || 0);
    } catch {}
  }, []);

  const fetchAphorismo = useCallback(async () => {
    try {
      const res = await fetch("/api/aphorismo");
      const data = await res.json();
      setAphorismo(data.aphorismo || null);
    } catch {}
  }, []);

  const fetchStatic = useCallback(async () => {
    setLoading(true);
    await fetchTasks();   // primary content — drop the skeleton as soon as it lands
    setLoading(false);
    // these update their own slots as they arrive; not gated on each other
    fetchVerse();
    fetchAphorismo();
  }, [fetchTasks, fetchVerse, fetchAphorismo]);

  const fetchSpotify = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/now-playing");
      const data = await res.json();
      if (data.expired) {
        await fetch("/api/spotify/refresh", { method: "POST" });
        const res2 = await fetch("/api/spotify/now-playing");
        setNowPlaying(await res2.json());
      } else {
        setNowPlaying(data);
      }
    } catch {}
  }, []);

  const fetchGmail = useCallback(async () => {
    try {
      const res = await fetch("/api/gmail");
      const data = await res.json();
      setGmailConnected(data.connected);
      setEmails(data.emails || []);
    } catch {}
  }, []);

  const fetchSoren = useCallback(async () => {
    try {
      const res = await fetch("/api/zoho");
      const data = await res.json();
      setSorenConnected(data.connected);
      setSorenEmails(data.emails || []);
    } catch {}
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      setEvents(data.events || []);
    } catch {}
  }, []);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/playlists");
      const data = await res.json();
      setPlaylists(data.playlists || []);
    } catch {}
  }, []);

  const rerollAphorismo = useCallback(async () => {
    setAphorismoLoading(true);
    try {
      const res = await fetch("/api/aphorismo");
      const data = await res.json();
      setAphorismo(data.aphorismo || null);
    } catch {}
    setAphorismoLoading(false);
  }, []);

  // Add a quote to the rotation straight from the footer — no Notion trip. The
  // new quote shows immediately; undo archives the page it created.
  const addAphorism = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const prev = aphorismo;
    setAphorismo(t);
    try {
      const res = await fetch("/api/aphorismo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) { setAphorismo(prev); toast("Couldn’t save the quote — try again"); return; }
      toast("Added to Aphorismo");
      pushUndo(`add quote “${undoClip(t)}”`, async () => {
        await fetch("/api/aphorismo", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", id: data.id }),
        }).catch(() => {});
        fetchAphorismo();
      });
    } catch {
      setAphorismo(prev); toast("Couldn’t save the quote — try again");
    }
  }, [aphorismo, toast, pushUndo, fetchAphorismo]);

  // The + on an email row: the subject becomes a Short Term task carrying a link
  // back to the thread. The email itself stays put (✓ archives it separately).
  const makeTaskFromEmail = async (email: Email) => {
    const title = email.subject && email.subject !== "(no subject)" ? email.subject : `Email from ${email.from}`;
    toast(`→ Short Term: “${undoClip(title)}”`);
    const id = await addTask(title, "Short Term");
    if (id && email.link) {
      fetch("/api/notion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setLinks", id, links: `Email|${email.link}` }),
      }).catch(() => {});
    }
  };

  // The calendar button on a task row: put it on the schedule. Reads any date
  // words in the title (same parser as quick capture); a title with none lands
  // on today. The task stays in its list — this dates it, it doesn't move it.
  const sendTaskToCalendar = (id: string) => {
    const t = shortTerm.find(x => x.id === id) || longTerm.find(x => x.id === id);
    if (!t) return;
    const p = parseQuickCapture(t.title);
    const date = p.kind === "event" ? p.date : localIso(new Date());
    const time = p.kind === "event" ? p.time : "";
    addEvent(p.title, date, time, "");
    const d = new Date(`${date}T${time || "00:00"}`);
    const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    toast(`→ Schedule: ${day}${time ? " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : ""}`);
  };

  // ---- Hold-` voice ---------------------------------------------------------
  // Hold the backtick key to dictate. In a text field the words land at the
  // caret; anywhere else the transcript becomes a Short Term task, with a
  // Calendar button on the toast for when it was really an appointment. A quick
  // tap still types a plain backtick.
  // theme index persists per device; hydrated after mount so SSR markup stays stable
  const [themeIdx, setThemeIdx] = useState(0);
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem("knox_theme") || "0", 10);
      if (saved >= 0 && saved < THEMES.length) setThemeIdx(saved);
    } catch {}
  }, []);
  const theme = THEMES[themeIdx] || THEMES[0];
  const cycleTheme = () => {
    const next = (themeIdx + 1) % THEMES.length;
    setThemeIdx(next);
    try { localStorage.setItem("knox_theme", String(next)); } catch {}
    toast(`Theme: ${THEMES[next].name}`);
  };

  const [voice, setVoice] = useState<{ mode: "field" | "capture"; text: string } | null>(null);
  // latest handler closures for the once-registered key listeners. Null at
  // first paint (addTask/addEvent are declared further down), assigned every
  // commit — voice can only fire after mount, so it always sees them populated.
  const voiceOps = useRef<null | {
    addTask: (title: string, status: "Short Term" | "Clients", priority?: boolean) => Promise<string | null>;
    addEvent: (title: string, date: string, time: string, type: string) => void;
    toast: (msg: string, undo?: () => void, actionLabel?: string) => void;
    fetchTasks: () => Promise<void>;
  }>(null);
  useEffect(() => { voiceOps.current = { addTask, addEvent, toast, fetchTasks }; });
  // modal state mirrored into a ref so the once-registered key listeners see it
  const modalOpenRef = useRef(false);
  modalOpenRef.current = !!(openProjectId || openClientId || openActionId || openEmail || editingEvent);

  useEffect(() => {
    let rec: any = null;              // active SpeechRecognition instance
    let listening = false;            // recognition actually started
    let holdTimer: number | null = null;
    let held = false;                 // physical key currently down
    let target: HTMLElement | null = null; // field focused when the hold began
    let finalText = "";
    let cancelled = false;            // Esc / click while listening → discard

    const commit = () => {
      const ops = voiceOps.current;
      const text = finalText.trim();
      const discard = cancelled;
      cancelled = false;
      listening = false; rec = null; finalText = "";
      setVoice(null);
      if (discard || !text || !ops) return;
      if (target) { insertTextAtCursor(target, text); target = null; return; }
      // no field held focus → quick capture. Dates route to the schedule on
      // their own; plain speech lands in Short Term with a Calendar alternate.
      const p = parseQuickCapture(text);
      if (p.kind === "event") {
        ops.addEvent(p.title, p.date, p.time, "");
        const d = new Date(`${p.date}T${p.time || "00:00"}`);
        ops.toast(`→ Schedule: ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${p.time ? " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : ""}`);
        return;
      }
      const created = ops.addTask(p.title, "Short Term");
      ops.toast(`→ Short Term: “${p.title.length > 26 ? p.title.slice(0, 26) + "…" : p.title}”`, async () => {
        const id = await created;
        if (id) fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "complete" }) }).catch(() => {});
        ops.addEvent(p.title, localIso(new Date()), "", "");
        voiceOps.current?.fetchTasks();
      }, "Calendar");
    };

    const start = () => {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SR) { voiceOps.current?.toast("Voice needs Chrome or Edge — no speech API in this browser"); return; }
      rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (ev: any) => {
        let interim = "";
        finalText = "";
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        setVoice(v => (v ? { ...v, text: (finalText + interim).trim() } : v));
      };
      rec.onerror = (ev: any) => {
        if (ev.error === "not-allowed") voiceOps.current?.toast("Mic blocked — allow it for this site in the browser");
      };
      rec.onend = commit; // fires after stop() AND after silence timeouts
      try { rec.start(); } catch { rec = null; return; }
      listening = true;
      setVoice({ mode: target ? "field" : "capture", text: "" });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Backquote" || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); // never let raw backticks spray into the page while held
      if (e.repeat || held) return;
      held = true;
      const a = document.activeElement;
      target = isTextField(a) ? (a as HTMLElement) : null;
      holdTimer = window.setTimeout(() => { holdTimer = null; start(); }, 250);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Backquote") return;
      held = false;
      if (holdTimer !== null) {
        // released before the hold threshold → it was a tap, type the backtick
        clearTimeout(holdTimer); holdTimer = null;
        if (target) insertTextAtCursor(target, "`", false);
        target = null;
        return;
      }
      if (listening && rec) { try { rec.stop(); } catch { commit(); } } // commit runs via onend
    };

    // Bail out mid-dictation: Escape or clicking anywhere discards the take.
    // Both run in the capture phase so the same press can't also close a modal,
    // and the cancelling click is swallowed so it doesn't open what it hit.
    const cancel = () => {
      cancelled = true;
      if (rec) { try { rec.stop(); } catch { commit(); } } else commit();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !listening) return;
      e.preventDefault(); e.stopPropagation();
      cancel();
    };
    const onPointerDown = () => {
      if (!listening) return;
      window.addEventListener("click", (ce) => { ce.stopPropagation(); ce.preventDefault(); }, { capture: true, once: true });
      cancel();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      if (holdTimer !== null) clearTimeout(holdTimer);
      if (rec) { rec.onend = null; try { rec.stop(); } catch {} }
    };
  }, []);

  // ---- Type anywhere → Short Term ------------------------------------------
  // With nothing focused, just start typing: the Short Term add box opens with
  // that first keystroke already in it. "/" keeps jumping to the header capture,
  // "`" belongs to voice, and modals/inputs/buttons are left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 || e.key === "/" || e.key === "`" || e.key === " ") return;
      if (modalOpenRef.current) return;
      const a = document.activeElement as HTMLElement | null;
      if (isTextField(a)) return;
      // focused buttons/links/rows handle their own keys (Space/Enter activate)
      if (a && a !== document.body && (a.tagName === "BUTTON" || a.tagName === "A" || a.tagName === "SELECT" || a.getAttribute("role") === "button" || a.getAttribute("role") === "radio")) return;
      e.preventDefault();
      shortAddRef.current?.openWith?.(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    fetchStatic();
    fetchSpotify();
    fetchGmail();
    fetchSoren();
    fetchSchedule();
  }, [fetchStatic, fetchSpotify, fetchGmail, fetchSoren, fetchSchedule]);

  useEffect(() => {
    spotifyInterval.current = setInterval(fetchSpotify, 10000);
    return () => { if (spotifyInterval.current) clearInterval(spotifyInterval.current); };
  }, [fetchSpotify]);


  // the hover popover is pinned to a captured rect, so it detaches on scroll —
  // just dismiss it (capture:true also catches the inner panel's scroll)
  useEffect(() => {
    if (!hover) return;
    const clear = () => setHover(null);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, [hover]);

  // trim a title for use inside a short undo label
  const undoClip = (s: string) => (s.length > 24 ? s.slice(0, 24) + "…" : s);

  // open a project's modal, clearing any hover preview first so a popover can't
  // stay pinned on screen behind/after the modal
  const handleOpenProject = useCallback((id: string) => { setHover(null); setOpenProjectId(id); }, []);

  // Save a client's note (optimistic; persisted to the Notion "Notes" property).
  const saveClientNotes = async (id: string, notes: string) => {
    if (id.startsWith("temp-")) return;
    const prev = clients.find(c => c.id === id)?.notes ?? "";
    if (prev === notes) return;
    setClients(cs => cs.map(c => c.id === id ? { ...c, notes } : c));
    try {
      const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setClientNotes", id, notes }) });
      if (!res.ok) { setClients(cs => cs.map(c => c.id === id ? { ...c, notes: prev } : c)); toast("Couldn’t save note — reverted"); return; }
      pushUndo("edit note", async () => {
        setClients(cs => cs.map(c => c.id === id ? { ...c, notes: prev } : c));
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setClientNotes", id, notes: prev }) });
      });
    } catch { setClients(cs => cs.map(c => c.id === id ? { ...c, notes: prev } : c)); toast("Couldn’t save note — reverted"); }
  };

  // Set a client's 1–5 priority; re-sorts so higher priority floats to the top.
  const setClientRating = async (id: string, rating: number) => {
    if (id.startsWith("temp-")) return;
    const cur = clients.find(c => c.id === id);
    if (!cur) return;
    const prev = cur.rating ?? 0;
    if (prev === rating) return;
    setClients(cs => cs.map(c => c.id === id ? { ...c, rating } : c).sort(byClient)); // optimistic + re-sort
    const revert = () => setClients(cs => cs.map(c => c.id === id ? { ...c, rating: prev } : c).sort(byClient));
    try {
      const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setClientRating", id, rating }) });
      if (!res.ok) { revert(); toast("Couldn’t set priority — reverted"); return; }
      pushUndo(`set ${cur.title.slice(0, 20)} priority`, async () => {
        revert();
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setClientRating", id, rating: prev }) });
      });
    } catch { revert(); toast("Couldn’t set priority — reverted"); }
  };

  const completeTask = async (id: string) => {
    const done = shortTerm.find(t => t.id === id) || longTerm.find(t => t.id === id) || clients.find(t => t.id === id) || actions.find(a => a.id === id);
    // optimistic: drop it from the UI immediately
    setShortTerm(prev => prev.filter(t => t.id !== id));
    setLongTerm(prev => prev.filter(t => t.id !== id));
    setClients(prev => prev.filter(t => t.id !== id));
    setActions(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "complete" }),
      });
      if (!res.ok) { await fetchTasks(); toast("Couldn’t complete — reverted"); return; }
      pushUndo(`complete “${undoClip(done?.title || "task")}”`, async () => {
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "restore" }) });
        await fetchTasks();
      });
    } catch {
      await fetchTasks(); toast("Couldn’t complete — reverted");
    }
  };

  const editTask = async (id: string, newTitle: string) => {
    const prevTitle = (shortTerm.find(t => t.id === id) || longTerm.find(t => t.id === id) || clients.find(t => t.id === id))?.title ?? "";
    // Optimistic update
    setShortTerm(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));
    setLongTerm(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));
    setClients(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));

    // API call
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: newTitle, action: "update" }),
      });
      if (!res.ok) {
        await fetchTasks(); // revert just the task lists (no full-dashboard reload)
        toast("Rename failed — reverted");
        return;
      }
      if (prevTitle && prevTitle !== newTitle) {
        pushUndo(`rename to “${undoClip(newTitle)}”`, async () => {
          await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title: prevTitle, action: "update" }) });
          await fetchTasks();
        });
      }
    } catch {
      await fetchTasks();
      toast("Rename failed — reverted");
    }
  };

  // Short Term tasks and Clients differ in shape (Short Term carries a checklist,
  // Clients don't), so add to the right list with the right shape. Returns the
  // created page id so callers (voice capture's CALENDAR button, email→task) can
  // follow up on the row they just made.
  const addTask = async (title: string, status: "Short Term" | "Clients", priority = false): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;
    if (status === "Short Term") setShortTerm(prev => [...prev, { id: tempId, title, items: [], priority }]);
    else setClients(prev => [...prev, { id: tempId, title }]);
    const rollback = () => status === "Short Term"
      ? setShortTerm(prev => prev.filter(t => t.id !== tempId))
      : setClients(prev => prev.filter(t => t.id !== tempId));
    const swap = (realId: string) => status === "Short Term"
      ? setShortTerm(prev => prev.map(t => t.id === tempId ? { ...t, id: realId } : t))
      : setClients(prev => prev.map(t => t.id === tempId ? { ...t, id: realId } : t));
    try {
      const res = await fetch("/api/notion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { rollback(); toast("Couldn’t add — try again"); return null; }
      // swap the temp id for the real page id in place (no reconcile GET)
      if (data.id) {
        swap(data.id);
        // persist priority for a task added straight into the High Priority box
        if (priority && status === "Short Term") {
          fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setPriority", id: data.id, priority: true }) }).catch(() => {});
        }
        pushUndo(`add “${undoClip(title)}”`, async () => {
          await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id, action: "complete" }) });
          await fetchTasks();
        });
        return data.id as string;
      } else fetchTasks();
    } catch {
      rollback(); toast("Couldn’t add — try again");
    }
    return null;
  };

  // A Long Term "project" is a Notion page (Status=Long Term) that starts empty.
  const addProject = async (title: string) => {
    const tempId = `temp-${Date.now()}`;
    setLongTerm(prev => [...prev, { id: tempId, title, items: [] }]);
    try {
      const res = await fetch("/api/notion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: "Long Term" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLongTerm(prev => prev.filter(p => p.id !== tempId));
        toast("Couldn’t create project — try again");
        return;
      }
      if (data.id) {
        // swap temp -> real page id in place (new project has no items yet), and
        // carry an already-open modal across the swap so it doesn't vanish
        setLongTerm(prev => prev.map(p => p.id === tempId ? { ...p, id: data.id } : p));
        setOpenProjectId(cur => (cur === tempId ? data.id : cur));
        pushUndo(`add project “${undoClip(title)}”`, async () => {
          setOpenProjectId(cur => (cur === data.id ? null : cur));
          await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id, action: "complete" }) });
          await fetchTasks();
        });
      } else {
        fetchTasks();
      }
    } catch {
      setLongTerm(prev => prev.filter(p => p.id !== tempId));
      toast("Couldn’t create project — try again");
    }
  };

  // A project can live in either Short Term or Long Term, so update whichever
  // list holds it (ids are unique, so at most one list actually changes).
  const patchProject = (projectId: string, fn: (p: Project) => Project) => {
    setLongTerm(prev => prev.map(p => p.id === projectId ? fn(p) : p));
    setShortTerm(prev => prev.map(p => p.id === projectId ? fn(p) : p));
  };
  const findProject = (projectId: string): Project | null =>
    longTerm.find(p => p.id === projectId) || shortTerm.find(p => p.id === projectId) || null;

  // Save a project's notes to its Notion page (reuses the generic Notes property
  // writer). Optimistic with revert + undo.
  const saveProjectNotes = async (projectId: string, notes: string) => {
    if (projectId.startsWith("temp-")) return;
    const prev = findProject(projectId)?.notes ?? "";
    if (prev === notes) return;
    patchProject(projectId, p => ({ ...p, notes }));
    const revert = () => patchProject(projectId, p => ({ ...p, notes: prev }));
    try {
      const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setClientNotes", id: projectId, notes }) });
      if (!res.ok) { revert(); toast("Couldn’t save notes — reverted"); return; }
      pushUndo("edit notes", async () => {
        revert();
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setClientNotes", id: projectId, notes: prev }) });
      });
    } catch { revert(); toast("Couldn’t save notes — reverted"); }
  };

  // Save a project's reference links (optimistic, with revert + undo).
  const saveProjectLinks = async (projectId: string, links: SavedLink[]) => {
    if (projectId.startsWith("temp-")) return;
    const prev = findProject(projectId)?.links ?? "";
    const next = serializeLinks(links);
    if (prev === next) return;
    patchProject(projectId, p => ({ ...p, links: next }));
    const revert = () => patchProject(projectId, p => ({ ...p, links: prev }));
    try {
      const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setLinks", id: projectId, links: next }) });
      if (!res.ok) { revert(); toast("Couldn’t save link — reverted"); return; }
      pushUndo("edit links", async () => {
        revert();
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setLinks", id: projectId, links: prev }) });
      });
    } catch { revert(); toast("Couldn’t save link — reverted"); }
  };

  // ----- Checklist items within a project (optimistic) -----
  const addChecklistItem = async (projectId: string, text: string) => {
    if (projectId.startsWith("temp-")) return; // project page doesn't exist yet
    const trimmed = text.trim();
    if (!trimmed) return;
    const tempId = `temp-${Date.now()}`;
    patchProject(projectId, p => ({ ...p, items: [...p.items, { id: tempId, text: trimmed, checked: false }] }));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addChecklistItem", projectId, text: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item?.id) {
        patchProject(projectId, p => ({ ...p, items: p.items.filter(it => it.id !== tempId) }));
        return;
      }
      // swap the temp id for the real Notion block id
      patchProject(projectId, p => ({ ...p, items: p.items.map(it => it.id === tempId ? { ...it, id: data.item.id } : it) }));
      const realId = data.item.id;
      pushUndo(`add item “${undoClip(trimmed)}”`, async () => {
        patchProject(projectId, p => ({ ...p, items: p.items.filter(it => it.id !== realId) }));
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteChecklistItem", itemId: realId }) });
      });
    } catch {
      patchProject(projectId, p => ({ ...p, items: p.items.filter(it => it.id !== tempId) }));
    }
  };

  const deleteChecklistItem = async (projectId: string, itemId: string) => {
    if (itemId.startsWith("temp-")) return;
    const proj = findProject(projectId);
    const idx = proj ? proj.items.findIndex(it => it.id === itemId) : -1;
    const removed = idx >= 0 ? proj!.items[idx] : null;
    patchProject(projectId, p => ({ ...p, items: p.items.filter(it => it.id !== itemId) }));
    // on failure re-insert only the removed item at its old spot, keeping any
    // concurrent toggles/adds to sibling items intact
    const restore = () => {
      if (!removed) return;
      patchProject(projectId, p => {
        if (p.items.some(it => it.id === removed.id)) return p;
        const items = [...p.items];
        items.splice(Math.min(idx, items.length), 0, removed);
        return { ...p, items };
      });
    };
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteChecklistItem", itemId }),
      });
      if (!res.ok) { restore(); return; }
      if (removed) {
        // the original block is gone; undo re-creates it as a fresh block
        pushUndo(`delete item “${undoClip(removed.text)}”`, async () => {
          const r = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addChecklistItem", projectId, text: removed.text }) });
          const d = await r.json().catch(() => ({}));
          const newId = d.item?.id || `temp-${Date.now()}`;
          patchProject(projectId, p => {
            const items = [...p.items];
            items.splice(Math.min(idx, items.length), 0, { id: newId, text: removed.text, checked: false });
            return { ...p, items };
          });
        });
      }
    } catch {
      restore();
    }
  };

  const editChecklistItem = async (projectId: string, itemId: string, text: string) => {
    if (itemId.startsWith("temp-")) return;
    const trimmed = text.trim();
    const prev = findProject(projectId)?.items.find(it => it.id === itemId)?.text ?? "";
    if (!trimmed || trimmed === prev) return;
    patchProject(projectId, p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, text: trimmed } : it) }));
    const revert = () => patchProject(projectId, p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, text: prev } : it) }));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateChecklistItem", itemId, text: trimmed }),
      });
      if (!res.ok) { revert(); toast("Couldn’t rename item — reverted"); return; }
      pushUndo(`rename item to “${undoClip(trimmed)}”`, async () => {
        revert();
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateChecklistItem", itemId, text: prev }) });
      });
    } catch {
      revert(); toast("Couldn’t rename item — reverted");
    }
  };

  // Reorder a project's checklist items. Notion can't move blocks, so we recreate
  // them in the new order (server appends the new sequence then deletes the old
  // blocks); the item ids therefore change, which we swap in from the response.
  const reorderChecklistItems = async (projectId: string, newItems: ChecklistItem[]) => {
    const proj = findProject(projectId);
    if (!proj) return;
    const prevItems = proj.items;
    if (newItems.some(it => it.id.startsWith("temp-"))) return; // wait until every block is saved
    if (newItems.length === prevItems.length && newItems.every((it, i) => it.id === prevItems[i].id)) return; // unchanged
    patchProject(projectId, p => ({ ...p, items: newItems })); // optimistic
    const oldIds = prevItems.map(it => it.id);
    try {
      const res = await fetch("/api/notion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorderChecklist", projectId, items: newItems.map(it => ({ text: it.text, checked: it.checked })), oldIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.items)) { await fetchTasks(); toast("Couldn’t reorder — reverted"); return; }
      patchProject(projectId, p => ({ ...p, items: data.items })); // swap temp/old ids for the new block ids
      pushUndo("reorder items", async () => {
        await fetch("/api/notion", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reorderChecklist", projectId, items: prevItems.map(it => ({ text: it.text, checked: it.checked })), oldIds: data.items.map((it: any) => it.id) }),
        }).catch(() => {});
        await fetchTasks();
      });
    } catch { await fetchTasks(); toast("Couldn’t reorder — reverted"); }
  };

  // Pull a checklist item OUT of a project (drag it off the modal): it becomes its
  // own Short Term task and the project window closes.
  const extractChecklistItem = async (projectId: string, itemId: string) => {
    if (itemId.startsWith("temp-") || projectId.startsWith("temp-")) return;
    const removed = findProject(projectId)?.items.find(it => it.id === itemId);
    if (!removed) return;
    const text = removed.text;
    patchProject(projectId, p => ({ ...p, items: p.items.filter(it => it.id !== itemId) })); // optimistic remove
    const tempId = `temp-extract-${Date.now()}`;
    setShortTerm(prev => [...prev, { id: tempId, title: text || "Untitled", items: [], priority: false }]);
    setOpenProjectId(null); // pull the user out of the window view
    try {
      const res = await fetch("/api/notion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extractItem", projectId, itemId, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) { setShortTerm(prev => prev.filter(t => t.id !== tempId)); await fetchTasks(); toast("Couldn’t pull out — reverted"); return; }
      setShortTerm(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t));
      pushUndo(`pull out “${undoClip(text)}”`, async () => {
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id, action: "complete" }) }).catch(() => {});
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addChecklistItem", projectId, text }) }).catch(() => {});
        await fetchTasks();
      });
    } catch { setShortTerm(prev => prev.filter(t => t.id !== tempId)); await fetchTasks(); toast("Couldn’t pull out — reverted"); }
  };

  // Merge one movable item INTO a bucket: its title (and its own checklist items)
  // become checklist items in the target, and the source page is archived.
  const mergeInto = async (targetId: string, sourceId: string) => {
    setDragOver(null);
    if (!sourceId || sourceId === targetId) return;
    if (targetId.startsWith("temp-") || sourceId.startsWith("temp-")) return;
    const source = findProject(sourceId);
    if (!source) return;
    const targetTitle = findProject(targetId)?.title || "";

    const stamp = Date.now();
    const merged = [
      { id: `temp-${stamp}-t`, text: source.title, checked: false },
      ...source.items.map((it, i) => ({ id: `temp-${stamp}-${i}`, text: it.text, checked: it.checked })),
    ];
    // optimistic: remove the source, append its content to the target
    setLongTerm(prev => prev.filter(p => p.id !== sourceId));
    setShortTerm(prev => prev.filter(p => p.id !== sourceId));
    if (openProjectId === sourceId) setOpenProjectId(null);
    patchProject(targetId, p => ({ ...p, items: [...p.items, ...merged] }));

    let ok = false;
    let appendedIds: string[] = [];
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mergeInto", targetId, sourceId,
          title: source.title, items: source.items.map(it => ({ text: it.text, checked: it.checked })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok && !!data.success;
      appendedIds = data.appendedIds || [];
    } catch {}
    // reconcile: swaps temp item ids for real block ids and confirms the source
    // is gone (or restores the true state if the merge failed)
    await fetchTasks();
    const clip = (s: string) => (s.length > 22 ? s.slice(0, 22) + "…" : s);
    if (ok) {
      const undoMerge = async () => {
        await fetch("/api/notion", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unmerge", sourceId, blockIds: appendedIds }),
        }).catch(() => {});
        await fetchTasks();
      };
      toast(`Merged “${clip(source.title)}” into “${clip(targetTitle)}”`, undoMerge);
      pushUndo(`merge “${undoClip(source.title)}”`, undoMerge);
    } else {
      toast("Merge failed — reverted");
    }
  };

  // Move a task between Short Term and Long Term by dragging it to the other list
  const moveTask = async (id: string, target: "Short Term" | "Long Term") => {
    if (id.startsWith("temp-")) return; // not yet reconciled to a real page id
    const inShort = shortTerm.find(t => t.id === id);
    const inLong = longTerm.find(p => p.id === id);
    const src = inShort || inLong;
    if (!src) return;
    // already in the target list -> nothing to do
    if ((inShort && target === "Short Term") || (inLong && target === "Long Term")) return;

    // optimistic move between the two lists — both carry a checklist now, so move
    // the whole project across; the items persist (its Notion blocks stay put).
    if (target === "Short Term") {
      setLongTerm(prev => prev.filter(p => p.id !== id));
      setShortTerm(prev => [...prev, src]);
    } else {
      setShortTerm(prev => prev.filter(t => t.id !== id));
      setLongTerm(prev => [...prev, src]);
    }

    const origin: "Short Term" | "Long Term" = inShort ? "Short Term" : "Long Term";
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: target, action: "move" }),
      });
      if (!res.ok) { await fetchTasks(); toast("Move failed — reverted"); return; }
      pushUndo(`move “${undoClip(src.title)}” to ${target}`, async () => {
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: origin, action: "move" }) });
        await fetchTasks();
      });
    } catch {
      await fetchTasks(); toast("Move failed — reverted");
    }
  };

  // Flag/unflag a Short Term task as high priority (persists to Notion's Priority
  // checkbox); optimistic, reverts via a refetch on failure.
  const setPriority = async (id: string, priority: boolean) => {
    if (id.startsWith("temp-")) return;
    const cur = findProject(id);
    if (cur && !!cur.priority === priority) return; // already in that state
    const wasPriority = !!cur?.priority;
    const title = cur?.title || "task";
    patchProject(id, p => ({ ...p, priority }));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPriority", id, priority }),
      });
      if (!res.ok) { await fetchTasks(); toast("Priority change failed — reverted"); return; }
      pushUndo(`${priority ? "flag" : "unflag"} “${undoClip(title)}”`, async () => {
        patchProject(id, p => ({ ...p, priority: wasPriority }));
        await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setPriority", id, priority: wasPriority }) });
      });
    } catch {
      await fetchTasks(); toast("Priority change failed — reverted");
    }
  };

  // Drop handler for the Short Term high/normal zones: pull the item into Short
  // Term if it came from Long Term, then set its priority flag.
  const dropToPriority = (id: string, priority: boolean) => {
    if (!id || id.startsWith("temp-")) return;
    if (longTerm.some(p => p.id === id)) moveTask(id, "Short Term");
    setPriority(id, priority);
  };

  // Persist a list's manual order to Notion (Order = index for each page id).
  const persistTaskOrder = (ids: string[]) => {
    fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reorderTasks", ids }) }).catch(() => {});
  };
  const sortByIds = <T extends { id: string }>(arr: T[], ids: string[]) => {
    const pos = new Map(ids.map((id, i) => [id, i]));
    return [...arr].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
  };

  // Drag-reorder a task within its OWN list. Short Term reorders only within the
  // same box (high vs normal); returns true if it actually reordered so the row's
  // drop handler knows to stop the event (else it bubbles to the move/priority
  // drop zone). Long Term isn't reorderable — it's arranged by warmth.
  const reorderTask = (draggedId: string, targetId: string, placeBefore: boolean): boolean => {
    if (!draggedId || draggedId === targetId || draggedId.startsWith("temp-")) return false;
    const inShort = shortTerm.some(t => t.id === draggedId) && shortTerm.some(t => t.id === targetId);
    const inClients = clients.some(t => t.id === draggedId) && clients.some(t => t.id === targetId);
    const apply = (list: (Task | Project)[], setList: (v: any) => void) => {
      const prevIds = list.map(t => t.id);
      const dr = list.find(t => t.id === draggedId)!;
      const arr = list.filter(t => t.id !== draggedId);
      const ti = arr.findIndex(t => t.id === targetId);
      arr.splice(placeBefore ? ti : ti + 1, 0, dr);
      setList(arr);
      persistTaskOrder(arr.map(t => t.id));
      pushUndo("reorder", async () => { setList((cur: any[]) => sortByIds(cur, prevIds)); persistTaskOrder(prevIds); });
    };
    if (inShort) {
      const dr = shortTerm.find(t => t.id === draggedId)!;
      const tg = shortTerm.find(t => t.id === targetId)!;
      if (!!dr.priority !== !!tg.priority) return false; // different box → let it move instead
      apply(shortTerm, setShortTerm);
      return true;
    }
    if (inClients) { apply(clients, setClients); return true; }
    return false;
  };

  const archiveEmail = async (id: string) => {
    const em = emails.find(e => e.id === id);
    setEmails(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { toast("Archive failed — reverted"); }
      else pushUndo(`archive “${undoClip(em?.subject || "email")}”`, async () => {
        await fetch("/api/gmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "unarchive" }) });
        await fetchGmail();
      });
    } catch { toast("Archive failed — reverted"); }
    await fetchGmail();
  };

  const archiveSorenEmail = async (id: string) => {
    const em = sorenEmails.find(e => e.id === id);
    setSorenEmails(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch("/api/zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { toast("Archive failed — reverted"); }
      else pushUndo(`archive “${undoClip(em?.subject || "email")}”`, async () => {
        await fetch("/api/zoho", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "unarchive" }) });
        await fetchSoren();
      });
    } catch { toast("Archive failed — reverted"); }
    await fetchSoren();
  };

  const deleteEvent = async (id: string) => {
    const ev = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { await fetchSchedule(); toast("Couldn’t delete — reverted"); return; }
      if (!id.startsWith("temp-")) pushUndo(`delete event “${undoClip(ev?.title || "event")}”`, async () => {
        await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "restore" }) });
        await fetchSchedule();
      });
    } catch { await fetchSchedule(); toast("Couldn’t delete — reverted"); }
  };

  const addEvent = async (title: string, date: string, time: string, type: string) => {
    // with a time it's a timed event (stored as a UTC ISO so it round-trips);
    // without a time it's an all-day event (date-only string)
    const hasTime = !!time;
    const notionDate = hasTime ? new Date(`${date}T${time}`).toISOString() : date;
    const tempId = `temp-${Date.now()}`;
    // optimistic display (reconciled by fetchSchedule)
    // local calendar days — toISOString here flipped the labels every evening
    const now = new Date();
    const todayStr = localIso(now);
    const tomStr = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const evDay = hasTime ? notionDate.split("T")[0] : date;
    const dObj = new Date(hasTime ? `${date}T${time}` : `${date}T00:00`);
    const displayDate = evDay === todayStr ? "Today" : evDay === tomStr ? "Tomorrow" : dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const displayTime = hasTime ? dObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "";
    setEvents(prev => [...prev, { id: tempId, title, displayDate, displayTime, type }]);
    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date: notionDate, type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setEvents(prev => prev.filter(e => e.id !== tempId)); toast("Couldn’t add event — try again"); return; }
      if (data.id) pushUndo(`add event “${undoClip(title)}”`, async () => {
        await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id }) });
        await fetchSchedule();
      });
    } catch { setEvents(prev => prev.filter(e => e.id !== tempId)); toast("Couldn’t add event — try again"); return; }
    fetchSchedule();
  };

  // Edit an existing event's title / date / time / type.
  const updateEvent = async (id: string, title: string, date: string, time: string, type: string) => {
    const prev = events.find(e => e.id === id);
    if (!prev || id.startsWith("temp-")) return;
    const hasTime = !!time;
    const notionDate = hasTime ? new Date(`${date}T${time}`).toISOString() : date;
    // optimistic display (reconciled by fetchSchedule)
    // local calendar days — toISOString here flipped the labels every evening
    const now = new Date();
    const todayStr = localIso(now);
    const tomStr = localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const evDay = hasTime ? notionDate.split("T")[0] : date;
    const dObj = new Date(hasTime ? `${date}T${time}` : `${date}T00:00`);
    const displayDate = evDay === todayStr ? "Today" : evDay === tomStr ? "Tomorrow" : dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const displayTime = hasTime ? dObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "";
    setEvents(evs => evs.map(e => e.id === id ? { ...e, title, type, displayDate, displayTime, editDate: date, editTime: time } : e));
    try {
      const res = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "update", title, date: notionDate, type }) });
      if (!res.ok) { await fetchSchedule(); toast("Couldn’t save event — reverted"); return; }
      pushUndo(`edit event “${undoClip(title)}”`, async () => {
        const pHasTime = !!prev.editTime;
        const pNotionDate = pHasTime ? new Date(`${prev.editDate}T${prev.editTime}`).toISOString() : (prev.editDate || "");
        if (pNotionDate) await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "update", title: prev.title, date: pNotionDate, type: prev.type }) }).catch(() => {});
        await fetchSchedule();
      });
    } catch { await fetchSchedule(); toast("Couldn’t save event — reverted"); }
    fetchSchedule();
  };

  const spotifyAction = async (action: string) => {
    // optimistic: flip play/pause in the UI immediately
    if (action === "play" || action === "pause") {
      setNowPlaying(p => ({ ...p, playing: action === "play" }));
    }
    await fetch("/api/spotify/now-playing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTimeout(fetchSpotify, 500);
  };

  const setSpotifyVolume = async (v: number) => {
    setVolume(v);
    await fetch(`/api/spotify/volume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume: v }),
    });
  };

  const playPlaylist = async (uri: string) => {
    await fetch("/api/spotify/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
    });
    setShowPlaylists(false);
    setTimeout(fetchSpotify, 800);
  };

  // Finish / un-finish a Today item. It stays on the board either way: crossed
  // off rather than removed, still clickable to read its plan. Optimistic, with
  // a rollback if Notion rejects it, and Ctrl+Z flips it back.
  const toggleActionDone = useCallback(async (id: string, done: boolean) => {
    const prev = actions.find(a => a.id === id);
    if (!prev || !!prev.done === done) return;
    const priorStatus = prev.status || "Short Term";
    const patch = (v: boolean) => setActions(cur => cur.map(a => (a.id === id ? { ...a, done: v } : a)));
    patch(done);
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setActionDone", id, done, status: priorStatus }),
      });
      if (!res.ok) { patch(!done); toast(done ? "Couldn’t finish that — reverted" : "Couldn’t reopen that — reverted"); return; }
      const data = await res.json().catch(() => ({}));
      if (data.status) setActions(cur => cur.map(a => (a.id === id ? { ...a, status: data.status } : a)));
      pushUndo(`${done ? "finish" : "reopen"} “${undoClip(prev.title)}”`, async () => {
        patch(!done);
        await fetch("/api/notion", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setActionDone", id, done: !done, status: priorStatus }),
        }).catch(() => {});
      });
    } catch {
      patch(!done); toast("Couldn’t update that — reverted");
    }
  }, [actions, pushUndo, toast]);

  const progressPct = nowPlaying.duration ? (nowPlaying.progress || 0) / nowPlaying.duration * 100 : 0;

  // modal + hover read live project state so optimistic item edits reflect instantly
  const openProject = openProjectId ? findProject(openProjectId) : null;
  const openClient = openClientId ? clients.find(c => c.id === openClientId) : null;
  const openAction = openActionId ? actions.find(a => a.id === openActionId) : null;
  const hoverProject = hover && !openProjectId ? findProject(hover.id) : null;
  const shortHigh = shortTerm.filter(t => t.priority);
  const shortNormal = shortTerm.filter(t => !t.priority);

  return (
    <div style={{
      background: theme.bg,
      // definite viewport height (not minHeight) so the flex column is bounded:
      // main gets the leftover space and its panels scroll internally, instead of
      // the whole page growing past the (non-scrolling) viewport and clipping the footer
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <GlowyWaves />
      {/* scanline sweeps behind the panels (z0), not over the text */}
      <div className="scan" aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        animation: "scan 12s linear infinite", zIndex: 0, pointerEvents: "none",
      }} />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", position: "relative", zIndex: 1 }}>
        <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>Knox Command Center</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#999", boxShadow: "0 0 8px #999" }} />
          <Tag accent>KNOX // COMMAND CENTER</Tag>
        </div>
        {/* the voice slot — live transcript renders here while ` is held */}
        <div aria-live="polite" style={{ flex: "0 1 420px", minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 22, overflow: "hidden" }}>
          {voice ? (
            <>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "#c06464", boxShadow: "0 0 8px #c06464", animation: "skpulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "#9a9a9a", flexShrink: 0 }}>
                {voice.mode === "field" ? "DICTATING" : "LISTENING"}
              </span>
              <span style={{ fontSize: 12, color: "#cfcfcf", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                {voice.text || "…"}
              </span>
            </>
          ) : (
            <span aria-hidden style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "#3a3a3a", userSelect: "none" }}>
              HOLD ` TO TALK
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Tag>{clock.day}</Tag>
          <Tag>{clock.date}</Tag>
          <button onClick={cycleTheme} title="Cycle theme" aria-label={`Theme: ${theme.name}. Click for the next one`} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Tag>{theme.name}</Tag>
          </button>
          <button onClick={() => { fetchStatic(); fetchGmail(); fetchSoren(); fetchSpotify(); fetchSchedule(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Tag>REFRESH</Tag>
          </button>
        </div>
      </header>

      <div style={{ textAlign: "center", padding: "4px 0 16px" }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: "clamp(64px, 9vw, 108px)",
          fontWeight: 300,
          letterSpacing: "0.06em",
          color: "#f0f0f0",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.04em",
        }}>
          <span>{clock.h}</span>
          <span style={{ color: "#303030", fontWeight: 200 }}>:</span>
          <span>{clock.m}</span>
          <span style={{ color: "#303030", fontWeight: 200 }}>:</span>
          <span style={{ color: "#484848", fontSize: "0.45em", alignSelf: "flex-end", paddingBottom: "0.2em" }}>{clock.s}</span>
        </div>
      </div>

      <main style={{
        flex: 1,
        display: "grid",
        // flat 4-col board (same proportions as the old 1fr/3fr[0.5fr 1fr]/1fr).
        // Only cols 1-2 split into rows, so Today takes space from Soren + Short
        // Term while Projects and email keep their full height.
        gridTemplateColumns: "1fr 1fr 2fr 1fr",
        gridTemplateRows: "2.1fr 1fr",
        gap: 12,
        padding: "0 24px",
        minHeight: 0,
        position: "relative",
        zIndex: 1,
      }}>

        {/* Left column: Soren Email */}
        <div style={{ gridColumn: 1, gridRow: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
          <Panel style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader label="Soren Email" right={<Tag>ZOHO</Tag>} />
            {!sorenConnected ? (
              // Self Client flow: connection comes from server env vars, so
              // there's nothing to click — just say what's missing.
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
                <p style={{ color: "#808080", fontSize: 11, textAlign: "center", lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                  ZOHO NOT CONNECTED — SET ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN IN VERCEL
                </p>
              </div>
            ) : sorenEmails.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#808080", fontSize: 12 }}>No emails</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {sorenEmails.map((email) => (
                  <EmailRow key={email.id} email={email} onArchive={archiveSorenEmail} onOpen={(e) => setOpenEmail({ source: "zoho", email: e })} onMakeTask={makeTaskFromEmail} />
                ))}
              </div>
            )}
          </Panel>

        </div>

        {/* Tasks — Short Term stays tall but skinny; the buckets get the width */}
        {/* display:contents so both halves sit directly on the main grid — that
            lets Projects keep full height while Short Term shortens for Today */}
        <div style={{ display: "contents" }}>
          <div style={{ gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
            {/* HIGH PRIORITY — same darkness as the other panels, framed in a
                black/white hazard-tape border so it still reads as the focal point */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (priorityDrag !== "high") setPriorityDrag("high"); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPriorityDrag(null); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setPriorityDrag(null); if (id) dropToPriority(id, true); }}
              className="hp-box"
              style={{
                flexShrink: 0, maxHeight: "42%", display: "flex", flexDirection: "column", overflow: "hidden",
                // a light-grey box (with dark text) — its lift off the near-black panels is what makes it pop
                background: "rgba(255,255,255,0.62)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
                border: priorityDrag === "high" ? "1px solid #ffffff" : "1px solid #9a9a9a",
                borderRadius: 6, padding: "13px 15px 11px",
                transition: "background 0.2s, border-color 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#f0f0f0", display: "flex", alignItems: "center", gap: 7 }}>
                  <span aria-hidden style={{ fontSize: 9 }}>▲</span> High Priority
                </h2>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#808080" }}>{shortHigh.length}</span>
              </div>
              <div
                onClick={(e) => { if (e.target === e.currentTarget) highAddRef.current?.open(); }}
                style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 0, cursor: "pointer" }}
              >
                {loading ? null : shortHigh.length === 0 ? (
                  <div style={{ borderLeft: "1px dashed #4a4a4a", padding: "2px 0 2px 10px" }}>
                    <p style={{ margin: 0, color: "#808080", fontSize: 11, fontStyle: "italic" }}>Drag tasks here, or use + to add</p>
                  </div>
                ) : <TaskList tasks={shortHigh} onComplete={completeTask} onEdit={editTask} onOpen={handleOpenProject} onHover={(id, rect) => setHover({ id, rect })} onLeave={() => setHover(null)} listKey="short" onReorder={reorderTask} onToCalendar={sendTaskToCalendar} />}
              </div>
              <AddTaskInput ref={highAddRef} onAdd={(title) => addTask(title, "Short Term", true)} placeholder="New priority task..." />
            </div>

            {/* SHORT TERM — everything not prioritized */}
            <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader label="Short Term" right={
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#808080" }}>
                  {shortNormal.length}
                </span>
              } />
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (priorityDrag !== "normal") setPriorityDrag("normal"); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPriorityDrag(null); }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setPriorityDrag(null); if (id) dropToPriority(id, false); }}
                onClick={(e) => { if (e.target === e.currentTarget) shortAddRef.current?.open(); }}
                style={{
                  flex: 1, overflowY: "auto", scrollbarWidth: "none", borderRadius: 2, outlineOffset: -2, cursor: "pointer",
                  outline: priorityDrag === "normal" ? "1px dashed #8a8a8a" : "1px dashed transparent",
                  background: priorityDrag === "normal" ? "rgba(255,255,255,0.025)" : "transparent",
                  transition: "background 0.15s, outline-color 0.15s",
                }}
              >
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, marginBottom: 8 }}>
                      <div style={{ height: 9, background: "#1e1e1e", borderRadius: 2, width: `${75 - i * 8}%` }} />
                    </div>
                  ))
                ) : <TaskList tasks={shortNormal} onComplete={completeTask} onEdit={editTask} onOpen={handleOpenProject} onHover={(id, rect) => setHover({ id, rect })} onLeave={() => setHover(null)} listKey="short" onReorder={reorderTask} onToCalendar={sendTaskToCalendar} />}
              </div>
              <AddTaskInput ref={shortAddRef} onAdd={(title) => addTask(title, "Short Term")} />
            </Panel>
          </div>

          {/* Projects (top) with Up Next stacked under it — full height, both rows */}
          <div style={{ gridColumn: 3, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
            <Panel style={{ flex: 1.6, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader label="Projects" right={
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#808080" }}>
                  {longTerm.length}
                </span>
              } />
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== "Long Term") setDragOver("Long Term"); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOver(null); if (id) moveTask(id, "Long Term"); }}
                onClick={(e) => { if (e.target === e.currentTarget) longAddRef.current?.open(); }}
                style={{
                  flex: 1, overflowY: "auto", scrollbarWidth: "none", borderRadius: 2, outlineOffset: -2, cursor: "pointer",
                  outline: dragOver === "Long Term" ? "1px dashed #8a8a8a" : "1px dashed transparent",
                  background: dragOver === "Long Term" ? "rgba(255,255,255,0.025)" : "transparent",
                  transition: "background 0.15s, outline-color 0.15s",
                }}
              >
                {loading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 10 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: 88, background: "rgba(255,255,255,0.02)", border: "1px solid #2a2a2a", borderRadius: 4 }} />
                    ))}
                  </div>
                ) : (
                  <ProjectGrid
                    projects={longTerm}
                    onOpen={handleOpenProject}
                    onHover={(id, rect) => setHover({ id, rect })}
                    onLeave={() => setHover(null)}
                    onMerge={mergeInto}
                    onAddNew={() => longAddRef.current?.open()}
                  />
                )}
              </div>
              <AddTaskInput ref={longAddRef} onAdd={addProject} placeholder="New project..." />
            </Panel>

            {/* TODAY — actionable items from Cowork, stacked under Projects */}
            <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, padding: "14px 16px 10px" }}>
          <PanelHeader label="Today" right={<Tag>COWORK</Tag>} />
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 0 }}>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 84, background: "rgba(255,255,255,0.02)", border: "1px solid #2a2a2a", borderRadius: 5 }} />
                ))}
              </div>
            ) : actions.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 0" }}>
                <p style={{ color: "#808080", fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
                  No action items yet.<br />
                  <span style={{ color: "#5f5f5f" }}>Your Cowork routine drops three here each morning.</span>
                </p>
              </div>
            ) : (
              // three fixed slots. The routine always writes three, so the columns
              // are pinned rather than derived — a finished item keeps its slot
              // instead of the row resizing under the remaining ones.
              // minmax(0,1fr) bounds the row to the panel's height, so the cards
              // size themselves to the space available instead of overflowing it
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "minmax(0, 1fr)", gap: 10, alignItems: "stretch", height: "100%" }}>
                {actions.map((a, i) => (
                  <ActionCard key={a.id} action={a} index={i} onOpen={() => setOpenActionId(a.id)} onToggleDone={(d) => toggleActionDone(a.id, d)} />
                ))}
              </div>
            )}
          </div>
        </Panel>
          </div>
        </div>

        {/* Right column - Gmail + Spotify (full height, both rows) */}
        <div style={{ gridColumn: 4, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
          <Panel style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Triad Email" right={<Tag>GMAIL</Tag>} />
            {!gmailConnected ? (
              <ConnectButton href="/api/gmail/login" label="CONNECT GMAIL" />
            ) : emails.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#808080", fontSize: 12 }}>No emails</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {emails.map((email) => (
                  <EmailRow key={email.id} email={email} onArchive={archiveEmail} onOpen={(e) => setOpenEmail({ source: "gmail", email: e })} onMakeTask={makeTaskFromEmail} />
                ))}
              </div>
            )}
          </Panel>

          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader label="Spotify" right={
              nowPlaying.connected ? (
                <button onClick={() => { setShowPlaylists(!showPlaylists); if (!showPlaylists) fetchPlaylists(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Tag>PLAYLISTS</Tag>
                </button>
              ) : null
            } />
            {!nowPlaying.connected ? (
              <ConnectButton href="/api/spotify/login" label="CONNECT SPOTIFY" />
            ) : showPlaylists ? (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {playlists.map(p => (
                  <button key={p.id} onClick={() => playPlaylist(p.uri)} style={{
                    display: "block", width: "100%", background: "none", border: "none",
                    borderBottom: "1px solid #1e1e1e", padding: "8px 0", cursor: "pointer", textAlign: "left",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "#555")}
                    onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1e1e1e")}
                  >
                    <span style={{ fontSize: 13, color: "#909090" }}>{p.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {nowPlaying.albumArt && (
                    <img src={nowPlaying.albumArt} alt={nowPlaying.track ? `Album art — ${nowPlaying.track}` : ""} style={{ width: 44, height: 44, objectFit: "cover", border: "1px solid #2a2a2a", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#e0e0e0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {nowPlaying.track || <span style={{ color: "#808080" }}>Not playing</span>}
                    </p>
                    {nowPlaying.artist && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9a9a9a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nowPlaying.artist}</p>}
                  </div>
                </div>
                {nowPlaying.playing && (
                  <div role="progressbar" aria-label="Track progress" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}
                    style={{ height: 3, background: "#2e2e2e", borderRadius: 2, margin: "8px 0" }}>
                    <div style={{ height: "100%", width: `${progressPct}%`, background: "#9a9a9a", transition: "width 1s linear", borderRadius: 2 }} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                  {[
                    { action: "previous", label: "⏮", aria: "Previous track" },
                    { action: nowPlaying.playing ? "pause" : "play", label: nowPlaying.playing ? "⏸" : "▶", aria: nowPlaying.playing ? "Pause" : "Play" },
                    { action: "next", label: "⏭", aria: "Next track" },
                  ].map(btn => (
                    <button key={btn.action} aria-label={btn.aria} onClick={() => spotifyAction(btn.action)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#9a9a9a", fontSize: 14, padding: "4px 8px", transition: "color 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ddd")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#9a9a9a")}
                    ><span aria-hidden>{btn.label}</span></button>
                  ))}
                </div>
                {/* Volume slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#808080" }}>VOL</span>
                  <input
                    type="range" min={0} max={100} value={volume}
                    aria-label="Volume"
                    onChange={e => setSpotifyVolume(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "#9a9a9a", cursor: "pointer", height: 4 }}
                  />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#808080", width: 24, textAlign: "right" }}>{volume}</span>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Schedule — wide box across the bottom-left */}
        <Panel style={{ gridColumn: "1 / span 2", gridRow: 2, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, minWidth: 0 }}>
              <PanelHeader label="Up Next" right={<Tag>SCHEDULE</Tag>} />
              <div
                onClick={(e) => { if (e.target === e.currentTarget) scheduleAddRef.current?.open(); }}
                style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", cursor: "pointer" }}
              >
                {events.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 20 }}>
                    <p style={{ color: "#808080", fontSize: 12 }}>Nothing scheduled</p>
                  </div>
                ) : (
                  // grid stretches the events across the panel's full width; each
                  // event still reads top-to-bottom (title, date, time, type)
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "14px 18px", paddingBottom: 2 }}>
                    {events.map((event) => (
                      <div key={event.id} className="reveal-row" style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, minWidth: 0 }}>
                        <div
                          role="button" tabIndex={0}
                          onClick={() => { if (!event.id.startsWith("temp-")) setEditingEvent(event); }}
                          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !event.id.startsWith("temp-")) { e.preventDefault(); setEditingEvent(event); } }}
                          title="Click to edit"
                          style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, cursor: "pointer", flex: 1 }}
                        >
                          <p style={{ margin: 0, fontSize: 13, color: "#b0b0b0", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.title}</p>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#808080", letterSpacing: "0.05em" }}>{event.displayDate}</span>
                          {event.displayTime && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#808080", letterSpacing: "0.05em" }}>{event.displayTime}</span>}
                          {event.type && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#808080", letterSpacing: "0.12em" }}>{event.type.toUpperCase()}</span>}
                        </div>
                        <button className="row-action" aria-label="Delete appointment" onClick={() => deleteEvent(event.id)} style={{
                          background: "none", border: "none", cursor: "pointer", color: "#808080",
                          fontSize: 12, lineHeight: 1, padding: "0 2px", flexShrink: 0, transition: "color 0.15s, opacity 0.15s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#c06464")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#808080")}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <AddEventInput ref={scheduleAddRef} onAdd={addEvent} />
            </Panel>
      </main>

      <footer style={{
        padding: "12px 24px 16px",
        borderTop: "1px solid #1e1e1e",
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        minHeight: 60,
        position: "relative",
        zIndex: 1,
      }}>
        {/* Left side - Aphorismo (no box — floats on the footer) */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0,
        }}>
          {aphorismo ? (
            <>
              <button
                onClick={rerollAphorismo}
                disabled={aphorismoLoading}
                aria-label="New aphorism"
                style={{
                  background: "none", border: "1px solid #444", cursor: "pointer",
                  color: "#9a9a9a", fontSize: 11, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.15s", flexShrink: 0,
                  opacity: aphorismoLoading ? 0.5 : 1,
                }}
                onMouseEnter={e => !aphorismoLoading && (e.currentTarget.style.borderColor = "#999", e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => !aphorismoLoading && (e.currentTarget.style.borderColor = "#444", e.currentTarget.style.color = "#9a9a9a")}
              >⟳</button>
              <button
                onClick={() => { setAphAdding(a => !a); setAphDraft(""); }}
                aria-label={aphAdding ? "Cancel adding a quote" : "Add a quote"}
                aria-expanded={aphAdding}
                style={{
                  background: "none", border: "1px solid #444", cursor: "pointer",
                  color: "#9a9a9a", fontSize: 11, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#999"; e.currentTarget.style.color = "#aaa"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#9a9a9a"; }}
              >{aphAdding ? "✕" : "+"}</button>
              <Tag>APHORISMO</Tag>
              <span style={{ color: "#222" }}>|</span>
              {aphAdding ? (
                <input
                  autoFocus
                  value={aphDraft}
                  onChange={(e) => setAphDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && aphDraft.trim()) { addAphorism(aphDraft); setAphAdding(false); setAphDraft(""); }
                    if (e.key === "Escape") { setAphAdding(false); setAphDraft(""); }
                  }}
                  placeholder="New quote… (Enter saves, Esc cancels)"
                  aria-label="New aphorism text"
                  style={{
                    flex: 1, minWidth: 0, background: "rgba(255,255,255,0.03)",
                    border: "1px solid #333", color: "#bbb", fontSize: 12, fontStyle: "italic",
                    padding: "5px 9px", borderRadius: 3, outline: "none",
                  }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", fontStyle: "italic", minWidth: 0 }}>
                  {aphorismo}
                </p>
              )}
            </>
          ) : (
            <div style={{ height: 8, width: 200, background: "#1e1e1e", borderRadius: 2 }} />
          )}
        </div>

        {/* Right side - Daily Word (no box — floats on the footer) */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, minWidth: 0,
        }}>
          {verse && allVerses.length > 0 ? (
            <>
              <button
                onClick={() => setVerseIndex((i) => (i - 1 + allVerses.length) % allVerses.length)}
                aria-label="Previous verse"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#808080", fontSize: 12, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "color 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#808080")}
              >←</button>
              <div style={{ textAlign: "right", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", fontStyle: "italic" }}>
                  {allVerses[verseIndex]?.text || verse.text}
                </p>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 500,
                  color: "#9a9a9a", letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  display: "block",
                  marginTop: 4,
                }}>{allVerses[verseIndex]?.ref || verse.ref}</span>
              </div>
              <span style={{ color: "#222" }}>|</span>
              <Tag>DAILY WORD</Tag>
              <button
                onClick={() => setVerseIndex((i) => (i + 1) % allVerses.length)}
                aria-label="Next verse"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#808080", fontSize: 12, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "color 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#808080")}
              >→</button>
            </>
          ) : (
            <div style={{ height: 8, width: 200, background: "#1e1e1e", borderRadius: 2 }} />
          )}
        </div>
      </footer>

      {hoverProject && createPortal(<HoverPopover project={hoverProject} rect={hover!.rect} />, document.body)}

      {openProject && (
        <ProjectModal
          project={openProject}
          list={shortTerm.some(p => p.id === openProject.id) ? "Short Term" : longTerm.some(p => p.id === openProject.id) ? "Long Term" : null}
          onClose={() => setOpenProjectId(null)}
          onAddItem={addChecklistItem}
          onDeleteItem={deleteChecklistItem}
          onEditItem={editChecklistItem}
          onEditTitle={editTask}
          onArchive={(id) => { completeTask(id); setOpenProjectId(null); }}
          onMove={moveTask}
          onReorderItems={reorderChecklistItems}
          onExtractItem={extractChecklistItem}
          onSaveNotes={saveProjectNotes}
          onSaveLinks={saveProjectLinks}
        />
      )}

      {openAction && (
        <ActionPlanModal
          action={openAction}
          onClose={() => setOpenActionId(null)}
          onComplete={() => toggleActionDone(openAction.id, !openAction.done)}
        />
      )}

      {openClient && (
        <ClientNoteModal
          client={openClient}
          onClose={() => setOpenClientId(null)}
          onSaveNotes={saveClientNotes}
          onEditTitle={editTask}
        />
      )}

      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={updateEvent}
          onDelete={deleteEvent}
        />
      )}

      {openEmail && (
        <EmailReader source={openEmail.source} email={openEmail.email} onClose={() => setOpenEmail(null)} />
      )}

      {/* theme tint: one color-blend layer re-hues the whole monochrome board.
          Portaled last into body so it also covers every portaled modal/toast. */}
      {theme.tint && typeof document !== "undefined" && createPortal(
        <div aria-hidden style={{
          position: "fixed", inset: 0, background: theme.tint,
          mixBlendMode: "color", opacity: theme.tintOpacity ?? 0.5,
          pointerEvents: "none", zIndex: 99998,
        }} />,
        document.body
      )}
      {/* PAPER: cheap light mode — invert the page, re-invert real imagery */}
      {theme.invert && (
        <style dangerouslySetInnerHTML={{ __html: `
          html { filter: invert(1) hue-rotate(180deg); background: #f2f0ec; }
          img, video, iframe { filter: invert(1) hue-rotate(180deg); }
        ` }} />
      )}

      {/* transient status toasts — sync failures and merge undo */}
      {toasts.length > 0 && (
        <div aria-live="polite" style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 9800, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none" }}>
          {toasts.map(t => (
            <div key={t.id} role="status" style={{
              pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12,
              background: "rgba(14,16,20,0.96)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "1px solid #3a3a3a", borderRadius: 4, padding: "8px 14px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.6)", animation: "toastIn 0.18s ease-out",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.04em", color: "#cfcfcf",
            }}>
              <span>{t.msg}</span>
              {t.undo && (
                <button onClick={() => { t.undo!(); setToasts(prev => prev.filter(x => x.id !== t.id)); }} style={{
                  background: "none", border: "1px solid #505050", color: "#e8e8e8", cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em",
                  padding: "3px 8px", borderRadius: 3, textTransform: "uppercase",
                }}>{t.actionLabel || "Undo"}</button>
              )}
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400&family=DM+Sans:wght@300;400;500&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        /* everything in Courier Prime — beats inline font-family declarations */
        * { font-family: 'Courier Prime', 'Courier New', monospace !important; }
        @keyframes scan { 0% { transform: translateY(-2px); } 100% { transform: translateY(100vh); } }
        @keyframes skpulse { 0%,100% { opacity: 0.5 } 50% { opacity: 0.85 } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 3px; }
        /* visible keyboard focus everywhere (!important beats inline outline:none on inputs) */
        :focus-visible { outline: 2px solid #cfcfcf !important; outline-offset: 2px; }
        /* keep the ring from being clipped by panel overflow */
        .reveal-row:focus-within, .reveal-row .row-action:focus-visible { outline-offset: -2px; }
        /* row action buttons: hidden until the row is hovered / keyboard-focused */
        .reveal-row .row-action { opacity: 0; transition: opacity 0.15s; }
        .reveal-row:hover .row-action,
        .reveal-row:focus-within .row-action { opacity: 1; }
        @media (hover: none) { .reveal-row .row-action { opacity: 1; } }
        .skeleton { animation: skpulse 1.4s ease-in-out infinite; }
        /* High Priority is a light box, so its text goes dark (overrides the inline
           light colors the shared rows use elsewhere) */
        .hp-box h2, .hp-box p { color: #141414 !important; }
        .hp-box > div:first-child > span { color: #3a3a3a !important; }
        .hp-box .reveal-row { border-left-color: #707070 !important; }
        .hp-box .reveal-row p:hover { background-color: rgba(0,0,0,0.06) !important; }
        /* project notes editor — two block types only: heading and bullet */
        .notes-edit { word-break: break-word; }
        .notes-edit .nb-p { margin: 0 0 0.55em; min-height: 1.8em; }
        .notes-edit .nb-h { font-size: 1.55em; font-weight: 600; color: #f0ede8; line-height: 1.3; margin: 1.15em 0 0.4em; letter-spacing: -0.01em; }
        .notes-edit .nb-h:first-child { margin-top: 0; }
        .notes-edit .nb-li { position: relative; padding-left: 1.55em; margin: 0 0 0.3em; min-height: 1.8em; }
        .notes-edit .nb-li::before { content: "\\25CF"; position: absolute; left: 0.42em; top: 0; font-size: 0.55em; line-height: 3.2; color: #8f8a80; }
        .notes-edit[data-empty="1"] .nb-p:first-child::before {
          content: "Write\\2026"; color: #55514b; pointer-events: none; position: absolute;
        }
        .notes-edit[data-empty="1"] .nb-p:first-child { position: relative; }
        @media (prefers-reduced-motion: reduce) {
          .scan { animation: none !important; }
          .skeleton { animation: none !important; }
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      ` }} />
    </div>
  );
}

const ACCESS_CODE = "2904";

// Simple client-side access gate. Note: this only keeps casual visitors out —
// the code ships in the page bundle, so it isn't real security.
function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (value.trim() === ACCESS_CODE) {
      // localStorage is per-browser and persists across tab closes, so this
      // device stays unlocked while a different browser/device must enter the code
      try { localStorage.setItem("knox_unlocked", "1"); } catch {}
      onUnlock();
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div style={{
      background: "#0a0a0a",
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 22,
      fontFamily: "'DM Sans', sans-serif",
      backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#999", boxShadow: "0 0 8px #999" }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          letterSpacing: "0.18em", color: "#e8e8e8", textTransform: "uppercase",
        }}>KNOX // COMMAND CENTER</span>
      </div>

      <span role={error ? "alert" : undefined} aria-live="assertive" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
        letterSpacing: "0.2em", textTransform: "uppercase",
        color: error ? "#c06464" : "#808080",
        transition: "color 0.2s",
      }}>{error ? "ACCESS DENIED" : "ENTER ACCESS CODE"}</span>

      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        aria-label="Access code"
        value={value}
        onChange={e => { setValue(e.target.value); if (error) setError(false); }}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        style={{
          background: "rgba(20,20,20,0.6)",
          border: `1px solid ${error ? "#7a3a3a" : "#2a2a2a"}`,
          color: "#ddd", fontSize: 22, letterSpacing: "0.5em",
          textAlign: "center", padding: "12px 16px", width: 200,
          fontFamily: "'JetBrains Mono', monospace", outline: "none",
          borderRadius: 2, transition: "border-color 0.2s",
        }}
      />

      <button onClick={submit} style={{
        background: "#1e1e1e", border: "1px solid #444", color: "#aaa",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em",
        padding: "8px 22px", cursor: "pointer", textTransform: "uppercase", borderRadius: 2,
        transition: "border-color 0.2s, color 0.2s",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#888"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#aaa"; }}
      >UNLOCK</button>
    </div>
  );
}

export default function Page() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  // read the saved unlock state once, client-side, before deciding what to show
  useEffect(() => {
    try { setUnlocked(localStorage.getItem("knox_unlocked") === "1"); } catch {}
    setReady(true);
  }, []);

  if (!ready) return null;                       // avoid a flash of the lock on reload
  if (!unlocked) return <Lock onUnlock={() => setUnlocked(true)} />;
  return <Dashboard />;
}