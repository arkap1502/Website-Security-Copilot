"use client";
import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}
function hostOf(u) {
  try { return new URL(u).hostname; } catch { return u.slice(0, 32); }
}
function extractUrl(text) {
  const m = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.[a-z]{2,}(\/[^\s]*)?)/i);
  if (!m) return null;
  let u = m[0];
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

const QUICK_TILES = [
  { icon: "🔍", label: "Scan URL", hint: "Full passive scan", url: "https://example.com" },
  { icon: "🔒", label: "SSL check", hint: "Cert + TLS", url: "https://example.com" },
  { icon: "🧱", label: "Headers", hint: "CSP / HSTS", url: "https://example.com" },
  { icon: "🎣", label: "Phishing test", hint: "Try a bait URL", url: "http://free-prize-login-verify.xyz/login" },
  { icon: "🍪", label: "Cookies", hint: "Secure flags", url: "https://example.com" },
  { icon: "📊", label: "Score", hint: "Grade A–F", url: "https://example.com" },
  { icon: "🛡️", label: "Guard demo", hint: "Auto-block", url: "http://free-prize-login-verify.xyz/login" },
  { icon: "⚡", label: "Quick verdict", hint: "Safe/Harmful", url: "https://example.com" },
];
const SUGGESTIONS = ["Scan a URL", "Is this link safe?", "Fix HSTS header", "Check phishing link", "Explain my score"];

