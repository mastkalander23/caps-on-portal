import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { T } from "../theme.js";
import { CoinMark } from "./CoinMark.jsx";

const GREETINGS = [
  "Welcome back — here's where things stand.",
  "Good to see you. Your ledger is up to date.",
  "Welcome back. Let's take a look at your portfolio.",
];

function greetingLine() {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const line = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return { timeOfDay, line };
}

// Shown once, right after an investor logs in (not on every page refresh).
// Dismiss by clicking the backdrop, the close button, or just waiting —
// it never blocks interaction with the page underneath in a jarring way.
export default function GreetingModal({ name, onClose }) {
  const [{ timeOfDay, line }] = useState(greetingLine);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(10, 11, 14, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380,
          background: T.panel,
          border: `1px solid ${T.hairline}`,
          borderRadius: 16,
          padding: "28px 26px",
          textAlign: "center",
          transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
          transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          position: "relative",
        }}
      >
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute", top: 14, right: 14,
            background: "none", border: "none", cursor: "pointer",
            color: T.muted, padding: 4, display: "flex",
          }}
        >
          <X size={16} />
        </button>

        <div style={{ marginBottom: 14 }}>
          <CoinMark size={42} />
        </div>

        <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          {timeOfDay}
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: T.bone, marginBottom: 8 }}>
          {name}
        </div>
        <div style={{ fontSize: 13.5, color: T.boneDim, lineHeight: 1.5 }}>
          {line}
        </div>

        <button
          onClick={close}
          style={{
            marginTop: 20, width: "100%",
            background: T.panel2, border: `1px solid ${T.hairline}`,
            color: T.bone, borderRadius: 8, padding: "10px 0",
            fontSize: 13, cursor: "pointer",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
