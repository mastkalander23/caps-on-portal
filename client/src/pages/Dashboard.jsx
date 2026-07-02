import React, { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LogOut, RefreshCw, Settings, LayoutDashboard, ChevronDown, KeyRound, X } from "lucide-react";
import { T, SCRIPT_COLORS, fmtINR, fmtNum } from "../theme.js";
import { Dropdown, StatCard, Avatar, initialsOf } from "../components/ui.jsx";
import { api } from "../api.js";
import AdminPanel from "./AdminPanel.jsx";

/* A solid, high-contrast tooltip for the pie charts — recharts' default
   tooltip inherits ambient styles that end up low-contrast on a dark
   theme, so we render our own compact card instead. */
function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const color = p.payload?.color || T.gold;
  return (
    <div style={{
      background: "#12141A", border: `1px solid ${T.hairline}`, borderRadius: 8,
      padding: "9px 13px", boxShadow: "0 8px 24px rgba(0,0,0,0.55)", fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.boneDim, marginBottom: 3 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        {p.name}
      </div>
      <div style={{ fontSize: 15, color: T.bone, fontWeight: 600 }}>{fmtINR(p.value)}</div>
    </div>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    if (form.next !== form.confirm) { setStatus({ tone: "err", msg: "New passwords don't match." }); return; }
    if (form.next.length < 6) { setStatus({ tone: "err", msg: "New password must be at least 6 characters." }); return; }
    setBusy(true);
    try {
      await api.changePassword(form.current, form.next);
      setStatus({ tone: "ok", msg: "Password updated." });
      setForm({ current: "", next: "", confirm: "" });
      setTimeout(onClose, 1000);
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 26, width: 340 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>Change Password</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["current", "Current password"], ["next", "New password"], ["confirm", "Confirm new password"]].map(([k, label]) => (
            <label key={k} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: T.muted }}>
              {label}
              <input type="password" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                style={{ background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 7, padding: "9px 10px", color: T.bone, fontSize: 13, outline: "none" }} />
            </label>
          ))}
          {status && <div style={{ fontSize: 12, color: status.tone === "ok" ? T.emerald : T.terracotta }}>{status.msg}</div>}
          <button type="submit" disabled={busy} style={{ background: T.gold, border: "none", borderRadius: 8, padding: "10px 0", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 4, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard({ session, onLogout }) {
  const isAdmin = session.role === "admin";
  const [tab, setTab] = useState("portfolio"); // "portfolio" | "admin"
  const [refreshKey, setRefreshKey] = useState(0);

  const [investorsList, setInvestorsList] = useState([]);
  const [viewingId, setViewingId] = useState(isAdmin ? null : String(session.id));
  const [view, setView] = useState("net"); // "net" | "gross" | "afterTax"
  const [scriptMetric, setScriptMetric] = useState("unrealized");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scriptFilter, setScriptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("profit_desc");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.adminInvestors().then((list) => {
        setInvestorsList(list);
        setViewingId((prev) => prev || (list.length ? String(list[0].id) : null));
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
          <Dropdown label="Viewing" value={viewingId || ""} onChange={setViewingId}
            options={[{ value: "all", label: "All Investors (combined)" }, ...investorsList.map((i) => ({ value: String(i.id), label: i.display_name }))]} />
        )}
        {tab === "portfolio" && (
          <Dropdown label="Figures" value={view} onChange={setView}
            options={[{ value: "net", label: "My Share" }, { value: "afterTax", label: "My Share, After Tax" }, { value: "gross", label: "Pre-Share (Gross)" }]} />
        )}
        <div style={{ position: "relative" }}>
          <button onClick={() => setUserMenuOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Avatar initials={initialsOf(session.name)} size={32} />
            <div style={{ fontSize: 12.5, color: T.bone }}>{session.name}</div>
            <ChevronDown size={13} color={T.muted} />
          </button>
          {userMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setUserMenuOpen(false)} />
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 8, minWidth: 190, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
                <button onClick={() => { setShowPwModal(true); setUserMenuOpen(false); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", color: T.bone,
                  padding: "10px 14px", fontSize: 12.5, cursor: "pointer", textAlign: "left",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.panel2)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                ><KeyRound size={14} color={T.gold} /> Change password</button>
              </div>
            </>
          )}
        </div>
        <button onClick={async () => { await api.logout(); onLogout(); }} style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 7, padding: "7px 10px", color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <LogOut size={13} /> Log out
        </button>
      </div>
    </div>
  );

  const pwModal = <ChangePasswordModal open={showPwModal} onClose={() => setShowPwModal(false)} />;

  if (isAdmin && tab === "admin") {
    return (
      <div style={{ minHeight: "100vh", background: T.ink, fontFamily: "Inter, sans-serif", color: T.bone, paddingBottom: 60 }}>
        {headerBar}
        <AdminPanel investorsList={investorsList} onChanged={onDataChanged} />
        {pwModal}
      </div>
    );
  }

  if (error) return <div style={{ color: T.terracotta, padding: 40, fontFamily: "Inter" }}>{error}{pwModal}</div>;
  if (!data) return <div style={{ color: T.muted, padding: 40, fontFamily: "Inter" }}>Loading…{pwModal}</div>;

  const { investor, rows, summary, scriptData } = data;
  const isAll = investor.id === "all";
  const netTotal = view === "gross" ? summary.grossTotal : view === "afterTax" ? summary.investorTotalAfterTax : summary.investorTotal;
  const realizedFigure = view === "gross" ? summary.realized : view === "afterTax" ? summary.investorRealizedAfterTax : summary.investorRealized;
  const unrealizedFigure = view === "gross" ? summary.unrealized : view === "afterTax" ? summary.investorUnrealizedAfterTax : summary.investorUnrealized;
  const totalTax = summary.taxRealized + summary.taxUnrealized;

  const profitSplitData = [
    { name: "Realized", value: realizedFigure, color: T.gold },
    { name: "Unrealized", value: unrealizedFigure, color: T.slate },
  ];
  const scriptDataColored = scriptData.map((d, i) => ({ ...d, color: SCRIPT_COLORS[i % SCRIPT_COLORS.length] }));

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
            {investor.name}{isAll ? "" : "'s"} Current Portfolio Value
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 40 }}>{fmtINR(summary.currentValue)}</div>
          <div style={{ fontSize: 12, color: T.boneDim, marginTop: 4 }}>Across {isAll ? "all investors'" : ""} open positions, at latest refreshed price</div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
          <StatCard label="Net Position" value={fmtINR(netTotal)} tone={netTotal >= 0 ? "up" : "down"}
            sub={view === "gross" ? "Pre-share, pre-tax" : view === "afterTax" ? "Your share, after tax" : "Your share, pre-tax"} />
          <StatCard label="Realized P&L" value={fmtINR(realizedFigure)} tone={summary.realized >= 0 ? "up" : "down"} sub={`Gross: ${fmtINR(summary.realized)}`} />
          <StatCard label="Unrealized P&L" value={fmtINR(unrealizedFigure)} tone={summary.unrealized >= 0 ? "up" : "down"} sub={`Gross: ${fmtINR(summary.unrealized)}`} />
          <StatCard label="Tax (LTCG 12.5% / STCG 20%)" value={fmtINR(totalTax)} sub={`Loss carry-fwd — STCL ${fmtINR(summary.carryForward.stcl)} · LTCL ${fmtINR(summary.carryForward.ltcl)}`} />
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 26 }}>
          <div style={{ flex: "1 1 380px", background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 12 }}>Profit Split</div>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={profitSplitData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                  {profitSplitData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: "none" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 22, fontSize: 12, marginTop: -6 }}>
              {profitSplitData.map((d) => (<span key={d.name} style={{ color: d.color }}>● {d.name} {fmtINR(d.value)}</span>))}
            </div>
          </div>

          <div style={{ flex: "1 1 380px", background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16 }}>Script-wise Profit</div>
              <Dropdown value={scriptMetric} onChange={setScriptMetric} options={[
                { value: "unrealized", label: "Unrealized" }, { value: "realized", label: "Realized" }, { value: "combined", label: "Combined" },
              ]} />
            </div>
            {scriptDataColored.length ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={scriptDataColored} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                      {scriptDataColored.map((d, i) => (<Cell key={i} fill={d.color} />))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: "none" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 16px", fontSize: 11.5, marginTop: -6 }}>
                  {scriptDataColored.map((s) => (<span key={s.name} style={{ color: s.color }}>● {s.name}</span>))}
                </div>
              </>
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
                  {[...(isAll ? ["Investor"] : []), "Script", "Status", "Qty", "Buy Price", "Exit / CMP", "Invested", "Current / Sell Value", "P&L (gross)", "Your Share", "Gain Type"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Script" || h === "Status" || h === "Investor" || h === "Gain Type" ? "left" : "right", padding: "8px 10px", borderBottom: `1px solid ${T.hairline}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={`${r.investorId || ""}-${r.id}`} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                    {isAll && <td style={{ padding: "10px", color: T.boneDim }}>{r.investorName}</td>}
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
                        {r.gainType}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={isAll ? 10 : 9} style={{ padding: 24, textAlign: "center", color: T.muted }}>No positions match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {summary.taxByFY && summary.taxByFY.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.hairline}` }}>
              <div style={{ fontSize: 12, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>Tax by Financial Year (realized only, after loss set-off)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ color: T.muted }}>
                      {["FY", "STCG Gain", "STCG Loss", "LTCG Gain", "LTCG Loss", "Taxable STCG", "Taxable LTCG", "Tax", "STCL c/f", "LTCL c/f"].map((h) => (
                        <th key={h} style={{ textAlign: h === "FY" ? "left" : "right", padding: "6px 8px", borderBottom: `1px solid ${T.hairline}`, fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.taxByFY.map((f) => (
                      <tr key={f.fy} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                        <td style={{ padding: "6px 8px", color: T.bone }}>{f.fy}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.stcgGain)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.stcgLoss)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.ltcgGain)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.ltcgLoss)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.taxableSTCG)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.taxableLTCG)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: T.gold }}>{fmtINR(f.tax)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.stclCarriedForward)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtINR(f.ltclCarriedForward)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ color: T.muted, fontSize: 11, marginTop: 12 }}>
            Realized tax nets short/long-term gains and losses within each financial year, with unabsorbed losses carried forward. Unrealized tax is a live projection — what the open book would add or save in tax if closed today — and only locks in once a position is actually sold.
          </div>
        </div>
      </div>

      {pwModal}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
