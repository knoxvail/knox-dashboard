"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

type Task = { id: string; title: string };
type ChecklistItem = { id: string; text: string; checked: boolean }; // id = Notion BLOCK id
type Project = { id: string; title: string; items: ChecklistItem[] }; // id = Notion PAGE id
type Verse = { ref: string; text: string };
type Email = { id: string; from: string; subject: string; date: string; link: string };
type Event = { id: string; title: string; displayDate: string; displayTime: string; type: string };
type NowPlaying = {
  connected: boolean; expired?: boolean; playing?: boolean;
  track?: string; artist?: string; album?: string;
  albumArt?: string; progress?: number; duration?: number;
};
type Playlist = { id: string; name: string; uri: string; image?: string };

// Black-and-white reticle cursor (Destiny-style): a dot that tracks the pointer
// exactly, plus a ring that eases in close behind it. Hides when the pointer
// leaves the window.
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    let mx = -100, my = -100;   // live cursor target
    let rx = -100, ry = -100;   // ring's eased position
    let shown = false;
    let raf = 0;

    const setShown = (v: boolean) => {
      if (shown === v) return;
      shown = v;
      const o = v ? "1" : "0";
      if (dotRef.current) dotRef.current.style.opacity = o;
      if (ringRef.current) ringRef.current.style.opacity = o;
    };

    const move = (e: MouseEvent | DragEvent) => {
      mx = e.clientX; my = e.clientY;
      setShown(true);
      // the dot tracks the cursor exactly — written straight to the DOM
      const d = dotRef.current;
      if (d) d.style.transform = `translate3d(${mx}px,${my}px,0) translate(-50%,-50%)`;
    };
    // hide whenever the pointer leaves the page or the window loses focus
    const out = (e: MouseEvent) => { if (!e.relatedTarget) setShown(false); };
    const leaveDoc = () => setShown(false);
    const blur = () => setShown(false);
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      setHovering(t.tagName === "BUTTON" || t.tagName === "A" || !!t.closest("button") || !!t.closest("a"));
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("dragover", move, { passive: true }); // keep the dot tracking while dragging
    window.addEventListener("mouseover", over, { passive: true });
    window.addEventListener("mouseout", out, { passive: true });
    document.addEventListener("mouseleave", leaveDoc);
    window.addEventListener("blur", blur);

    // the ring eases toward the cursor each frame — close follow, gentle lag
    const loop = () => {
      rx += (mx - rx) * 0.35;
      ry += (my - ry) * 0.35;
      const r = ringRef.current;
      if (r) r.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("dragover", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("mouseout", out);
      document.removeEventListener("mouseleave", leaveDoc);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const ringSize = hovering ? 38 : 26;

  // transforms are written imperatively above, so they're intentionally absent
  // from these style objects (re-renders must not clobber the live positions)
  return (
    <>
      <div ref={ringRef} style={{
        position: "fixed", top: 0, left: 0,
        width: ringSize, height: ringSize, borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,0.85)",
        boxShadow: "0 0 3px rgba(0,0,0,0.55)",
        pointerEvents: "none", zIndex: 99999, opacity: 0,
        willChange: "transform",
        transition: "opacity 0.2s, width 0.18s ease, height 0.18s ease",
      }} />
      <div ref={dotRef} style={{
        position: "fixed", top: 0, left: 0,
        width: 5, height: 5, borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 0 3px rgba(0,0,0,0.7)",
        pointerEvents: "none", zIndex: 99999, opacity: 0,
        willChange: "transform",
        transition: "opacity 0.2s",
      }} />
    </>
  );
}

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
      { offset: 0, amplitude: 46, frequency: 0.003, color: "rgb(222,232,248)", opacity: 0.17 },
      { offset: Math.PI / 2, amplitude: 60, frequency: 0.0026, color: "rgb(190,206,230)", opacity: 0.14 },
      { offset: Math.PI, amplitude: 38, frequency: 0.0034, color: "rgb(164,182,210)", opacity: 0.12 },
      { offset: Math.PI * 1.5, amplitude: 52, frequency: 0.0022, color: "rgb(146,166,198)", opacity: 0.10 },
      { offset: Math.PI * 2, amplitude: 34, frequency: 0.004, color: "rgb(204,216,238)", opacity: 0.085 },
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

