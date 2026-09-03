import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { T, fmtINR } from "../theme.js";

export function Dropdown({ value, onChange, options, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.06em", color: T.muted, textTransform: "uppercase" }}>
      {label && <span>{label}</span>}
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            appearance: "none", background: T.panel2, border: `1px solid ${T.hairline}`, color: T.bone,
            padding: "7px 28px 7px 12px", borderRadius: 6, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace",
            cursor: "pointer", outline: "none",
          }}
        >
          {options.map((o) => (<option key={o.value} value={o.value} style={{ background: T.panel2 }}>{o.label}</option>))}
        </select>
        <ChevronDown size={13} style={{ position: "absolute", right: 9, pointerEvents: "none", color: T.muted }} />
      </span>
    </label>
  );
}

// Animates a number smoothly from its previous value to a new target
// whenever `target` changes. Skips the animation (jumps straight to the
// value) while `active` is false, e.g. during a loading state.
function useCountUp(target, active) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (!active) return;
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    const duration = 650;
    const start = performance.now();
    let raf;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);

  useEffect(() => {
    if (!active) { setValue(target); prevRef.current = target; }
  }, [active, target]);

  return value;
}

// `numeric` + optional `format` gives you an animated count-up (used for
// P&L figures). Pass a plain `value` string instead for non-numeric cards
// (e.g. "Already Settled") — those render as-is, no animation.
// `loading` shows a pulsing ₹ in place of the figure while data is in flight.
export function StatCard({ label, value, numeric, format, loading, sub, tone }) {
  const color = tone === "up" ? T.emerald : tone === "down" ? T.terracotta : T.bone;
  const isNumeric = typeof numeric === "number";
  const animated = useCountUp(isNumeric ? numeric : 0, isNumeric && !loading);
  const display = loading ? "₹" : isNumeric ? (format ? format(animated) : fmtINR(animated)) : value;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: "18px 20px", flex: 1, minWidth: 170 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>{label}</div>
      <div
        className={loading ? "rupee-pulse" : ""}
        style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600,
          color: loading ? T.gold : color,
          opacity: loading ? 0.65 : 1,
          transition: "opacity 200ms ease, color 200ms ease",
        }}
      >
        {display}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.boneDim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export function Avatar({ initials, size = 36, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(circle at 30% 30%, ${T.goldDim}, #14171c)`, border: `1.5px solid ${ring ? T.gold : T.hairline}`,
      color: T.gold, fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: size * 0.38, flexShrink: 0,
    }}>{initials}</div>
  );
}

export function initialsOf(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
