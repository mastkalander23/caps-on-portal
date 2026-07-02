export const T = {
  ink: "#0F1114",
  panel: "#171A20",
  panel2: "#1D2129",
  hairline: "#2B303A",
  bone: "#F3EFE4",
  boneDim: "#B9B4A6",
  muted: "#8A8F9C",
  gold: "#C9A15A",
  goldDim: "#8C7237",
  emerald: "#4C9A78",
  terracotta: "#C0604A",
  slate: "#5D7A96",
  plum: "#8B6C8F",
  olive: "#8D8F5E",
};

export const SCRIPT_COLORS = [T.gold, T.slate, T.emerald, T.plum, T.olive, T.terracotta];

export const fmtINR = (n, decimals = 0) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

export const fmtNum = (n, decimals = 2) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: decimals });
