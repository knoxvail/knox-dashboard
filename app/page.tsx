"use client";

import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";

type Task = { id: string; title: string };
type ChecklistItem = { id: string; text: string; checked: boolean }; // id = Notion BLOCK id
type Project = { id: string; title: string; items: ChecklistItem[]; priority?: boolean }; // id = Notion PAGE id
type Verse = { ref: string; text: string };
type Email = { id: string; from: string; subject: string; date: string; link: string };
type Event = { id: string; title: string; displayDate: string; displayTime: string; type: string };
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
function EmailRow({ email, onArchive, onOpen }: { email: Email; onArchive: (id: string) => void; onOpen: (email: Email) => void }) {
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
  const darkDoc = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><base target="_blank"><style>:root{color-scheme:dark;}html,body{background:#0e1014;color:#cfcfcf;margin:0;padding:14px 16px;font-family:-apple-system,'DM Sans',Segoe UI,sans-serif;font-size:14px;line-height:1.55;word-break:break-word;}a{color:#9fc0ff;}img{max-width:100%;height:auto;}table{max-width:100%!important;}blockquote{border-left:2px solid #3a3a3a;margin:0 0 0 4px;padding-left:12px;color:#9a9a9a;}pre{white-space:pre-wrap;}</style></head><body>${html}</body></html>`;

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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#7bd88f", textTransform: "uppercase", flexShrink: 0 }}>Sent ✓</span>
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
        fontSize: 13,
        fontWeight: 600,
        padding: "3px 8px",
        flexShrink: 0,
        borderRadius: 3,
        transition: "color 0.2s, border-color 0.2s, background 0.2s, opacity 0.15s",
        lineHeight: 1,
        pointerEvents: "auto",
      }}
      onMouseEnter={e => { (e.currentTarget.style.color = "#fff"); (e.currentTarget.style.borderColor = "#aaa"); (e.currentTarget.style.background = "#2a2a2a"); }}
      onMouseLeave={e => { (e.currentTarget.style.color = "#aaa"); (e.currentTarget.style.borderColor = "#505050"); (e.currentTarget.style.background = "#1e1e1e"); }}
    >✓</button>
  );
}

function TaskItem({
  task,
  isEditing,
  onEdit,
  onComplete,
  onStartEdit,
  onCancelEdit,
  onOpen,
}: {
  task: Task;
  isEditing: boolean;
  onEdit: (id: string, newTitle: string) => Promise<void>;
  onComplete: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onOpen?: (id: string) => void; // when set, clicking the row opens the modal instead of inline-editing
}) {
  const [inputValue, setInputValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

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
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.style.opacity = "0.4";
      }}
      onDragEnd={(e) => { e.currentTarget.style.opacity = "1"; }}
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
      }}
      onMouseEnter={e => {
        if (!isEditing) {
          (e.currentTarget as HTMLElement).style.borderLeftColor = "#777";
          (e.currentTarget as HTMLElement).style.paddingLeft = "12px";
        }
      }}
      onMouseLeave={e => {
        if (!isEditing) {
          (e.currentTarget as HTMLElement).style.borderLeftColor = "#2a2a2a";
          (e.currentTarget as HTMLElement).style.paddingLeft = "10px";
        }
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
          {task.title}
        </p>
      )}
      <DoneButton onClick={() => onComplete(task.id)} />
    </div>
  );
}

