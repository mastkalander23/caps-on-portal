import React, { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { T } from "../theme.js";
import { api } from "../api.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api.login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, #171a20 0%, ${T.ink} 60%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 34, color: T.bone, letterSpacing: "0.02em" }}>Caps ON^</div>
          <div style={{ width: 46, height: 1, background: T.gold, margin: "10px auto" }} />
          <div style={{ color: T.muted, fontSize: 13 }}>A private ledger, kept in confidence.</div>
        </div>

        <form onSubmit={submit} style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 14, padding: 26 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Username</label>
            <input
              value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
              style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 8, padding: "11px 12px", color: T.bone, fontSize: 13.5, outline: "none" }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
            <div style={{ position: "relative", marginTop: 6 }}>
              <Lock size={15} style={{ position: "absolute", left: 12, top: 13, color: T.muted }} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 8, padding: "11px 12px 11px 34px", color: T.bone, fontSize: 13.5, outline: "none" }}
              />
            </div>
          </div>

          {error && <div style={{ color: T.terracotta, fontSize: 12.5, marginTop: 10 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", background: T.gold, border: "none", borderRadius: 8, padding: "11px 0", color: "#20180a",
            fontWeight: 600, fontSize: 13.5, cursor: "pointer", marginTop: 16, opacity: loading ? 0.7 : 1,
          }}>{loading ? "Signing in…" : "Sign in"}</button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 14, color: T.muted, fontSize: 11 }}>
            <ShieldCheck size={13} /> Each login sees only its own positions
          </div>
        </form>
      </div>
    </div>
  );
}