// One email line with an archive checkmark — shared by both inbox panels.
function EmailRow({ email, onArchive }: { email: Email; onArchive: (id: string) => void }) {
  return (
    <div className="reveal-row" style={{ borderBottom: "1px solid #1e1e1e", padding: "9px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, transition: "border-color 0.2s" }}
      onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "#555")}
      onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1e1e1e")}
    >
      <a href={email.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
          <span style={{ fontSize: 12, color: "#d8d8d8", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{email.from}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#444", flexShrink: 0 }}>{email.date}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#808080", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.subject}</p>
      </a>
      <DoneButton onClick={() => onArchive(email.id)} />
    </div>
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
      color: accent ? "#e8e8e8" : "#707070",
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
      <Tag accent>{label}</Tag>
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
      }}
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
      <p style={{ color: "#444", fontSize: 12, textAlign: "center" }}>None</p>
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

function AddTaskInput({ onAdd, placeholder = "New task..." }: { onAdd: (title: string) => Promise<void>; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

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
    <button onClick={() => setOpen(true)} style={{
      background: "none", border: "none", cursor: "pointer",
      padding: 0, marginTop: 10, display: "flex", alignItems: "center", gap: 6,
    }}
      onMouseEnter={e => (e.currentTarget.querySelector("span")!.style.color = "#888")}
      onMouseLeave={e => (e.currentTarget.querySelector("span")!.style.color = "#444")}
    >
      <span style={{ color: "#444", fontSize: 16, lineHeight: 1, transition: "color 0.2s" }}>+</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#444", textTransform: "uppercase" as const, transition: "color 0.2s" }}>ADD NEW</span>
    </button>
  );

  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }}
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
      <button onClick={() => { setOpen(false); setValue(""); }} style={{
        background: "none", border: "none", color: "#555",
        fontSize: 14, cursor: "pointer", padding: "0 4px",
      }}>✕</button>
    </div>
  );
}

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

  return (
    <div
      draggable
      tabIndex={0}
      onDragStart={(e) => {
        dragging.current = true;
        e.dataTransfer.setData("text/plain", project.id);
        e.dataTransfer.effectAllowed = "move";
        onLeave();
      }}
      onDragEnd={() => { setTimeout(() => { dragging.current = false; }, 0); setDropTarget(false); }}
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
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        onLeave();
        e.currentTarget.style.borderColor = dropTarget ? "#9a9a9a" : "#2a2a2a";
        e.currentTarget.style.background = dropTarget ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      style={{
        background: dropTarget ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
        border: dropTarget ? "1px solid #9a9a9a" : "1px solid #2a2a2a",
        borderRadius: 4,
        padding: "14px 15px 12px",
        minHeight: 88,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 6,
        transition: "border-color 0.2s, background 0.2s, transform 0.2s",
      }}
    >
      <span style={{
        fontSize: 13, color: "#cfcfcf", fontFamily: "'DM Sans', sans-serif",
        lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{project.title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }} aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 9, height: 1, background: "#444" }} />)}
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          letterSpacing: "0.12em", color: "#555",
        }}>{label}</span>
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
      <p style={{ color: "#444", fontSize: 12, textAlign: "center" }}>None</p>
    </div>
  );
  // paddingTop gives the top row's hover-lift room so its top edge isn't clipped
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 10, paddingTop: 3 }}>
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
        color: "#666", textTransform: "uppercase", marginBottom: items.length ? 8 : 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{project.title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#555" }}>Empty</div>
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
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#555", marginTop: 2 }}>+{items.length - 6} MORE</div>
          )}
        </>
      )}
    </div>
  );
}

