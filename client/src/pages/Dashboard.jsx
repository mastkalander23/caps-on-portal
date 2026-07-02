import React, { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LogOut, RefreshCw, Settings, LayoutDashboard } from "lucide-react";
import { T, SCRIPT_COLORS, fmtINR, fmtNum } from "../theme.js";
import { Dropdown, StatCard, Avatar, initialsOf } from "../components/ui.jsx";
import { api } from "../api.js";
import AdminPanel from "./AdminPanel.jsx";

export default function Dashboard({ session, onLogout }) {
  const isAdmin = session.role === "admin";
  const [tab, setTab] = useState("portfolio"); // "portfolio" | "admin"
  const [refreshKey, setRefreshKey] = useState(0);

  const [investorsList, setInvestorsList] = useState([]);
  const [viewingId, setViewingId] = useState(isAdmin ? null : session.id);
  const [view, setView] = useState("net"); // "net" | "gross" | "afterTax"
  const [scriptMetric, setScriptMetric] = useState("unrealized");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scriptFilter, setScriptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("profit_desc");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.adminInvestors().then((list) => {
        setInvestorsList(list);
        setViewingId((prev) => prev || (list.length ? list[0].id : null));
      }).catch((e) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, refreshKey]);

  const load = useCallback(() => {
    if (!viewingId && !isAdmin) return;
    const params = { view: view === "afterTax" ? "net" : view, metric: scriptMetric };
    if (isAdmin && viewingId) params.userId = viewingId;
    api.positions(params).then(setData).catch((e) => setError(e.message));
  }, [viewingId, view, scriptMetric, isAdmin]);

  useEffect(() => { if (viewingId || !isAdmin) load(); }, [load, viewingId, isAdmin, refreshKey]);

  async function refreshPrices() {
    setRefreshing(true);
    try { await api.refreshPrices(); load(); } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  }

  function onDataChanged() {
    // Called by AdminPanel after adding an investor / trade / import,
    // so the numbers on screen are never stale.
    setRefreshKey((k) => k + 1);
  }

  const headerBar = (
    <div style={{ borderBottom: `1px solid ${T.hairline}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 21 }}>Caps ON^</div>
        <div style={{ width: 1, height: 20, background: T.hairline }} />
        {tab === "portfolio" && (
          <button onClick={refreshPrices} disabled={refreshing} style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.emerald, background: "none",
            border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
          }}>
            <RefreshCw size={12} className={refreshing ? "spin" : ""} />
            {refreshing ? "REFRESHING…" : "REFRESH PRICES (DELAYED FEED)"}
          </button>
        )}
        {isAdmin && (
          <div style={{ display: "flex", gap: 4, background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 8, padding: 3 }}>
            <button onClick={() => setTab("portfolio")} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: tab === "portfolio" ? T.gold : "transparent", color: tab === "portfolio" ? "#20180a" : T.muted, fontSize: 12, fontWeight: 600,
            }}><LayoutDashboard size={13} /> Portfolio</button>
            <button onClick={() => setTab("admin")} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: tab === "admin" ? T.gold : "transparent", color: tab === "admin" ? "#20180a" : T.muted, fontSize: 12, fontWeight: 600,
            }}><Settings size={13} /> Admin Tools</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {tab === "portfolio" && isAdmin && (
          <Dropdown label="Viewing" value={viewingId || ""} onChange={(v) => setViewingId(Number(v))}
            options={investorsList.map((i) => ({ value: i.id, label: i.display_name }))} />
        )}
        {tab === "portfolio" && (
          <Dropdown label="Figures" value={view} onChange={setView}
            options={[{ value: "net", label: "My Share" }, { value: "afterTax", label: "My Share, After Tax" }, { value: "gross", label: "Pre-Share (Gross)" }]} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar initials={initialsOf(session.name)} size={32} />
          <div style={{ fontSize: 12.5 }}>{session.name}</div>
        </div>
        <button onClick={async () => { await api.logout(); onLogout(); }} style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 7, padding: "7px 10px", color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <LogOut size={13} /> Log out
        </button>
      </div>
    </div>
  );

  if (isAdmin && tab === "admin") {
    return (
      <div style={{ minHeight: "100vh", background: T.ink, fontFamily: "Inter, sans-serif", color: T.bone, paddingBottom: 60 }}>
        {headerBar}
        <AdminPanel investorsList={investorsList} onChanged={onDataChanged} />
      </div>
    );
  }

  if (error) return <div style={{ color: T.terracotta, padding: 40, fontFamily: "Inter" }}>{error}</div>;
  if (!data) return <div style={{ color: T.muted, padding: 40, fontFamily: "Inter" }}>Loading…</div>;

  const { investor, rows, summary, scriptData } = data;
  const netTotal = view === "gross" ? summary.grossTotal : view === "afterTax" ? summary.investorTotalAfterTax : summary.investorTotal;
  const totalTax = summary.taxRealized + summary.taxUnrealized;
  const profitSplitData = [
    { name: "Realized", value: view === "gross" ? summary.realized : view === "afterTax" ? summary.investorRealizedAfterTax : summary.investorRealized },
    { name: "Unrealized", value: view === "gross" ? summary.unrealized : view === "afterTax" ? summary.investorUnrealizedAfterTax : summary.investorUnrealized },
  ];
  const scripts = Array.from(new Set(rows.map((r) => r.script)));
  const filteredRows = rows
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => scriptFilter === "all" || r.script === scriptFilter)
    .sort((a, b) => {
      if (sortBy === "profit_desc") return b.profit - a.profit;
      if (sortBy === "profit_asc") return a.profit - b.profit;
      if (sortBy === "value_desc") return b.value - a.value;
      if (sortBy === "script") return a.script.localeCompare(b.script);
      return 0;
    });

  return (
    <div style={{ minHeight: "100vh", background: T.ink, fontFamily: "Inter, sans-serif", color: T.bone, paddingBottom: 60 }}>
      {headerBar}

      <div style={{ padding: "26px 28px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", color: T.muted, textTransform: "uppercase", marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>
            {investor.name}'s Position — {view === "gross" ? "pre-share, pre-tax" : view === "afterTax" ? "your share, after LTCG/STCG tax" : "your settled share, pre-tax"}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 40 }}>{fmtINR(netTotal)}</div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
          <StatCard label="Current Value" value={fmtINR(summary.currentValue)} sub={`Invested ${fmtINR(summary.invested)}`} />
          <StatCard label="Realized P&L" value={fmtINR(summary.realized)} tone={summary.realized >= 0 ? "up" : "down"} sub={`Your share: ${fmtINR(summary.investorRealized)}`} />
          <StatCard label="Unrealized P&L" value={fmtINR(summary.unrealized)} tone={summary.unrealized >= 0 ? "up" : "down"} sub={`Your share: ${fmtINR(summary.investorUnrealized)}`} />
          <StatCard label="Tax (LTCG 12.5% / STCG 20%)" value={fmtINR(totalTax)} sub="On gains only, by holding period ≥/< 365 days" />
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 26 }}>
          <div style={{ flex: "1 1 380px", background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 12 }}>Profit Split</div>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={profitSplitData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                  <Cell fill={T.gold} /><Cell fill={T.slate} />
                </Pie>
                <Tooltip contentStyle={{ background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 8, color: T.bone, fontSize: 12 }} formatter={(v) => fmtINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: "1 1 380px", background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16 }}>Script-wise Profit</div>
              <Dropdown value={scriptMetric} onChange={setScriptMetric} options={[
                { value: "unrealized", label: "Unrealized" }, { value: "realized", label: "Realized" }, { value: "combined", label: "Combined" },
              ]} />
            </div>
            {scriptData.length ? (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={scriptData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                    {scriptData.map((_, i) => (<Cell key={i} fill={SCRIPT_COLORS[i % SCRIPT_COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 8, color: T.bone, fontSize: 12 }} formatter={(v) => fmtINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 230, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13 }}>No {scriptMetric} positions</div>
            )}
          </div>
        </div>

        <div style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16 }}>Positions Ledger</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Dropdown value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "All Status" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} />
              <Dropdown value={scriptFilter} onChange={setScriptFilter} options={[{ value: "all", label: "All Scripts" }, ...scripts.map((s) => ({ value: s, label: s }))]} />
              <Dropdown value={sortBy} onChange={setSortBy} options={[
                { value: "profit_desc", label: "P&L: High → Low" }, { value: "profit_asc", label: "P&L: Low → High" },
                { value: "value_desc", label: "Value: High → Low" }, { value: "script", label: "Script: A → Z" },
              ]} />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: T.muted, textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.05em" }}>
                  {["Script", "Status", "Qty", "Buy Price", "Exit / CMP", "Invested", "Current / Sell Value", "P&L (gross)", "Your Share", "Gain Type", "Tax", "Your Share After Tax"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Script" || h === "Status" || h === "Gain Type" ? "left" : "right", padding: "8px 10px", borderBottom: `1px solid ${T.hairline}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                    <td style={{ padding: "10px", color: T.bone }}>{r.script}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", background: r.status === "open" ? "rgba(76,154,120,0.15)" : "rgba(140,144,156,0.15)", color: r.status === "open" ? T.emerald : T.muted }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{fmtNum(r.qty, r.qty % 1 ? 2 : 0)}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{fmtNum(r.buyPrice)}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{fmtNum(r.exitPrice)}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{fmtINR(r.invested)}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{fmtINR(r.value)}</td>
                    <td style={{ padding: "10px", textAlign: "right", color: r.profit >= 0 ? T.emerald : T.terracotta }}>{r.profit >= 0 ? "+" : ""}{fmtINR(r.profit)}</td>
                    <td style={{ padding: "10px", textAlign: "right" }}>{fmtINR(r.investorShare)}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: r.gainType === "LTCG" ? "rgba(201,161,90,0.15)" : "rgba(192,96,74,0.15)", color: r.gainType === "LTCG" ? T.gold : T.terracotta }}>
                        {r.gainType} · {Math.round(r.taxRate * 100 * 10) / 10}%
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", color: T.muted }}>{fmtINR(r.taxAmount)}</td>
                    <td style={{ padding: "10px", textAlign: "right", color: T.bone }}>{fmtINR(r.investorNetAfterTax)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: 24, textAlign: "center", color: T.muted }}>No positions match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ color: T.muted, fontSize: 11, marginTop: 12 }}>
            Tax on open positions is a projection — "if sold today" — and only becomes real once a position is actually closed.
          </div>
        </div>
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
