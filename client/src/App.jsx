import React, { useState, useEffect } from "react";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { api, getToken } from "./api.js";
import { T } from "./theme.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api.me().then(setSession).catch(() => {}).finally(() => setChecking(false));
  }, []);

  if (checking) return <div style={{ minHeight: "100vh", background: T.ink }} />;

  return !session
    ? <Login onLogin={setSession} />
    : <Dashboard session={session} onLogout={() => setSession(null)} />;
}
