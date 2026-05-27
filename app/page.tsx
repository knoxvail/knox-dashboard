"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Headline = { title: string; link: string; date: string };
type Task = { id: string; title: string };
type Verse = { ref: string; text: string };
type Email = { id: string; from: string; subject: string; date: string; link: string };
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
      fontSize: 9,
      letterSpacing: "0.15em",
      textTransform: "uppercase" as const,
      color: accent ? "#00d4ff" : "#607080",
    }}>{children}</span>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #1a2332",
      position: "relative",
      padding: "18px 20px",
      overflow: "hidden",
      ...style,
    }}>
      <div style={{ position: "absolute", top: -1, left: 16, width: 32, height: 1, background: "#00d4ff" }} />
      <div style={{ position: "absolute", top: -1, left: -1, width: 10, height: 10, borderTop: "1px solid #00d4ff", borderLeft: "1px solid #00d4ff" }} />
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
        border: "1px solid #1a2332", color: "#00d4ff",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
        letterSpacing: "0.15em", textDecoration: "none", textTransform: "uppercase" as const,
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff"; (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.05)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a2332"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >{label}</a>
    </div>
  );
}

export default function Dashboard() {
  const clock = useClock();
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>({ connected: false });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [loading, setLoading] = useState(true);
  const spotifyInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchStatic = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, tRes, vRes] = await Promise.all([
        fetch("/api/wsj"),
        fetch("/api/notion"),
        fetch("/api/verse"),
      ]);
      const [hData, tData, vData] = await Promise.all([hRes.json(), tRes.json(), vRes.json()]);
      setHeadlines(hData.headlines || []);
      setTasks(tData.tasks || []);
      setVerse(vData);
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
  }, [fetchStatic, fetchSpotify, fetchGmail]);

  useEffect(() => {
    spotifyInterval.current = setInterval(fetchSpotify, 10000);
    return () => { if (spotifyInterval.current) clearInterval(spotifyInterval.current); };
  }, [fetchSpotify]);

  const spotifyAction = async (action: string) => {
    await fetch("/api/spotify/now-playing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTimeout(fetchSpotify, 500);
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
      background: "#080c10",
      minHeight: "100vh",
      width: "100vw",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      backgroundImage: "linear-gradient(rgba(0,212,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.015) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.07), transparent)",
        animation: "scan 12s linear infinite", zIndex: 100, pointerEvents: "none",
      }} />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", boxShadow: "0 0 10px #00d4ff" }} />
          <Tag accent>KNOX // COMMAND CENTER</Tag>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Tag>{clock.day}</Tag>
          <Tag>{clock.date}</Tag>
          <button onClick={() => { fetchStatic(); fetchGmail(); fetchSpotify(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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
          color: "#e8f4ff",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(0,212,255,0.1)",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.04em",
        }}>
          <span>{clock.h}</span>
          <span style={{ color: "#1a3a4a", fontWeight: 200 }}>:</span>
          <span>{clock.m}</span>
          <span style={{ color: "#1a3a4a", fontWeight: 200 }}>:</span>
          <span style={{ color: "#2a5060", fontSize: "0.45em", alignSelf: "flex-end", paddingBottom: "0.2em" }}>{clock.s}</span>
        </div>
      </div>

      <main style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        padding: "0 24px",
        minHeight: 0,
      }}>

        <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PanelHeader label="Wall Street Journal" right={
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#00d4ff", boxShadow: "0 0 6px #00d4ff" }} />
              <Tag>LIVE</Tag>
            </div>
          } />
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderBottom: "1px solid #1a2332", padding: "12px 0" }}>
                  <div style={{ height: 9, background: "#1a2332", borderRadius: 2, marginBottom: 6, width: `${88 - i * 7}%` }} />
                  <div style={{ height: 7, background: "#111820", borderRadius: 2, width: "25%" }} />
                </div>
              ))
            ) : headlines.map((h, i) => (
              <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", borderBottom: "1px solid #1a2332", padding: "11px 0", transition: "border-color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "rgba(0,212,255,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1a2332")}
              >
                <p style={{ margin: 0, fontSize: 12.5, color: "#8aa0b8", lineHeight: 1.55, fontWeight: 400, transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#d0e4f0")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#8aa0b8")}
                >{h.title}</p>
                {h.date && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2a3a4a", letterSpacing: "0.1em" }}>{h.date}</span>}
              </a>
            ))}
          </div>
        </Panel>

        <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PanelHeader label="Open Tasks" right={<Tag>NOTION</Tag>} />
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ borderLeft: "1px solid #1a2332", paddingLeft: 12 }}>
                  <div style={{ height: 9, background: "#1a2332", borderRadius: 2, width: `${75 - i * 8}%` }} />
                </div>
              ))
            ) : tasks.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#2a3a4a", fontSize: 12, textAlign: "center" }}>No open tasks</p>
              </div>
            ) : tasks.map((t) => (
              <div key={t.id} style={{ borderLeft: "1px solid #1a2332", paddingLeft: 12, transition: "border-color 0.2s, padding-left 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = "#00d4ff"; (e.currentTarget as HTMLElement).style.paddingLeft = "14px"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = "#1a2332"; (e.currentTarget as HTMLElement).style.paddingLeft = "12px"; }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", border: "1px solid #1a3a4a", flexShrink: 0, marginTop: 5 }} />
                  <p style={{ margin: 0, fontSize: 13, color: "#8aa0b0", lineHeight: 1.5 }}>{t.title}</p>
                </div>
              </div>
            ))}
          </div>
          {tasks.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1a2332" }}>
              <Tag>{tasks.length} ITEM{tasks.length !== 1 ? "S" : ""} REMAINING</Tag>
            </div>
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <Panel style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label="Inbox" right={<Tag>GMAIL</Tag>} />
            {!gmailConnected ? (
              <ConnectButton href="/api/gmail/login" label="CONNECT GMAIL" />
            ) : emails.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#2a3a4a", fontSize: 12 }}>No unread emails</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                {emails.map((email) => (
                  <a key={email.id} href={email.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", borderBottom: "1px solid #1a2332", padding: "10px 0", transition: "border-color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "rgba(0,212,255,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1a2332")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "#d0e4f0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{email.from}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2a3a4a", flexShrink: 0 }}>{email.date}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#607080", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email.subject}</p>
                  </a>
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
                    borderBottom: "1px solid #1a2332", padding: "8px 0", cursor: "pointer", textAlign: "left",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "rgba(0,212,255,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "#1a2332")}
                  >
                    <span style={{ fontSize: 12, color: "#8aa0b0" }}>{p.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {nowPlaying.albumArt && (
                    <img src={nowPlaying.albumArt} alt="album" style={{ width: 44, height: 44, objectFit: "cover", border: "1px solid #1a2332", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#d0e4f0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {nowPlaying.playing ? nowPlaying.track || "—" : <span style={{ color: "#3a4a5c" }}>Not playing</span>}
                    </p>
                    {nowPlaying.artist && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#607080", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nowPlaying.artist}</p>}
                  </div>
                </div>
                {nowPlaying.playing && (
                  <div style={{ height: 1, background: "#1a2332", borderRadius: 1, margin: "8px 0" }}>
                    <div style={{ height: "100%", width: `${progressPct}%`, background: "#00d4ff", transition: "width 1s linear" }} />
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
                      color: "#607080", fontSize: 14, padding: "4px 8px", transition: "color 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#00d4ff")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#607080")}
                    >{btn.label}</button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </main>

      <footer style={{
        padding: "12px 24px 16px",
        borderTop: "1px solid #1a2332",
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}>
        {verse ? (
          <>
            <Tag>DAILY WORD</Tag>
            <span style={{ color: "#1a2332" }}>|</span>
            <p style={{ margin: 0, fontSize: 12, color: "#607080", fontStyle: "italic", maxWidth: 600 }}>
              &ldquo;{verse.text}&rdquo;
            </p>
            <span style={{ color: "#1a2332" }}>|</span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13, fontWeight: 500,
              color: "#00d4ff", letterSpacing: "0.06em",
              textShadow: "0 0 10px rgba(0,212,255,0.25)", whiteSpace: "nowrap",
            }}>{verse.ref}</span>
          </>
        ) : (
          <div style={{ height: 8, width: 300, background: "#1a2332", borderRadius: 2 }} />
        )}
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
        ::-webkit-scrollbar-thumb { background: #1a2332; }
      `}</style>
    </div>
  );
}