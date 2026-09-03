import React from "react";

// The brand mark: a small shining gold coin with a ₹ minted in the center.
// Used in the header, the greeting popup, and the farewell message.
export function CoinMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="16" cy="16" r="14" fill="#C9A15A" stroke="#8C7237" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="#8C7237" strokeWidth="0.8" opacity="0.55" />
      <text x="16" y="20.5" textAnchor="middle" fontFamily="'Fraunces', serif" fontWeight="600" fontSize="12.5" fill="#4A3A18">₹</text>
      <path d="M24.2 6.4 L25 8.3 L27 9 L25 9.8 L24.2 11.6 L23.5 9.8 L21.5 9 L23.5 8.3 Z" fill="#F8F3E6" />
      <circle cx="8.3" cy="9.2" r="0.9" fill="#F8F3E6" opacity="0.85" />
    </svg>
  );
}