function TaskList({ tasks, onComplete, onEdit, onOpen }: { tasks: Task[]; onComplete: (id: string) => void; onEdit: (id: string, newTitle: string) => Promise<void>; onOpen?: (id: string) => void }) {
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
          isEditing={editingId === t.id}
          onEdit={onEdit}
          onComplete={onComplete}
          onStartEdit={(id) => setEditingId(id)}
          onCancelEdit={() => setEditingId(null)}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

type AddHandle = { open: () => void };
const AddTaskInput = forwardRef<AddHandle, { onAdd: (title: string) => Promise<void>; placeholder?: string }>(
  function AddTaskInput({ onAdd, placeholder = "New task..." }, ref) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // let the surrounding panel open the input by clicking empty space
  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

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
  const done = project.items.filter((i) => i.checked).length;
  const label = count === 0 ? "EMPTY" : done > 0 ? `${done}/${count} DONE` : `${count} ITEM${count > 1 ? "S" : ""}`;
  // faint pastel keyed to the workload (green -> purple, one tier per item)
  const hue = taskHue(count);
  const baseBg = `hsla(${hue}, 55%, 55%, 0.08)`;
  const hoverBg = `hsla(${hue}, 55%, 55%, 0.15)`;
  const badgeColor = `hsl(${hue}, 45%, 72%)`;

  return (
    <div
      draggable
      tabIndex={0}
      role="button"
      aria-label={`${project.title} — ${label}. Open project`}
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
        onHover(project.id, e.currentTarget.getBoundingClientRect());
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
        background: dropTarget ? "rgba(255,255,255,0.08)" : baseBg,
        border: dropTarget ? "1px solid #9a9a9a" : "1px solid #2a2a2a",
        borderRadius: 5,
        padding: "12px 13px 10px",
        marginBottom: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        breakInside: "avoid",
        transition: "border-color 0.2s, background 0.2s, transform 0.2s",
      }}
    >
      {/* full title — no clamp, wrap long words so nothing is cut off */}
      <span style={{
        fontSize: 13, color: "#cfcfcf", fontFamily: "'DM Sans', sans-serif",
        lineHeight: 1.4, overflowWrap: "anywhere",
      }}>{project.title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }} aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 9, height: 1, background: dropTarget ? "#444" : `hsla(${hue}, 40%, 55%, 0.7)` }} />)}
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          letterSpacing: "0.12em", color: dropTarget ? "#cfcfcf" : badgeColor,
        }}>{dropTarget ? "MERGE INTO ▾" : label}</span>
      </div>
    </div>
  );
}

