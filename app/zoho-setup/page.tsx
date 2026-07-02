"use client";

import { useState } from "react";

// Temporary self-service page: paste a Zoho Self Client grant code, exchange it
// server-side (client secret stays in env), and copy the resulting refresh
// token into Vercel's ZOHO_REFRESH_TOKEN. The token only ever appears in your
// own browser here.
export default function ZohoSetup() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const exchange = async () => {
    setLoading(true);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeCode: code.trim() }),
      });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ error: String(e?.message || e) });
    }
    setLoading(false);
  };

  const copy = async () => {
    if (!result?.refreshToken) return;
    try {
      await navigator.clipboard.writeText(result.refreshToken);
      setCopied(true);
    } catch {}
  };

  const label: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
    letterSpacing: "0.1em", color: "#888", textTransform: "uppercase",
  };
  const boxBase: React.CSSProperties = {
    width: "100%", background: "#141414", border: "1px solid #333",
    color: "#ddd", fontSize: 13, padding: "10px 12px", borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace", outline: "none", boxSizing: "border-box",
  };

  const ok = result?.refreshToken;
  const foldersOk = result?.foldersStatus === 200;
  const writeOk = result?.writeScope === "present";

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#ddd",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ ...label, color: "#e8e8e8" }}>Zoho refresh token setup</div>
          <p style={{ color: "#888", fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Paste your Self Client grant code, click Exchange, then copy the refresh token
            into Vercel&rsquo;s <code style={{ color: "#bbb" }}>ZOHO_REFRESH_TOKEN</code> and redeploy.
            The grant code is single-use and expires in minutes — generate a fresh one right before using this.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={label}>Grant code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) exchange(); }}
            placeholder="1000.xxxxxxxx.yyyyyyyy"
            style={boxBase}
          />
        </div>

        <button
          onClick={exchange}
          disabled={loading || !code.trim()}
          style={{
            background: "#1e1e1e", border: "1px solid #555", color: "#eee",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.15em",
            padding: "10px 20px", borderRadius: 4, cursor: loading || !code.trim() ? "default" : "pointer",
            textTransform: "uppercase", opacity: loading || !code.trim() ? 0.5 : 1, alignSelf: "flex-start",
          }}
        >{loading ? "Exchanging…" : "Exchange"}</button>

        {result && (ok ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            <div style={{ display: "flex", gap: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
              <span style={{ color: foldersOk ? "#7bd88f" : "#e0a04d" }}>
                folders: {String(result.foldersStatus)} {foldersOk ? "✓" : "— missing folders.READ"}
              </span>
              <span style={{ color: writeOk ? "#7bd88f" : "#e0a04d" }}>
                write: {String(result.writeScope)} {writeOk ? "✓" : "— missing messages.ALL"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={label}>Refresh token — copy into Vercel</span>
              <textarea readOnly value={result.refreshToken} rows={3}
                style={{ ...boxBase, resize: "none", color: "#8fd0ff" }}
                onFocus={(e) => e.currentTarget.select()} />
            </div>
            <button onClick={copy} style={{
              background: copied ? "#20361f" : "#1e1e1e", border: `1px solid ${copied ? "#4c7a4a" : "#555"}`,
              color: copied ? "#9fe39b" : "#eee", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              letterSpacing: "0.15em", padding: "10px 20px", borderRadius: 4, cursor: "pointer",
              textTransform: "uppercase", alignSelf: "flex-start",
            }}>{copied ? "Copied ✓" : "Copy refresh token"}</button>
            {(!foldersOk || !writeOk) && (
              <p style={{ color: "#e0a04d", fontSize: 12, lineHeight: 1.6 }}>
                Scopes are incomplete — regenerate the grant code with exactly:
                ZohoMail.accounts.READ, ZohoMail.messages.ALL, ZohoMail.folders.READ
              </p>
            )}
          </div>
        ) : (
          <pre style={{
            background: "#141414", border: "1px solid #3a2a2a", color: "#e0a04d",
            padding: 12, borderRadius: 4, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>{JSON.stringify(result, null, 2)}</pre>
        ))}
      </div>
    </div>
  );
}
