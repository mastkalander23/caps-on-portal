const BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (username, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  positions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/positions${qs ? `?${qs}` : ""}`);
  },
  adminInvestors: () => request("/admin/investors"),
  refreshPrices: () => request("/admin/prices/refresh", { method: "POST" }),
  addInvestor: (payload) => request("/admin/investors", { method: "POST", body: JSON.stringify(payload) }),
  addTrade: (payload) => request("/admin/trades", { method: "POST", body: JSON.stringify(payload) }),
  bulkImportTrades: (rows) => request("/admin/trades/bulk", { method: "POST", body: JSON.stringify({ rows }) }),
  closeTrade: (id, payload) => request(`/admin/trades/${id}/close`, { method: "PATCH", body: JSON.stringify(payload) }),
  setTickerMap: (script, yahooSymbol) => request("/admin/ticker-map", { method: "POST", body: JSON.stringify({ script, yahooSymbol }) }),
};
