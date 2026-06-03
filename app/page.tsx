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
      background: "#111111",
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

export default function Dashboard() {
  const clock = useClock();
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [shortTerm, setShortTerm] = useState<Task[]>([]);
  const [longTerm, setLongTerm] = useState<Task[]>([]);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [allVerses, setAllVerses] = useState<Verse[]>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const [aphorismo, setAphorismo] = useState<string | null>(null);
  const [allAphorisms, setAllAphorisms] = useState<string[]>([]);
  const [aphorismoIndex, setAphorismoIndex] = useState(0);
  const [emails, setEmails] = useState<Email[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>({ connected: false });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [volume, setVolume] = useState(50);
  const [loading, setLoading] = useState(true);
  const spotifyInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchStatic = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, tRes, vRes, aRes] = await Promise.all([
        fetch("/api/wsj"),
        fetch("/api/notion"),
        fetch("/api/verse"),
        fetch("/api/aphorismo"),
      ]);
      const [hData, tData, vData, aData] = await Promise.all([hRes.json(), tRes.json(), vRes.json(), aRes.json()]);
      setHeadlines(hData.headlines || []);
      setShortTerm(tData.shortTerm || []);
      setLongTerm(tData.longTerm || []);
      setVerse(vData.verse || vData); // handle both old and new format
      setAllVerses(vData.allVerses || []);
      setVerseIndex(vData.dayOfYear || 0);
      setAphorismo(aData.aphorismo || null);
      setAllAphorisms(aData.allAphorisms || []);
      setAphorismoIndex(aData.dayOfYear || 0);
    } catch {}
    setLoading(false);
  }, []);

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
    setShortTerm(prev => prev.filter(t => t.id !== id));
    setLongTerm(prev => prev.filter(t => t.id !== id));
    await fetch("/api/notion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "complete" }),
    });
    await fetchStatic();
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
    await fetch("/api/notion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status }),
    });
    await fetchStatic();
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
    }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        animation: "scan 12s linear infinite", zIndex: 100, pointerEvents: "none",
      }} />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px" }}>
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
      }}>
        {/* Left side - Aphorismo */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {aphorismo && allAphorisms.length > 0 ? (
            <>
              <button
                onClick={() => setAphorismoIndex((i) => (i - 1 + allAphorisms.length) % allAphorisms.length)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#666", fontSize: 12, padding: "4px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "color 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#666")}
              >←</button>
              <Tag>APHORISMO</Tag>
              <span style={{ color: "#222" }}>|</span>
              <p style={{ margin: 0, fontSize: 13, color: "#686868", fontStyle: "italic", minWidth: 0 }}>
                &ldquo;{allAphorisms[aphorismoIndex]}&rdquo;
              </p>
              <button
                onClick={() => setAphorismoIndex((i) => (i + 1) % allAphorisms.length)}
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

        <span style={{ color: "#222" }}>|</span>

        {/* Right side - Daily Word */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
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
                  &ldquo;{allVerses[verseIndex]?.text || verse.text}&rdquo;
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes scan {
          0% { transform: translateY(-2px); }
          100% { transform: translateY(100vh); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; }
      `}</style>
    </div>
  );
}