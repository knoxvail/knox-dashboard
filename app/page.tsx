"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Headline = { title: string; link: string; date: string };
type Task = { id: string; title: string };
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

    const move = (e: MouseEvent) => {
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
        transition: "color 0.2s, border-color 0.2s, background 0.2s",
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
}: {
  task: Task;
  isEditing: boolean;
  onEdit: (id: string, newTitle: string) => Promise<void>;
  onComplete: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
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
      style={{
        borderLeft: "1px solid #2a2a2a",
        paddingLeft: 10,
        transition: "border-color 0.2s, padding-left 0.2s",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
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
          onClick={() => onStartEdit(task.id)}
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

function TaskList({ tasks, onComplete, onEdit }: { tasks: Task[]; onComplete: (id: string) => void; onEdit: (id: string, newTitle: string) => Promise<void> }) {
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
        />
      ))}
    </>
  );
}

function AddTaskInput({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
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
        placeholder="New task..."
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

function Dashboard() {
  const clock = useClock();
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [shortTerm, setShortTerm] = useState<Task[]>([]);
  const [longTerm, setLongTerm] = useState<Task[]>([]);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [allVerses, setAllVerses] = useState<Verse[]>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const [aphorismo, setAphorismo] = useState<string | null>(null);
  const [aphorismoLoading, setAphorismoLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>({ connected: false });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [volume, setVolume] = useState(50);
  const [loading, setLoading] = useState(true);
  const spotifyInterval = useRef<NodeJS.Timeout | null>(null);

  // Each source fetches independently so one slow endpoint (e.g. the external
  // headlines feed) never blocks the others — no single-dependency bottleneck.
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/notion");
      const data = await res.json();
      setShortTerm(data.shortTerm || []);
      setLongTerm(data.longTerm || []);
    } catch {}
  }, []);

  const fetchHeadlines = useCallback(async () => {
    try {
      const res = await fetch("/api/wsj");
      const data = await res.json();
      setHeadlines(data.headlines || []);
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
    fetchHeadlines();
    fetchVerse();
    fetchAphorismo();
  }, [fetchTasks, fetchHeadlines, fetchVerse, fetchAphorismo]);

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
    fetchSchedule();
  }, [fetchStatic, fetchSpotify, fetchGmail, fetchSchedule]);

  useEffect(() => {
    spotifyInterval.current = setInterval(fetchSpotify, 10000);
    return () => { if (spotifyInterval.current) clearInterval(spotifyInterval.current); };
  }, [fetchSpotify]);

  const completeTask = async (id: string) => {
    // optimistic: drop it from the UI immediately
    setShortTerm(prev => prev.filter(t => t.id !== id));
    setLongTerm(prev => prev.filter(t => t.id !== id));
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

    // API call
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: newTitle, action: "update" }),
      });
      if (!res.ok) {
        await fetchStatic(); // Revert on error
      }
    } catch {
      await fetchStatic(); // Revert on error
    }
  };

  const addTask = async (title: string, status: "Short Term" | "Long Term") => {
    // optimistic: show the task right away with a temporary id
    const tempId = `temp-${Date.now()}`;
    const setList = status === "Short Term" ? setShortTerm : setLongTerm;
    setList(prev => [...prev, { id: tempId, title }]);
    try {
      const res = await fetch("/api/notion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status }),
      });
      if (!res.ok) {
        setList(prev => prev.filter(t => t.id !== tempId)); // roll back on failure
        return;
      }
    } catch {
      setList(prev => prev.filter(t => t.id !== tempId));
      return;
    }
    fetchTasks(); // reconcile the temp row with the real Notion id
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
          <button onClick={() => { fetchStatic(); fetchGmail(); fetchSpotify(); fetchSchedule(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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

        {/* Left column: WSJ + Up Next */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Wall Street Journal" right={
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#999" }} />
                <Tag>LIVE</Tag>
              </div>
            } />
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #1e1e1e", padding: "10px 0" }}>
                    <div style={{ height: 8, background: "#1e1e1e", borderRadius: 2, marginBottom: 5, width: `${88 - i * 7}%` }} />
                  </div>
                ))
              ) : headlines.map((h, i) => (
                <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", borderBottom: "1px solid #1e1e1e", padding: "9px 0", transition: "border-color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "#555")}
                  onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1e1e1e")}
                >
                  <p style={{ margin: 0, fontSize: 12, color: "#909090", lineHeight: 1.5, fontWeight: 400, transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ddd")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#909090")}
                  >{h.title}</p>
                  {h.date && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#444", letterSpacing: "0.1em" }}>{h.date}</span>}
                </a>
              ))}
            </div>
          </Panel>

          <Panel style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Up Next" right={<Tag>SCHEDULE</Tag>} />
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              {events.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 20 }}>
                  <p style={{ color: "#444", fontSize: 12 }}>Nothing scheduled</p>
                </div>
              ) : events.map((event) => (
                <div key={event.id} style={{ borderBottom: "1px solid #1e1e1e", padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#b0b0b0", lineHeight: 1.4 }}>{event.title}</p>
                    {event.type && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#555", flexShrink: 0, marginLeft: 6 }}>{event.type.toUpperCase()}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#666" }}>{event.displayDate}</span>
                    {event.displayTime && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555" }}>{event.displayTime}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Tasks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>
          <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Short Term" right={
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555" }}>
                {shortTerm.length}
              </span>
            } />
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, marginBottom: 8 }}>
                    <div style={{ height: 9, background: "#1e1e1e", borderRadius: 2, width: `${75 - i * 8}%` }} />
                  </div>
                ))
              ) : <TaskList tasks={shortTerm} onComplete={completeTask} onEdit={editTask} />}
            </div>
            <AddTaskInput onAdd={(title) => addTask(title, "Short Term")} />
          </Panel>

          <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Long Term" right={
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#555" }}>
                {longTerm.length}
              </span>
            } />
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ borderLeft: "1px solid #2a2a2a", paddingLeft: 10, marginBottom: 8 }}>
                    <div style={{ height: 9, background: "#1e1e1e", borderRadius: 2, width: `${75 - i * 8}%` }} />
                  </div>
                ))
              ) : <TaskList tasks={longTerm} onComplete={completeTask} onEdit={editTask} />}
            </div>
            <AddTaskInput onAdd={(title) => addTask(title, "Long Term")} />
          </Panel>
        </div>

        {/* Right column - Gmail + Spotify */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <Panel style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Inbox" right={<Tag>GMAIL</Tag>} />
            {!gmailConnected ? (
              <ConnectButton href="/api/gmail/login" label="CONNECT GMAIL" />
            ) : emails.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#444", fontSize: 12 }}>No emails</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {emails.map((email) => (
                  <div key={email.id} style={{ borderBottom: "1px solid #1e1e1e", padding: "9px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, transition: "border-color 0.2s" }}
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
                    <DoneButton onClick={() => archiveEmail(email.id)} />
                  </div>
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
        {/* Left side - Aphorismo */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0,
          background: "rgba(12,14,18,0.5)",
          backdropFilter: "blur(7px)",
          WebkitBackdropFilter: "blur(7px)",
          border: "1px solid #2a2a2a",
          padding: "10px 14px",
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

        {/* Right side - Daily Word */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, minWidth: 0,
          background: "rgba(12,14,18,0.5)",
          backdropFilter: "blur(7px)",
          WebkitBackdropFilter: "blur(7px)",
          border: "1px solid #2a2a2a",
          padding: "10px 14px",
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