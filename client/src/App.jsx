import React, { useState, useEffect } from "react";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import GreetingModal from "./components/GreetingModal.jsx";
import { api, getToken } from "./api.js";
import { T } from "./theme.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  // Only true right after a fresh username/password login — not when an
  // existing session is silently restored on page refresh — so the
  // greeting doesn't pop up every time the page reloads.
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api.me().then(setSession).catch(() => {}).finally(() => setChecking(false));
  }, []);

  function handleFreshLogin(user) {
    setSession(user);
    if (user.role === "investor") setShowGreeting(true);
  }

  if (checking) return <div style={{ minHeight: "100vh", background: T.ink }} />;

  return !session
    ? <Login onLogin={handleFreshLogin} />
    : (
      <>
        <Dashboard session={session} onLogout={() => setSession(null)} />
        {showGreeting && (
          <GreetingModal name={session.name} onClose={() => setShowGreeting(false)} />
        )}
      </>
    );
}