export default function Home() {
  const [guardOn, setGuardOn] = useState(true);
  const [ask, setAsk] = useState("");
  const [mode, setMode] = useState("Quick response");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [history, setHistory] = useState([]);
  const [chats, setChats] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [watched, setWatched] = useState(0);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("wsc-history") || "[]"));
      setChats(JSON.parse(localStorage.getItem("wsc-chats") || "[]"));
      setBlocked(JSON.parse(localStorage.getItem("wsc-blocked") || "[]"));
      setWatched(Number(localStorage.getItem("wsc-watched") || 0));
      setGuardOn(localStorage.getItem("wsc-guard") !== "off");
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("wsc-guard", guardOn ? "on" : "off"); } catch {} }, [guardOn]);

  const greeting = useMemo(timeGreeting, []);

  async function runScan(targetUrl) {
    const url = (targetUrl || "").trim();
    if (!url) return;
    setLoading(true); setErr(""); setData(null);
    try {
      const r = await fetch(`${API}/api/scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const res = await r.json();
      setData(res);
      const entry = { url: res.url, verdict: res.verdict, score: res.score, grade: res.grade, t: Date.now() };
      const h = [entry, ...history].slice(0, 6);
      setHistory(h);
      const w = watched + 1;
      setWatched(w);
      try {
        localStorage.setItem("wsc-history", JSON.stringify(h));
        localStorage.setItem("wsc-watched", String(w));
        if (guardOn && res.verdict !== "safe") {
          const b = [{ url: res.url, reason: res.summary.slice(0, 120), t: Date.now() }, ...blocked].slice(0, 5);
          setBlocked(b);
          localStorage.setItem("wsc-blocked", JSON.stringify(b));
        }
      } catch {}
    } catch (e) {
      setErr(`Cannot reach API at ${API}. Start backend: cd backend && uvicorn app.main:app --port 8000. (${e.message})`);
    } finally { setLoading(false); }
  }

  function answerChat(q) {
    const url = extractUrl(q);
    if (url) { runScan(url); return; }
    const low = q.toLowerCase();
    let a = "Paste any URL (e.g. https://example.com) and I'll scan headers, SSL, cookies and phishing patterns, then explain the score in plain English.";
    if (low.includes("hsts")) a = "To fix a missing HSTS header: Nginx → add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always; Apache → Header always set Strict-Transport-Security \"max-age=31536000\". Then re-scan here.";
    else if (low.includes("phish")) a = "Phishing test: try scanning http://free-prize-login-verify.xyz/login — Guard should flag it Harmful ⛔ and auto-block while Guard is ON.";
    else if (low.includes("block") || low.includes("force")) a = "Auto-block rule: while Guard is ON, suspicious sites are blocked with no click-through. To force-open you must turn Guard OFF (toggle top-right), at your own risk.";
    else if (low.includes("score") || low.includes("grade")) a = "Score = 100 − min(100, 10×Critical + 5×High + 2×Medium + 1×Low). Grades: A ≥90, B ≥75, C ≥60, D ≥40, F <40.";
    else if (low.includes("safe") || low.includes("harm")) a = "I give a verdict per site: Safe ✅ / Suspicious ⚠️ / Harmful ⛔ with reasons. Turn Guard ON and open any site — the extension badge shows it automatically.";
    const c = [{ q, a, t: Date.now() }, ...chats].slice(0, 4);
    setChats(c);
    try { localStorage.setItem("wsc-chats", JSON.stringify(c)); } catch {}
  }

  function submitAsk() {
    const q = ask.trim();
    if (!q || loading) return;
    setAsk("");
    answerChat(q);
  }

  const verdictColor = !data ? "#64748b" : data.verdict === "safe" ? "#16a34a" : data.verdict === "suspicious" ? "#f59e0b" : "#dc2626";

  return (
    <div style={styles.wallpaper}>
      <div style={styles.window}>
        {/* top bar */}
        <div style={styles.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800 }}>🛡️ Security Copilot</span>
            <span title="Manual scan + Always-On Guard" style={styles.topIcon}>❐</span>
            <span title="Home" style={styles.topIcon}>⌂</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setGuardOn(!guardOn)} title={guardOn ? "Guard ON — click to turn OFF" : "Guard OFF — click to turn ON"}
              style={{ ...styles.guardBtn, background: guardOn ? "#16a34a" : "#475569" }}>
              {guardOn ? "● Guard ON" : "○ Guard OFF"}
            </button>
            <span style={styles.winBtn}>⤢</span><span style={styles.winBtn}>–</span><span style={styles.winBtn}>▢</span><span style={styles.winBtn}>✕</span>
          </div>
        </div>

        {/* greeting */}
        <h1 style={styles.greet}>{greeting}, Defender<br />What can I check for you today?</h1>
        <p style={styles.sub}>
          {guardOn ? "Guard is ON — watching every site, verdict Safe/Harmful, auto-blocking suspicious." : "Guard is OFF — no checks, no blocks. Turn it ON for protection."}
        </p>

        {/* cards */}
        <div style={styles.grid3}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Jump back in to your scans</div>
            {(history.length ? history : [{ url: "https://example.com", verdict: "safe", score: 89, grade: "B", t: Date.now() }]).slice(0, 5).map((h, i) => (
              <div key={i} style={styles.row} onClick={() => runScan(h.url)} title="Click to re-scan">
                <span>📄</span>
                <span style={{ flex: 1 }}><b>{hostOf(h.url)}</b><br /><small style={styles.mut}>{timeAgo(h.t)} · {h.score}/100 · {h.grade}</small></span>
                <span style={{ ...styles.mini, background: h.verdict === "safe" ? "#16a34a" : h.verdict === "suspicious" ? "#f59e0b" : "#dc2626" }}>{h.verdict}</span>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Get guided help with security</div>
            <div style={styles.tiles}>
              {QUICK_TILES.map((t) => (
                <button key={t.label} style={styles.tile} onClick={() => runScan(t.url)} title={t.hint}>
                  <span style={{ fontSize: 22 }}>{t.icon}</span><small>{t.label}</small>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Keep talking to Copilot</div>
            {(chats.length ? chats.map((c) => ({ title: c.q, sub: timeAgo(c.t) })) : [{ title: "Is this link safe?", sub: "try me below" }, { title: "Fix HSTS header", sub: "Nginx + Apache" }]).slice(0, 4).map((c, i) => (
              <div key={i} style={styles.row} onClick={() => setAsk(typeof c.title === "string" ? c.title : c.q)} title="Click to reuse">
                <span>💬</span><span style={{ flex: 1 }}><b>{String(c.title).slice(0, 34)}</b><br /><small style={styles.mut}>{c.sub}</small></span><span>⋯</span>
              </div>
            ))}
            <div style={{ ...styles.row, border: 0 }}>
              <span>🛡️</span><span style={{ flex: 1 }}><b>Guard activity</b><br /><small style={styles.mut}>{watched} watched · {blocked.length} blocked</small></span>
            </div>
          </div>
        </div>

        <div style={styles.grid2}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Recent verdict</div>
            <h3 style={{ margin: "4px 0 12px" }}>{data ? `${hostOf(data.url)} — ${data.verdict.toUpperCase()} ${data.score}/100` : "No scan yet — run one below"}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={styles.pillBtn} onClick={() => data && navigator.clipboard?.writeText(data.summary)}>Summarize</button>
              <button style={styles.pillBtn} onClick={() => data && runScan(data.url)}>Re-scan</button>
              <button style={styles.pillBtn} onClick={() => data && navigator.clipboard?.writeText(data.findings.map((f) => `- [${f.severity}] ${f.title}: ${f.fix}`).join("\n"))}>Copy fixes</button>
              <button style={styles.pillBtn} onClick={() => { setData(null); setErr(""); }}>Delete</button>
            </div>
            {guardOn && data && data.verdict !== "safe" && <p style={{ color: "#fca5a5", fontSize: 13 }}>⛔ Guard would AUTO-BLOCK this site. Force-open requires Guard OFF.</p>}
          </div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Blocked by Guard</div>
            {(blocked.length ? blocked : [{ url: "nothing blocked yet", reason: "Suspicious sites appear here", t: Date.now() }]).slice(0, 3).map((b, i) => (
              <div key={i} style={styles.row}><span>⛔</span><span style={{ flex: 1 }}><b>{hostOf(b.url)}</b><br /><small style={styles.mut}>{String(b.reason).slice(0, 60)}</small></span></div>
            ))}
            <small style={styles.mut}>Blocked pages re-open only when Guard is OFF.</small>
          </div>
        </div>

        {/* result */}
        {err && <p style={{ color: "#fca5a5", textAlign: "center" }}>{err}</p>}
        {loading && <p style={{ textAlign: "center", color: "#93c5fd" }}>Scanning… checking headers, SSL, cookies, phishing patterns.</p>}
        {data && (
          <div style={{ ...styles.card, borderLeft: `6px solid ${verdictColor}`, textAlign: "left" }}>
            <b>Verdict: {data.verdict.toUpperCase()} {data.verdict === "safe" ? "✅" : data.verdict === "suspicious" ? "⚠️" : "⛔"} — {data.score}/100 (Grade {data.grade})</b>
            <p style={{ color: "#cbd5e1" }}>{data.summary}</p>
            {data.findings.map((f) => (
              <div key={f.id} style={styles.find}>
                <b>[{f.severity}] {f.title}</b>
                <div style={{ fontSize: 13, color: "#93c5fd" }}>{f.evidence}</div>
                <div style={{ fontSize: 13 }}>{f.why}</div>
                <code style={{ fontSize: 12, color: "#86efac" }}>{f.fix}</code>
              </div>
            ))}
          </div>
        )}

        {/* ask box */}
        <div style={styles.suggest}>
          {SUGGESTIONS.map((s) => (
            <button key={s} style={styles.pill} onClick={() => { setAsk(s === "Scan a URL" ? "https://example.com" : s === "Check phishing link" ? "http://free-prize-login-verify.xyz/login" : s); }}>{s}</button>
          ))}
        </div>
        <div style={styles.askBox}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAsk()}
            placeholder="Ask anything — paste a URL to scan it" style={styles.askInput} />
          <div style={styles.askRow}>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.mode}>
              <option>Quick response</option><option>Detailed audit</option><option>Dev fixes</option>
            </select>
            <span style={{ flex: 1 }} />
            <button style={styles.send} onClick={submitAsk} title="Send">➤</button>
          </div>
        </div>
        <p style={styles.foot}>Security Copilot checks headers, SSL and phishing signs. Findings are passive checks — verify before changing production. API: {API}</p>
      </div>
    </div>
  );
}

const styles = {
  wallpaper: { minHeight: "100vh", padding: "24px 12px", background: "radial-gradient(1000px 500px at 15% 0%, #a855f7 0%, transparent 60%), radial-gradient(900px 500px at 90% 10%, #3b82f6 0%, transparent 55%), radial-gradient(800px 600px at 50% 110%, #ec4899 0%, transparent 55%), linear-gradient(180deg,#1e1b4b,#0b1220)", backgroundAttachment: "fixed" },
  window: { maxWidth: 1120, margin: "0 auto", background: "rgba(8,15,30,.88)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14, padding: "14px 22px 22px", backdropFilter: "blur(10px)", color: "#e2e8f0" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 2px 12px" },
  topIcon: { background: "#1e293b", borderRadius: 6, padding: "2px 8px", fontSize: 13, cursor: "default" },
  winBtn: { color: "#94a3b8", fontSize: 14, padding: "0 6px", cursor: "default" },
  guardBtn: { color: "#fff", border: 0, borderRadius: 20, padding: "6px 14px", fontWeight: 800, cursor: "pointer", fontSize: 13 },
  greet: { textAlign: "center", fontSize: "clamp(26px,4vw,40px)", lineHeight: 1.2, margin: "18px 0 6px", fontWeight: 800 },
  sub: { textAlign: "center", color: "#94a3b8", margin: "0 0 18px", fontSize: 14 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 14 },
  card: { background: "rgba(30,41,59,.92)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 18, padding: 16, marginTop: 14 },
  cardTitle: { fontSize: 12, color: "#94a3b8", marginBottom: 10 },
  row: { display: "flex", gap: 10, alignItems: "center", padding: "9px 4px", borderBottom: "1px solid rgba(255,255,255,.06)", cursor: "pointer", fontSize: 14 },
  mut: { color: "#94a3b8" },
  mini: { color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 12, padding: "2px 8px" },
  tiles: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 },
  tile: { background: "#0b1220", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "12px 4px", color: "#e2e8f0", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", fontSize: 12 },
  pillBtn: { background: "#334155", color: "#fff", border: 0, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700 },
  find: { background: "#0b1220", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14 },
  suggest: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", margin: "20px 0 10px" },
  pill: { background: "rgba(30,41,59,.9)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,.12)", borderRadius: 20, padding: "7px 14px", cursor: "pointer", fontSize: 13 },
  askBox: { maxWidth: 720, margin: "0 auto", background: "rgba(30,41,59,.95)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "14px 16px" },
  askInput: { width: "100%", boxSizing: "border-box", background: "transparent", border: 0, outline: "none", color: "#fff", fontSize: 15 },
  askRow: { display: "flex", alignItems: "center", marginTop: 10 },
  mode: { background: "#0b1220", color: "#e2e8f0", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "5px 10px", fontSize: 12 },
  send: { background: "#e2e8f0", color: "#0b1220", border: 0, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontWeight: 800 },
  foot: { textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 12 },
};
