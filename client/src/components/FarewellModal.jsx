import React, { useEffect, useState } from "react";
import { T } from "../theme.js";
import { CoinMark } from "./CoinMark.jsx";

// Shown for a couple seconds after clicking Logout, then calls onDone to
// actually complete the logout. Purely a goodbye moment — no buttons to
// wait on, it always proceeds on its own.
export default function FarewellModal({ onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(onDone, 6000);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10, 11, 14, 0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      opacity: visible ? 1 : 0,
      transition: "opacity 220ms ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background: T.panel,
        border: `1px solid ${T.hairline}`,
        borderRadius: 16,
        padding: "30px 26px",
        textAlign: "center",
        transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
        transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      }}>
        <div style={{ marginBottom: 14 }}>
          <CoinMark size={42} />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, color: T.bone, marginBottom: 8 }}>
          Thanks for keeping your Caps ON^
        </div>
        <div style={{ fontSize: 13, color: T.boneDim, lineHeight: 1.5 }}>
          See you soon — here's to capital that only trends one way.
        </div>
      </div>
    </div>
  );
}
