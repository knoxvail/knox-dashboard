"use client";

import { useEffect, useState, useCallback } from "react";

type Headline = { title: string; link: string; date: string };
type Task = { id: string; title: string };
type Verse = { ref: string; text: string };

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

export default function Dashboard() {
  const clock = useClock();
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, tRes, vRes] = await Promise.all([
        fetch("/api/wsj"),
        fetch("/api/notion"),
        fetch("/api/verse"),
      ]);
      const [hData, tData, vData] = await Promise.all([
        hRes.json(),
        tRes.json(),
        vRes.json(),
      ]);
      setHeadlines(hData.headlines || []);
      setTasks(tData.tasks || []);
      setVerse(vData);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="grid-bg min-h-screen w-screen overflow-hidden relative flex flex-col" style={{ background: "#080c10" }}>
      {/* Scan line */}
      <div className="scan-line" />

      {/* Ambient glow top */}
      <div style={{
        position: "fixed", top: 0, left: "20%", right: "20%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)",
        zIndex: 10
      }} />

      {/* Header bar */}
      <header className="flex items-center justify-between px-8 pt-6 pb-0 fade-in fade-in-delay-1">
        <div className="flex items-center gap-4">
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#00d4ff",
            boxShadow: "0 0 8px #00d4ff, 0 0 16px rgba(0,212,255,0.4)"
          }} />
          <span className="tag" style={{ opacity: 1, fontSize: 10 }}>KNOX // COMMAND CENTER</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="tag">{clock.day}</span>
          <span className="tag" style={{ opacity: 0.5 }}>{clock.date}</span>
          <div style={{
            width: 1, height: 16,
            background: "linear-gradient(180deg, transparent, #1a2332, transparent)"
          }} />
          <button onClick={fetchAll} className="tag" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#00d4ff", opacity: 0.5, transition: "opacity 0.2s",
            padding: 0
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
          >
            REFRESH
          </button>
        </div>
      </header>

      {/* Clock */}
      <div className="flex flex-col items-center justify-center py-6 fade-in fade-in-delay-1">
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: "clamp(72px, 10vw, 120px)",
          fontWeight: 300,
          letterSpacing: "0.06em",
          color: "#e8f4ff",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(0,212,255,0.12)",
          display: "flex",
          alignItems: "center",
          gap: "0.05em"
        }}>
          <span>{clock.h}</span>
          <span style={{ color: "#1a3a4a", fontWeight: 200 }}>:</span>
          <span>{clock.m}</span>
          <span style={{ color: "#1a3a4a", fontWeight: 200 }}>:</span>
          <span style={{ color: "#3a6070", fontSize: "0.5em", alignSelf: "flex-end", paddingBottom: "0.15em" }}>{clock.s}</span>
        </div>
      </div>

      {/* Main grid */}
      <main className="flex-1 grid px-8 pb-8 gap-4" style={{
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "1fr auto",
        minHeight: 0,
      }}>

        {/* WSJ Headlines */}
        <section className="hud-border corner-tl panel-glow fade-in fade-in-delay-2 flex flex-col"
          style={{ background: "#0d1117", padding: "20px 24px", overflow: "hidden" }}>
          <div className="flex items-center justify-between mb-5">
            <span className="tag" style={{ opacity: 1 }}>WALL STREET JOURNAL</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#00d4ff", boxShadow: "0 0 6px #00d4ff" }} />
              <span className="tag" style={{ color: "#607080" }}>LIVE</span>
            </div>
          </div>

          <div className="flex flex-col gap-0 flex-1 overflow-auto" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="headline-item py-3" style={{ opacity: 0.2 + i * 0.05 }}>
                  <div style={{ height: 10, background: "#1a2332", borderRadius: 2, marginBottom: 6, width: `${85 - i * 8}%` }} />
                  <div style={{ height: 8, background: "#1a2332", borderRadius: 2, width: "30%" }} />
                </div>
              ))
            ) : headlines.length === 0 ? (
              <p style={{ color: "#3a4a5c", fontSize: 12 }}>No headlines available</p>
            ) : headlines.map((h, i) => (
              <a key={i} href={h.link} target="_blank" rel="noopener noreferrer"
                className="headline-item py-3 block"
                style={{ textDecoration: "none" }}>
                <p className="headline-text" style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#a0b8c8",
                  lineHeight: 1.5,
                  margin: 0,
                  transition: "color 0.2s"
                }}>{h.title}</p>
                {h.date && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a4a5c", letterSpacing: "0.1em" }}>
                    {h.date}
                  </span>
                )}
              </a>
            ))}
          </div>
        </section>

        {/* Notion Tasks */}
        <section className="hud-border corner-tl panel-glow fade-in fade-in-delay-3 flex flex-col"
          style={{ background: "#0d1117", padding: "20px 24px", overflow: "hidden" }}>
          <div className="flex items-center justify-between mb-5">
            <span className="tag" style={{ opacity: 1 }}>OPEN TASKS</span>
            <span className="tag" style={{ color: "#607080" }}>NOTION</span>
          </div>

          <div className="flex flex-col gap-3 flex-1 overflow-auto" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="task-item pl-3 py-1" style={{ opacity: 0.3 }}>
                  <div style={{ height: 10, background: "#1a2332", borderRadius: 2, width: `${70 - i * 10}%` }} />
                </div>
              ))
            ) : tasks.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                <p style={{ color: "#3a4a5c", fontSize: 12, textAlign: "center" }}>
                  No open tasks —<br />
                  <span style={{ color: "#1a3a4a", fontSize: 11 }}>configure NOTION_TOKEN + NOTION_DB_ID</span>
                </p>
              </div>
            ) : tasks.map((t, i) => (
              <div key={t.id} className="task-item pl-3 py-1 transition-all" style={{ animationDelay: `${i * 0.06}s` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    border: "1px solid #1a3a4a",
                    flexShrink: 0,
                    marginTop: 4,
                    transition: "border-color 0.2s"
                  }} />
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: "#8aa0b0",
                    margin: 0,
                    lineHeight: 1.5,
                    fontWeight: 400,
                  }}>{t.title}</p>
                </div>
              </div>
            ))}
          </div>

          {tasks.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #1a2332" }}>
              <span className="tag" style={{ color: "#3a4a5c" }}>{tasks.length} ITEM{tasks.length !== 1 ? "S" : ""} REMAINING</span>
            </div>
          )}
        </section>

        {/* Bible Verse */}
        <section className="hud-border corner-tl panel-glow fade-in fade-in-delay-4 flex flex-col justify-between"
          style={{ background: "#0d1117", padding: "20px 24px" }}>
          <div className="flex items-center justify-between mb-5">
            <span className="tag" style={{ opacity: 1 }}>DAILY WORD</span>
            <span className="tag" style={{ color: "#607080" }}>ESV</span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {loading || !verse ? (
              <div>
                <div style={{ height: 10, background: "#1a2332", borderRadius: 2, marginBottom: 10, width: "90%" }} />
                <div style={{ height: 10, background: "#1a2332", borderRadius: 2, marginBottom: 10, width: "75%" }} />
                <div style={{ height: 10, background: "#1a2332", borderRadius: 2, width: "60%" }} />
              </div>
            ) : (
              <>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 300,
                  color: "#8aa0b0",
                  lineHeight: 1.8,
                  margin: 0,
                  fontStyle: "italic",
                }}>
                  &ldquo;{verse.text}&rdquo;
                </p>
              </>
            )}
          </div>

          {verse && (
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #1a2332", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                color: "#00d4ff",
                letterSpacing: "0.06em",
                textShadow: "0 0 12px rgba(0,212,255,0.3)"
              }}>{verse.ref}</span>
              <div style={{ display: "flex", gap: 3 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: "#1a2332" }} />
                ))}
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="px-8 pb-4 flex items-center justify-between fade-in fade-in-delay-4">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {[
            { label: "WSJ", color: headlines.length > 0 ? "#00d4ff" : "#3a4a5c" },
            { label: "NOTION", color: tasks.length > 0 ? "#00d4ff" : "#3a4a5c" },
            { label: "VERSE", color: verse ? "#00d4ff" : "#3a4a5c" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 3, height: 3, borderRadius: "50%", background: s.color }} />
              <span className="tag" style={{ color: "#3a4a5c", fontSize: 8 }}>{s.label}</span>
            </div>
          ))}
        </div>
        <span className="tag" style={{ color: "#1a2332", fontSize: 8 }}>
          SYS.OK // AUTO-REFRESH 15MIN
        </span>
      </footer>
    </div>
  );
}
