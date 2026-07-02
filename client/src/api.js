const BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
const TOKEN_KEY = "caps_on_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: async (username, password) => {
    const data = await request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    setToken(data.token);
    return data;
  },
  logout: async () => {
    try { await request("/auth/logout", { method: "POST" }); } finally { setToken(null); }
  },
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