// Click-to-open editor for a project's checklist. Portalled to document.body so
// the panel's overflow/backdrop-filter stacking context can't clip it.
function ProjectModal({ project, onClose, onAddItem, onToggleItem, onDeleteItem, onEditTitle, onArchive }: {
  project: Project;
  onClose: () => void;
  onAddItem: (projectId: string, text: string) => void;
  onToggleItem: (projectId: string, itemId: string, checked: boolean) => void;
  onDeleteItem: (projectId: string, itemId: string) => void;
  onEditTitle: (id: string, title: string) => Promise<void>;
  onArchive: (id: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(project.title);
  const [newItem, setNewItem] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const isTemp = project.id.startsWith("temp-");

  useEffect(() => { setTitleValue(project.title); }, [project.title]);
  useEffect(() => {
    // Escape closes the modal, but not while renaming (that Escape cancels the edit)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !editingTitle) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editingTitle]);
  useEffect(() => { if (!isTemp) setTimeout(() => addRef.current?.focus(), 60); }, [isTemp]);

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
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{
        width: "min(440px, 92vw)", maxHeight: "78vh",
        background: "rgba(12,14,18,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: "1px solid #3a3a3a", borderRadius: 6, padding: "20px 22px",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.7)", position: "relative",
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
              onClick={() => !isTemp && setEditingTitle(true)}
              style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "#e8e8e8", lineHeight: 1.3, cursor: isTemp ? "default" : "pointer", flex: 1, minWidth: 0, wordBreak: "break-word" }}
            >{project.title}</h2>
          )}
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", color: "#666",
            fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0, transition: "color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >✕</button>
        </div>

        {/* checklist items */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", minHeight: 40 }}>
          {project.items.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
              <p style={{ color: "#444", fontSize: 12 }}>No items yet</p>
            </div>
          ) : project.items.map((it) => {
            const temp = it.id.startsWith("temp-");
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "1px solid #1e1e1e" }}
                onMouseEnter={(e) => { const x = e.currentTarget.querySelector("[data-del]") as HTMLElement | null; if (x) x.style.opacity = "1"; }}
                onMouseLeave={(e) => { const x = e.currentTarget.querySelector("[data-del]") as HTMLElement | null; if (x) x.style.opacity = "0"; }}
              >
                <button
                  disabled={temp}
                  onClick={() => onToggleItem(project.id, it.id, !it.checked)}
                  style={{
                    width: 18, height: 18, flexShrink: 0, marginTop: 1,
                    background: it.checked ? "#2a2a2a" : "#1e1e1e",
                    border: "1px solid #505050", borderRadius: 3,
                    color: "#fff", fontSize: 11, lineHeight: 1, cursor: temp ? "default" : "pointer",
                    opacity: temp ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >{it.checked ? "✓" : ""}</button>
                <span style={{
                  flex: 1, fontSize: 13, color: it.checked ? "#555" : "#b0b0b0",
                  textDecoration: it.checked ? "line-through" : "none", lineHeight: 1.4, minWidth: 0, wordBreak: "break-word",
                }}>{it.text || "Untitled"}</span>
                <button
                  data-del
                  disabled={temp}
                  onClick={() => onDeleteItem(project.id, it.id)}
                  style={{
                    background: "none", border: "none", cursor: temp ? "default" : "pointer",
                    color: "#555", fontSize: 13, lineHeight: 1, padding: "0 2px", flexShrink: 0,
                    opacity: 0, transition: "opacity 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#999")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >✕</button>
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

        {/* archive whole project */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => onArchive(project.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em",
            color: "#444", textTransform: "uppercase", padding: 0, transition: "color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#c06464")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
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
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const spotifyInterval = useRef<NodeJS.Timeout | null>(null);

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
      if (!res.ok) await fetchTasks(); // revert just the tasks on failure
    } catch {
      await fetchTasks();
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
      }
    } catch {
      await fetchTasks(); // revert just the task lists
    }
  };

  // Short Term tasks and Clients differ in shape (Short Term carries a checklist,
  // Clients don't), so add to the right list with the right shape.
  const addTask = async (title: string, status: "Short Term" | "Clients") => {
    const tempId = `temp-${Date.now()}`;
    if (status === "Short Term") setShortTerm(prev => [...prev, { id: tempId, title, items: [] }]);
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
      if (!res.ok) { rollback(); return; }
      // swap the temp id for the real page id in place (no reconcile GET)
      if (data.id) swap(data.id);
      else fetchTasks();
    } catch {
      rollback();
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

  const toggleChecklistItem = async (projectId: string, itemId: string, checked: boolean) => {
    if (itemId.startsWith("temp-")) return; // block doesn't exist yet
    patchProject(projectId, p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, checked } : it) }));
    const revert = () => patchProject(projectId, p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, checked: !checked } : it) }));
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleChecklistItem", itemId, checked }),
      });
      if (!res.ok) revert();
    } catch {
      revert();
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

  // Merge one movable item INTO a bucket: its title (and its own checklist items)
  // become checklist items in the target, and the source page is archived.
  const mergeInto = async (targetId: string, sourceId: string) => {
    setDragOver(null);
    if (!sourceId || sourceId === targetId) return;
    if (targetId.startsWith("temp-") || sourceId.startsWith("temp-")) return;
    const source = findProject(sourceId);
    if (!source) return;

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

    try {
      await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mergeInto", targetId, sourceId,
          title: source.title, items: source.items.map(it => ({ text: it.text, checked: it.checked })),
        }),
      });
    } catch {}
    // reconcile: swaps temp item ids for real block ids and confirms the source
    // is gone (or restores the true state if the merge failed)
    await fetchTasks();
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
      if (!res.ok) await fetchTasks(); // revert on failure
    } catch {
      await fetchTasks();
    }
  };

  const archiveEmail = async (id: string) => {
    setEmails(prev => prev.filter(e => e.id !== id));
    await fetch("/api/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchGmail();
  };

  const archiveSorenEmail = async (id: string) => {
    setSorenEmails(prev => prev.filter(e => e.id !== id));
    await fetch("/api/zoho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchSoren();
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
      cursor: "none",
    }}>
      <GlowyWaves />
      <CustomCursor />
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        animation: "scan 12s linear infinite", zIndex: 100, pointerEvents: "none",
      }} />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", position: "relative", zIndex: 1 }}>
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
                <p style={{ color: "#444", fontSize: 11, textAlign: "center", lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                  ZOHO NOT CONNECTED — SET ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN IN VERCEL
                </p>
              </div>
            ) : sorenEmails.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#444", fontSize: 12 }}>No emails</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {sorenEmails.map((email) => (
                  <EmailRow key={email.id} email={email} onArchive={archiveSorenEmail} />
                ))}
              </div>
            )}
          </Panel>

          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PanelHeader label="Clients" right={
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555" }}>
                {clients.length}
              </span>
            } />
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, marginBottom: 8 }}>
                    <div style={{ height: 9, background: "#1e1e1e", borderRadius: 2, width: `${75 - i * 10}%` }} />
                  </div>
                ))
              ) : <TaskList tasks={clients} onComplete={completeTask} onEdit={editTask} />}
            </div>
            <AddTaskInput onAdd={(title) => addTask(title, "Clients")} />
          </Panel>
        </div>

        {/* Tasks — Short Term stays tall but skinny; the buckets get the width */}
        <div style={{ display: "grid", gridTemplateColumns: "0.5fr 1fr", gap: 12, minHeight: 0 }}>
          <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Short Term" right={
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555" }}>
                {shortTerm.length}
              </span>
            } />
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== "Short Term") setDragOver("Short Term"); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOver(null); if (id) moveTask(id, "Short Term"); }}
              style={{
                flex: 1, overflowY: "auto", scrollbarWidth: "none", borderRadius: 2, outlineOffset: -2,
                outline: dragOver === "Short Term" ? "1px dashed #6a6a6a" : "1px dashed transparent",
                background: dragOver === "Short Term" ? "rgba(255,255,255,0.025)" : "transparent",
                transition: "background 0.15s, outline-color 0.15s",
              }}
            >
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, marginBottom: 8 }}>
                    <div style={{ height: 9, background: "#1e1e1e", borderRadius: 2, width: `${75 - i * 8}%` }} />
                  </div>
                ))
              ) : <TaskList tasks={shortTerm} onComplete={completeTask} onEdit={editTask} onOpen={setOpenProjectId} />}
            </div>
            <AddTaskInput onAdd={(title) => addTask(title, "Short Term")} />
          </Panel>

          {/* right side of the middle column: Long Term (top) with Up Next stacked under it */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <Panel style={{ flex: 1.6, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader label="Long Term" right={
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555" }}>
                  {longTerm.length}
                </span>
              } />
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== "Long Term") setDragOver("Long Term"); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOver(null); if (id) moveTask(id, "Long Term"); }}
                style={{
                  flex: 1, overflowY: "auto", scrollbarWidth: "none", borderRadius: 2, outlineOffset: -2,
                  outline: dragOver === "Long Term" ? "1px dashed #6a6a6a" : "1px dashed transparent",
                  background: dragOver === "Long Term" ? "rgba(255,255,255,0.025)" : "transparent",
                  transition: "background 0.15s, outline-color 0.15s",
                }}
              >
                {loading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 10 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ height: 88, background: "#141414", border: "1px solid #222", borderRadius: 4 }} />
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
              <AddTaskInput onAdd={addProject} placeholder="New project..." />
            </Panel>

            <Panel style={{ flex: 0.6, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <PanelHeader label="Up Next" right={<Tag>SCHEDULE</Tag>} />
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {events.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 20 }}>
                    <p style={{ color: "#444", fontSize: 12 }}>Nothing scheduled</p>
                  </div>
                ) : (
                  // grid stretches the events across the panel's full width; each
                  // event still reads top-to-bottom (title, date, time, type)
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "14px 18px", paddingBottom: 2 }}>
                    {events.map((event) => (
                      <div key={event.id} style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#b0b0b0", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.title}</p>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#666", letterSpacing: "0.05em" }}>{event.displayDate}</span>
                        {event.displayTime && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.05em" }}>{event.displayTime}</span>}
                        {event.type && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#555", letterSpacing: "0.12em" }}>{event.type.toUpperCase()}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                <p style={{ color: "#444", fontSize: 12 }}>No emails</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {emails.map((email) => (
                  <EmailRow key={email.id} email={email} onArchive={archiveEmail} />
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
                    <img src={nowPlaying.albumArt} alt="album" style={{ width: 44, height: 44, objectFit: "cover", border: "1px solid #2a2a2a", flexShrink: 0, filter: "grayscale(100%)" }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#e0e0e0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {nowPlaying.playing ? nowPlaying.track || "—" : <span style={{ color: "#444" }}>Not playing</span>}
                    </p>
                    {nowPlaying.artist && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#777", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nowPlaying.artist}</p>}
                  </div>
                </div>
                {nowPlaying.playing && (
                  <div style={{ height: 1, background: "#1e1e1e", borderRadius: 1, margin: "8px 0" }}>
                    <div style={{ height: "100%", width: `${progressPct}%`, background: "#888", transition: "width 1s linear" }} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                  {[
                    { action: "previous", label: "⏮" },
                    { action: nowPlaying.playing ? "pause" : "play", label: nowPlaying.playing ? "⏸" : "▶" },
                    { action: "next", label: "⏭" },
                  ].map(btn => (
                    <button key={btn.action} onClick={() => spotifyAction(btn.action)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#777", fontSize: 14, padding: "4px 8px", transition: "color 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ddd")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#777")}
                    >{btn.label}</button>
                  ))}
                </div>
                {/* Volume slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#444" }}>VOL</span>
                  <input
                    type="range" min={0} max={100} value={volume}
                    onChange={e => setSpotifyVolume(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "#888", cursor: "pointer", height: 2 }}
                  />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#444", width: 24, textAlign: "right" }}>{volume}</span>
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
                style={{
                  background: "none", border: "1px solid #444", cursor: "pointer",
                  color: "#777", fontSize: 11, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.15s", flexShrink: 0,
                  opacity: aphorismoLoading ? 0.5 : 1,
                }}
                onMouseEnter={e => !aphorismoLoading && (e.currentTarget.style.borderColor = "#999", e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => !aphorismoLoading && (e.currentTarget.style.borderColor = "#444", e.currentTarget.style.color = "#777")}
              >⟳</button>
              <Tag>APHORISMO</Tag>
              <span style={{ color: "#222" }}>|</span>
              <p style={{ margin: 0, fontSize: 13, color: "#686868", fontStyle: "italic", minWidth: 0 }}>
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
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#666", fontSize: 12, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "color 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#666")}
              >←</button>
              <div style={{ textAlign: "right", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#686868", fontStyle: "italic" }}>
                  {allVerses[verseIndex]?.text || verse.text}
                </p>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 500,
                  color: "#777", letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  display: "block",
                  marginTop: 4,
                }}>{allVerses[verseIndex]?.ref || verse.ref}</span>
              </div>
              <span style={{ color: "#222" }}>|</span>
              <Tag>DAILY WORD</Tag>
              <button
                onClick={() => setVerseIndex((i) => (i + 1) % allVerses.length)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#666", fontSize: 12, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "color 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#666")}
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
          onClose={() => setOpenProjectId(null)}
          onAddItem={addChecklistItem}
          onToggleItem={toggleChecklistItem}
          onDeleteItem={deleteChecklistItem}
          onEditTitle={editTask}
          onArchive={(id) => { completeTask(id); setOpenProjectId(null); }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes scan {
          0% { transform: translateY(-2px); }
          100% { transform: translateY(100vh); }
        }
        * { box-sizing: border-box; cursor: none !important; }
        body { margin: 0; overflow: hidden; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; }
        /* row action checkmarks reveal only on row hover / keyboard focus */
        .reveal-row .row-action { opacity: 0; }
        .reveal-row:hover .row-action,
        .reveal-row:focus-within .row-action { opacity: 1; }
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

      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
        letterSpacing: "0.2em", textTransform: "uppercase",
        color: error ? "#c06464" : "#666",
        transition: "color 0.2s",
      }}>{error ? "ACCESS DENIED" : "ENTER ACCESS CODE"}</span>

      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
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