function ProjectGrid({ projects, onOpen, onHover, onLeave, onMerge }: {
  projects: Project[];
  onOpen: (id: string) => void;
  onHover: (id: string, rect: DOMRect) => void;
  onLeave: () => void;
  onMerge: (targetId: string, sourceId: string) => void;
}) {
  if (projects.length === 0) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 60 }}>
      <p style={{ color: "#808080", fontSize: 12, textAlign: "center" }}>No projects yet — add one below</p>
    </div>
  );
  // masonry via CSS columns: bubbles size to their content and pack together
  // (varied heights). paddingTop gives the hover-lift room so it isn't clipped.
  return (
    <div style={{ columnWidth: 150, columnGap: 10, paddingTop: 3 }}>
      {projects.map((p) => (
        <BucketCard key={p.id} project={p} onOpen={onOpen} onHover={onHover} onLeave={onLeave} onMerge={onMerge} />
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
  const left = Math.min(Math.max(rect.left, 8), vw - W - 8);
  const openAbove = rect.bottom + 8 + estH > vh;
  // when flipping above, anchor to the card's top edge and cap the height so the
  // popover can never overlap the card it previews
  const pos: React.CSSProperties = openAbove
    ? { bottom: Math.max(vh - rect.top + 8, 8), maxHeight: Math.max(rect.top - 16, 60) }
    : { top: rect.bottom + 8, maxHeight: Math.max(vh - rect.bottom - 16, 60) };

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

// Click-to-open editor for a project's checklist. Portalled to document.body so
// the panel's overflow/backdrop-filter stacking context can't clip it.
function ProjectModal({ project, list, onClose, onAddItem, onDeleteItem, onEditItem, onEditTitle, onArchive, onMove }: {
  project: Project;
  list: "Short Term" | "Long Term" | null; // which list the project is in (for the Move control)
  onClose: () => void;
  onAddItem: (projectId: string, text: string) => void;
  onDeleteItem: (projectId: string, itemId: string) => void;
  onEditItem: (projectId: string, itemId: string, text: string) => void;
  onEditTitle: (id: string, title: string) => Promise<void>;
  onArchive: (id: string) => void;
  onMove: (id: string, target: "Short Term" | "Long Term") => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(project.title);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState("");
  const [newItem, setNewItem] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isTemp = project.id.startsWith("temp-");
  const titleId = "proj-modal-title";

  useEffect(() => { setTitleValue(project.title); }, [project.title]);
  useEffect(() => {
    // Escape closes the modal, but not while renaming (that Escape cancels the edit)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editingTitle) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editingTitle]);
  useEffect(() => { if (!isTemp) setTimeout(() => addRef.current?.focus(), 60); }, [isTemp]);
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

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        zIndex: 9000, display: "grid", placeItems: "center",
        fontFamily: "'DM Sans', sans-serif", animation: "fadeIn 0.18s ease-out",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
        style={{
          width: "min(440px, 92vw)", maxHeight: "78vh",
          background: "rgba(12,14,18,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid #3a3a3a", borderRadius: 6, padding: "20px 22px",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)", position: "relative",
          animation: "modalIn 0.2s ease-out",
        }}>
        <div style={{ position: "absolute", top: -1, left: 16, width: 32, height: 1, background: "#999" }} />
        <div style={{ position: "absolute", top: -1, left: -1, width: 10, height: 10, borderTop: "1px solid #999", borderLeft: "1px solid #999" }} />

        {/* header: editable title + close */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitTitle(); if (e.key === "Escape") { e.stopPropagation(); setTitleValue(project.title); setEditingTitle(false); } }}
              onBlur={submitTitle}
              style={{
                flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#e8e8e8",
                fontSize: 18, padding: "4px 8px", fontFamily: "'DM Sans', sans-serif",
                outline: "none", borderRadius: 3, minWidth: 0,
              }}
            />
          ) : (
            <h2
              id={titleId}
              onClick={() => !isTemp && setEditingTitle(true)}
              title={isTemp ? undefined : "Click to rename"}
              style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "#e8e8e8", lineHeight: 1.3, cursor: isTemp ? "default" : "pointer", flex: 1, minWidth: 0, wordBreak: "break-word" }}
            >{project.title}</h2>
          )}
          <button onClick={onClose} aria-label="Close" style={{
            background: "none", border: "none", cursor: "pointer", color: "#808080",
            fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0, transition: "color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}
          >✕</button>
        </div>

        {/* checklist items */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 40 }}>
          {project.items.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
              <p style={{ color: "#808080", fontSize: 12 }}>No items yet</p>
            </div>
          ) : project.items.map((it) => {
            const temp = it.id.startsWith("temp-");
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "1px solid #1e1e1e" }}>
                {/* click the check to remove the item */}
                <button
                  disabled={temp}
                  title="Remove"
                  aria-label="Remove item"
                  onClick={() => onDeleteItem(project.id, it.id)}
                  style={{
                    width: 18, height: 18, flexShrink: 0, marginTop: 1,
                    background: "#1e1e1e",
                    border: "1px solid #505050", borderRadius: 3,
                    color: "#aaa", fontSize: 11, lineHeight: 1, cursor: temp ? "default" : "pointer",
                    opacity: temp ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "color 0.15s, border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (temp) return; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#aaa"; e.currentTarget.style.background = "#2a2a2a"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#aaa"; e.currentTarget.style.borderColor = "#505050"; e.currentTarget.style.background = "#1e1e1e"; }}
                >✓</button>
                {editingItemId === it.id ? (
                  <input
                    autoFocus
                    value={itemDraft}
                    onChange={(e) => setItemDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { onEditItem(project.id, it.id, itemDraft); setEditingItemId(null); } if (e.key === "Escape") setEditingItemId(null); }}
                    onBlur={() => { onEditItem(project.id, it.id, itemDraft); setEditingItemId(null); }}
                    style={{ flex: 1, minWidth: 0, background: "#1a1a1a", border: "1px solid #333", color: "#ddd", fontSize: 13, padding: "2px 6px", fontFamily: "'DM Sans', sans-serif", outline: "none", borderRadius: 3 }}
                  />
                ) : (
                  <span
                    onClick={() => { if (!temp) { setEditingItemId(it.id); setItemDraft(it.text); } }}
                    title={temp ? undefined : "Click to edit"}
                    style={{
                      flex: 1, fontSize: 13, color: "#b0b0b0",
                      lineHeight: 1.4, minWidth: 0, wordBreak: "break-word", cursor: temp ? "default" : "text",
                    }}
                  >{it.text || "Untitled"}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* add item */}
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          <input
            ref={addRef}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitItem(); }}
            placeholder={isTemp ? "Saving project…" : "Add item..."}
            disabled={isTemp}
            style={{
              flex: 1, background: "#1a1a1a", border: "1px solid #333", color: "#ccc",
              fontSize: 12, padding: "6px 8px", fontFamily: "'DM Sans', sans-serif",
              outline: "none", borderRadius: 2, opacity: isTemp ? 0.5 : 1,
            }}
          />
          <button onClick={submitItem} disabled={isTemp} style={{
            background: "#1e1e1e", border: "1px solid #505050", color: "#aaa",
            fontSize: 11, padding: "4px 12px", cursor: isTemp ? "default" : "pointer", borderRadius: 2,
            flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", opacity: isTemp ? 0.5 : 1,
          }}>ADD</button>
        </div>

        {/* move (keyboard-accessible alternative to dragging) + archive */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          {list && !isTemp ? (
            <button onClick={() => { onMove(project.id, list === "Short Term" ? "Long Term" : "Short Term"); onClose(); }} style={{
              background: "none", border: "1px solid #4a4a4a", cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em",
              color: "#9a9a9a", textTransform: "uppercase", padding: "4px 9px", borderRadius: 3, transition: "color 0.15s, border-color 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e8e8e8"; e.currentTarget.style.borderColor = "#7a7a7a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#9a9a9a"; e.currentTarget.style.borderColor = "#4a4a4a"; }}
            >Move to {list === "Short Term" ? "Long Term" : "Short Term"}</button>
          ) : <span />}
          <button onClick={() => onArchive(project.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em",
            color: "#808080", textTransform: "uppercase", padding: 0, transition: "color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#c06464")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#808080")}
          >Archive Project</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Dashboard() {
  const clock = useClock();
  const [shortTerm, setShortTerm] = useState<Project[]>([]);
  const [longTerm, setLongTerm] = useState<Project[]>([]);
  const [clients, setClients] = useState<Task[]>([]);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [allVerses, setAllVerses] = useState<Verse[]>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const [aphorismo, setAphorismo] = useState<string | null>(null);
  const [aphorismoLoading, setAphorismoLoading] = useState(false);
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
  const [openEmail, setOpenEmail] = useState<{ source: "gmail" | "zoho"; email: Email } | null>(null);
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; undo?: () => void }[]>([]);
  const spotifyInterval = useRef<NodeJS.Timeout | null>(null);
  // let each list open its add-input when its empty space is clicked
  const shortAddRef = useRef<AddHandle>(null);
  const longAddRef = useRef<AddHandle>(null);
  const clientsAddRef = useRef<AddHandle>(null);
  const highAddRef = useRef<AddHandle>(null);
  const scheduleAddRef = useRef<AddHandle>(null);

  const toast = useCallback((msg: string, undo?: () => void) => {
    const id = (typeof performance !== "undefined" ? performance.now() : 0) + Math.random();
    setToasts(prev => [...prev, { id, msg, undo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), undo ? 7000 : 4000);
  }, []);

  // Each source fetches independently so one slow endpoint never blocks the
  // others — no single-dependency bottleneck.
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/notion");
      const data = await res.json();
      setShortTerm(data.shortTerm || []);
      setLongTerm(data.longTerm || []);
      setClients(data.clients || []);
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

  const completeTask = async (id: string) => {
    // optimistic: drop it from the UI immediately
    setShortTerm(prev => prev.filter(t => t.id !== id));
    setLongTerm(prev => prev.filter(t => t.id !== id));
    setClients(prev => prev.filter(t => t.id !== id));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "complete" }),
      });
      if (!res.ok) { await fetchTasks(); toast("Couldn’t complete — reverted"); }
    } catch {
      await fetchTasks(); toast("Couldn’t complete — reverted");
    }
  };

  const editTask = async (id: string, newTitle: string) => {
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
      }
    } catch {
      await fetchTasks();
      toast("Rename failed — reverted");
    }
  };

  // Short Term tasks and Clients differ in shape (Short Term carries a checklist,
  // Clients don't), so add to the right list with the right shape.
  const addTask = async (title: string, status: "Short Term" | "Clients", priority = false) => {
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
      if (!res.ok) { rollback(); toast("Couldn’t add — try again"); return; }
      // swap the temp id for the real page id in place (no reconcile GET)
      if (data.id) {
        swap(data.id);
        // persist priority for a task added straight into the High Priority box
        if (priority && status === "Short Term") {
          fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setPriority", id: data.id, priority: true }) }).catch(() => {});
        }
      } else fetchTasks();
    } catch {
      rollback(); toast("Couldn’t add — try again");
    }
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
      if (!res.ok) restore();
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
      if (!res.ok) { revert(); toast("Couldn’t rename item — reverted"); }
    } catch {
      revert(); toast("Couldn’t rename item — reverted");
    }
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
      toast(`Merged “${clip(source.title)}” into “${clip(targetTitle)}”`, async () => {
        await fetch("/api/notion", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unmerge", sourceId, blockIds: appendedIds }),
        }).catch(() => {});
        await fetchTasks();
      });
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

    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: target, action: "move" }),
      });
      if (!res.ok) { await fetchTasks(); toast("Move failed — reverted"); }
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
    patchProject(id, p => ({ ...p, priority }));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPriority", id, priority }),
      });
      if (!res.ok) { await fetchTasks(); toast("Priority change failed — reverted"); }
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

  const archiveEmail = async (id: string) => {
    setEmails(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) toast("Archive failed — reverted");
    } catch { toast("Archive failed — reverted"); }
    await fetchGmail();
  };

  const archiveSorenEmail = async (id: string) => {
    setSorenEmails(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch("/api/zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) toast("Archive failed — reverted");
    } catch { toast("Archive failed — reverted"); }
    await fetchSoren();
  };

  const deleteEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { await fetchSchedule(); toast("Couldn’t delete — reverted"); }
    } catch { await fetchSchedule(); toast("Couldn’t delete — reverted"); }
  };

  const addEvent = async (title: string, date: string, time: string, type: string) => {
    // with a time it's a timed event (stored as a UTC ISO so it round-trips);
    // without a time it's an all-day event (date-only string)
    const hasTime = !!time;
    const notionDate = hasTime ? new Date(`${date}T${time}`).toISOString() : date;
    const tempId = `temp-${Date.now()}`;
    // optimistic display (reconciled by fetchSchedule)
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tom = new Date(now); tom.setUTCDate(now.getUTCDate() + 1);
    const tomStr = tom.toISOString().split("T")[0];
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
      if (!res.ok) { setEvents(prev => prev.filter(e => e.id !== tempId)); toast("Couldn’t add event — try again"); return; }
    } catch { setEvents(prev => prev.filter(e => e.id !== tempId)); toast("Couldn’t add event — try again"); return; }
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

  const progressPct = nowPlaying.duration ? (nowPlaying.progress || 0) / nowPlaying.duration * 100 : 0;

  // modal + hover read live project state so optimistic item edits reflect instantly
  const openProject = openProjectId ? findProject(openProjectId) : null;
  const hoverProject = hover && !openProjectId ? findProject(hover.id) : null;
  const shortHigh = shortTerm.filter(t => t.priority);
  const shortNormal = shortTerm.filter(t => !t.priority);

  return (
    <div style={{
      background: "#0a0a0a",
      minHeight: "100vh",
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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Tag>{clock.day}</Tag>
          <Tag>{clock.date}</Tag>
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
        gridTemplateColumns: "1fr 3fr 1fr",
        gap: 12,
        padding: "0 24px",
        minHeight: 0,
        position: "relative",
        zIndex: 1,
      }}>

        {/* Left column: Soren Email (tall) + Clients */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
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
                  <EmailRow key={email.id} email={email} onArchive={archiveSorenEmail} onOpen={(e) => setOpenEmail({ source: "zoho", email: e })} />
                ))}
              </div>
            )}
          </Panel>

          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader label="Clients" right={
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#808080" }}>
                {clients.length}
              </span>
            } />
            <div
              onClick={(e) => { if (e.target === e.currentTarget) clientsAddRef.current?.open(); }}
              style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}
            >
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, marginBottom: 8 }}>
                    <div style={{ height: 9, background: "#1e1e1e", borderRadius: 2, width: `${75 - i * 10}%` }} />
                  </div>
                ))
              ) : <TaskList tasks={clients} onComplete={completeTask} onEdit={editTask} />}
            </div>
            <AddTaskInput ref={clientsAddRef} onAdd={(title) => addTask(title, "Clients")} />
          </Panel>
        </div>

        {/* Tasks — Short Term stays tall but skinny; the buckets get the width */}
        <div style={{ display: "grid", gridTemplateColumns: "0.5fr 1fr", gap: 12, minHeight: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            {/* HIGH PRIORITY — its own bold-outlined box; the page's focal point */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (priorityDrag !== "high") setPriorityDrag("high"); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPriorityDrag(null); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setPriorityDrag(null); if (id) dropToPriority(id, true); }}
              style={{
                flexShrink: 0, maxHeight: "42%", display: "flex", flexDirection: "column", overflow: "hidden",
                background: "rgba(42,45,53,0.6)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
                border: priorityDrag === "high" ? "1.5px solid #e8e8e8" : "1.5px solid #9a9a9a",
                borderRadius: 7, padding: "13px 15px 11px",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 8px 26px rgba(0,0,0,0.4)",
                transition: "border-color 0.2s, background 0.2s",
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
                style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 0 }}
              >
                {loading ? null : shortHigh.length === 0 ? (
                  <div style={{ borderLeft: "1px dashed #4a4a4a", padding: "2px 0 2px 10px" }}>
                    <p style={{ margin: 0, color: "#808080", fontSize: 11, fontStyle: "italic" }}>Drag tasks here, or use + to add</p>
                  </div>
                ) : <TaskList tasks={shortHigh} onComplete={completeTask} onEdit={editTask} onOpen={setOpenProjectId} />}
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
                  flex: 1, overflowY: "auto", scrollbarWidth: "none", borderRadius: 2, outlineOffset: -2,
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
                ) : <TaskList tasks={shortNormal} onComplete={completeTask} onEdit={editTask} onOpen={setOpenProjectId} />}
              </div>
              <AddTaskInput ref={shortAddRef} onAdd={(title) => addTask(title, "Short Term")} />
            </Panel>
          </div>

          {/* right side of the middle column: Long Term (top) with Up Next stacked under it */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <Panel style={{ flex: 1.6, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader label="Long Term" right={
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
                  flex: 1, overflowY: "auto", scrollbarWidth: "none", borderRadius: 2, outlineOffset: -2,
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
                    onOpen={setOpenProjectId}
                    onHover={(id, rect) => setHover({ id, rect })}
                    onLeave={() => setHover(null)}
                    onMerge={mergeInto}
                  />
                )}
              </div>
              <AddTaskInput ref={longAddRef} onAdd={addProject} placeholder="New project..." />
            </Panel>

            <Panel style={{ flex: 0.6, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader label="Up Next" right={<Tag>SCHEDULE</Tag>} />
              <div
                onClick={(e) => { if (e.target === e.currentTarget) scheduleAddRef.current?.open(); }}
                style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
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
          </div>
        </div>

        {/* Right column - Gmail + Spotify */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
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
                  <EmailRow key={email.id} email={email} onArchive={archiveEmail} onOpen={(e) => setOpenEmail({ source: "gmail", email: e })} />
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
                      {nowPlaying.playing ? nowPlaying.track || "—" : <span style={{ color: "#808080" }}>Not playing</span>}
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
              <Tag>APHORISMO</Tag>
              <span style={{ color: "#222" }}>|</span>
              <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", fontStyle: "italic", minWidth: 0 }}>
                {aphorismo}
              </p>
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

      {hoverProject && <HoverPopover project={hoverProject} rect={hover!.rect} />}

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
        />
      )}

      {openEmail && (
        <EmailReader source={openEmail.source} email={openEmail.email} onClose={() => setOpenEmail(null)} />
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
                }}>Undo</button>
              )}
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
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