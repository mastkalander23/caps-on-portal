import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { UserPlus, TrendingUp, Upload, CheckCircle2, AlertCircle, Link2, Pencil, Trash2, Users, KeyRound, HandCoins } from "lucide-react";
import { T, fmtINR } from "../theme.js";
import { Dropdown } from "../components/ui.jsx";
import { api } from "../api.js";

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 22, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Icon size={17} color={T.gold} />
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>{title}</div>
      </div>
      {subtitle && <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 16 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
      <span style={{ color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10.5 }}>{label}</span>
      <input {...props} style={{
        background: T.panel2, border: `1px solid ${T.hairline}`, borderRadius: 7, padding: "9px 10px",
        color: T.bone, fontSize: 13, outline: "none",
      }} />
    </label>
  );
}

function Banner({ tone, children }) {
  const color = tone === "ok" ? T.emerald : T.terracotta;
  const Icon = tone === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color, fontSize: 12.5, marginTop: 12, background: `${color}14`, border: `1px solid ${color}44`, borderRadius: 8, padding: "10px 12px" }}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <div>{children}</div>
    </div>
  );
}

export default function AdminPanel({ investorsList, onChanged }) {
  return (
    <div style={{ padding: "26px 28px", maxWidth: 900, margin: "0 auto" }}>
      <AddInvestor onChanged={onChanged} />
      <EditInvestors investorsList={investorsList} onChanged={onChanged} />
      <AddTrade investorsList={investorsList} onChanged={onChanged} />
      <EditTrades investorsList={investorsList} onChanged={onChanged} />
      <BalanceSettlement investorsList={investorsList} onChanged={onChanged} />
      <ImportExcel investorsList={investorsList} onChanged={onChanged} />
      <TickerMap onChanged={onChanged} />
    </div>
  );
}

/* ---------------- Add Investor ---------------- */
function AddInvestor({ onChanged }) {
  const [form, setForm] = useState({ username: "", password: "", displayName: "", ratio: "30", taxApplicable: true });
  const [status, setStatus] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.addInvestor({
        username: form.username, password: form.password, displayName: form.displayName,
        ratio: Number(form.ratio) / 100, taxApplicable: form.taxApplicable,
      });
      setStatus({ tone: "ok", msg: `${form.displayName} added. They can sign in with username "${form.username.toLowerCase()}".` });
      setForm({ username: "", password: "", displayName: "", ratio: "30", taxApplicable: true });
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  return (
    <Section icon={UserPlus} title="Add Investor" subtitle="Creates a private login that only sees this investor's own positions.">
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Full name" required value={form.displayName} onChange={set("displayName")} placeholder="e.g. Rohan Desai" />
        <Field label="Username" required value={form.username} onChange={set("username")} placeholder="e.g. rohan" />
        <Field label="Temporary password" required type="text" value={form.password} onChange={set("password")} placeholder="They should change this after first login" />
        <Field label="Manager's profit share (%)" required type="number" min="0" max="100" value={form.ratio} onChange={set("ratio")} />

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.boneDim }}>
          <input type="checkbox" checked={form.taxApplicable} onChange={(e) => setForm({ ...form, taxApplicable: e.target.checked })} />
          Tax is applicable to this investor
        </label>

        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" style={{ background: T.gold, border: "none", borderRadius: 8, padding: "10px 18px", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add investor</button>
        </div>
      </form>
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}

/* ---------------- Edit Investors ---------------- */
function EditInvestors({ investorsList, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pwId, setPwId] = useState(null);
  const [pwValue, setPwValue] = useState("");
  const [status, setStatus] = useState(null);

  const cellIn = { width: "100%", background: T.ink, border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "6px 8px", color: T.bone, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" };

  function startEdit(inv) {
    setEditingId(inv.id);
    setDraft({ displayName: inv.display_name, username: inv.username, ratioPct: Math.round(inv.ratio * 100), taxApplicable: inv.taxApplicable !== false });
    setPwId(null);
  }
  function cancelEdit() { setEditingId(null); setDraft(null); }

  async function saveEdit(id) {
    setStatus(null);
    try {
      await api.updateInvestor(id, { displayName: draft.displayName, username: draft.username, ratio: Number(draft.ratioPct) / 100, taxApplicable: draft.taxApplicable });
      setStatus({ tone: "ok", msg: "Investor details updated." });
      cancelEdit();
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  async function resetPassword(id) {
    setStatus(null);
    try {
      await api.resetInvestorPassword(id, pwValue);
      setStatus({ tone: "ok", msg: "Password reset. Share the new password with the investor securely." });
      setPwId(null); setPwValue("");
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  return (
    <Section icon={Users} title="Edit Investors" subtitle="Correct a name, username, or profit-share ratio — or reset an investor's password.">
      <div style={{ overflowX: "auto", border: `1px solid ${T.hairline}`, borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
          <thead>
            <tr style={{ color: T.muted, background: T.panel2 }}>
              {["Name", "Username", "Manager Share %", "Tax Applicable", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "7px 8px", borderBottom: `1px solid ${T.hairline}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {investorsList.map((inv) => {
              const editing = editingId === inv.id;
              return (
                <React.Fragment key={inv.id}>
                  <tr style={{ borderBottom: `1px solid ${T.hairline}` }}>
                    {editing ? (
                      <>
                        <td style={{ padding: 6 }}><input style={cellIn} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input style={cellIn} value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input type="number" min="0" max="100" style={cellIn} value={draft.ratioPct} onChange={(e) => setDraft({ ...draft, ratioPct: e.target.value })} /></td>
                        <td style={{ padding: 6, textAlign: "center" }}>
                          <input type="checkbox" checked={draft.taxApplicable} onChange={(e) => setDraft({ ...draft, taxApplicable: e.target.checked })} />
                        </td>
                        <td style={{ padding: 6, whiteSpace: "nowrap" }}>
                          <button onClick={() => saveEdit(inv.id)} style={{ background: T.gold, border: "none", borderRadius: 5, padding: "5px 9px", color: "#20180a", fontWeight: 600, fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
                          <button onClick={cancelEdit} style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "5px 9px", color: T.muted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "8px", color: T.bone }}>{inv.display_name}</td>
                        <td style={{ padding: "8px", color: T.boneDim }}>{inv.username}</td>
                        <td style={{ padding: "8px" }}>{Math.round(inv.ratio * 100)}%</td>
                        <td style={{ padding: "8px", color: inv.taxApplicable !== false ? T.emerald : T.muted }}>{inv.taxApplicable !== false ? "Yes" : "No"}</td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                          <button onClick={() => startEdit(inv)} title="Edit" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "5px 7px", color: T.boneDim, cursor: "pointer", marginRight: 6 }}><Pencil size={12} /></button>
                          <button onClick={() => { setPwId(pwId === inv.id ? null : inv.id); setEditingId(null); }} title="Reset password" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "5px 7px", color: T.boneDim, cursor: "pointer" }}><KeyRound size={12} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                  {pwId === inv.id && (
                    <tr style={{ borderBottom: `1px solid ${T.hairline}`, background: T.panel2 }}>
                      <td colSpan={5} style={{ padding: "10px 8px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: T.muted }}>New password for {inv.display_name}:</span>
                          <input type="text" style={{ ...cellIn, width: 180 }} value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="min. 6 characters" />
                          <button onClick={() => resetPassword(inv.id)} disabled={pwValue.length < 6} style={{ background: T.gold, border: "none", borderRadius: 5, padding: "6px 12px", color: "#20180a", fontWeight: 600, fontSize: 11.5, cursor: pwValue.length < 6 ? "not-allowed" : "pointer", opacity: pwValue.length < 6 ? 0.5 : 1 }}>Set password</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {investorsList.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 18, textAlign: "center", color: T.muted }}>No investors yet — add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}

/* ---------------- Add Trade ---------------- */
function AddTrade({ investorsList, onChanged }) {
  const [form, setForm] = useState({ userId: "", script: "", buyDate: "", qty: "", buyPrice: "", closed: false, sellDate: "", sellPrice: "" });
  const [status, setStatus] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.addTrade({
        userId: Number(form.userId), script: form.script, buyDate: form.buyDate || null,
        qty: Number(form.qty), buyPrice: Number(form.buyPrice),
        sellDate: form.closed ? form.sellDate || null : null,
        sellPrice: form.closed ? Number(form.sellPrice) : null,
      });
      setStatus({ tone: "ok", msg: `Trade added for ${form.script}.` });
      setForm({ userId: form.userId, script: "", buyDate: "", qty: "", buyPrice: "", closed: false, sellDate: "", sellPrice: "" });
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  return (
    <Section icon={TrendingUp} title="Add Trade" subtitle="Log a buy — leave it open, or fill in the sell to log it as already closed.">
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <Dropdown label="Investor" value={form.userId} onChange={(v) => setForm({ ...form, userId: v })}
            options={[{ value: "", label: "Select investor…" }, ...investorsList.map((i) => ({ value: i.id, label: i.display_name }))]} />
        </div>
        <Field label="Script" required value={form.script} onChange={set("script")} placeholder="e.g. ISWL" />
        <Field label="Buy date" type="date" value={form.buyDate} onChange={set("buyDate")} />
        <Field label="Quantity" required type="number" step="any" value={form.qty} onChange={set("qty")} />
        <Field label="Buy price" required type="number" step="any" value={form.buyPrice} onChange={set("buyPrice")} />

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.boneDim }}>
          <input type="checkbox" checked={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.checked })} />
          This position is already closed
        </label>

        {form.closed && (
          <>
            <Field label="Sell date" type="date" value={form.sellDate} onChange={set("sellDate")} />
            <Field label="Sell price" required type="number" step="any" value={form.sellPrice} onChange={set("sellPrice")} />
          </>
        )}

        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" disabled={!form.userId} style={{ background: T.gold, border: "none", borderRadius: 8, padding: "10px 18px", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: form.userId ? "pointer" : "not-allowed", opacity: form.userId ? 1 : 0.5 }}>Add trade</button>
        </div>
      </form>
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}

/* ---------------- Edit / Manage Trades ---------------- */
function EditTrades({ investorsList, onChanged }) {
  const [userId, setUserId] = useState("");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState(null);

  async function loadTrades(uid) {
    if (!uid) { setTrades([]); return; }
    setLoading(true);
    setStatus(null);
    try {
      const rows = await api.listTrades(uid);
      setTrades(rows);
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  function onPickInvestor(v) {
    setUserId(v);
    setEditingId(null);
    loadTrades(v);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setDraft({
      script: t.script,
      buyDate: t.buy_date || "",
      qty: t.qty,
      buyPrice: t.buy_price,
      sellDate: t.sell_date || "",
      sellPrice: t.sell_price ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id) {
    setStatus(null);
    try {
      await api.updateTrade(id, {
        script: draft.script,
        buyDate: draft.buyDate || null,
        qty: Number(draft.qty),
        buyPrice: Number(draft.buyPrice),
        sellDate: draft.sellDate || null,
        sellPrice: draft.sellPrice === "" ? null : Number(draft.sellPrice),
      });
      setStatus({ tone: "ok", msg: "Trade updated." });
      cancelEdit();
      loadTrades(userId);
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  async function removeTrade(id) {
    if (!window.confirm("Delete this trade? This can't be undone.")) return;
    setStatus(null);
    try {
      await api.deleteTrade(id);
      setStatus({ tone: "ok", msg: "Trade deleted." });
      loadTrades(userId);
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  const cellIn = { width: "100%", background: T.ink, border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "5px 7px", color: T.bone, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" };

  return (
    <Section icon={Pencil} title="Manage / Edit Trades" subtitle="Correct or remove trades that were already added or imported — pick an investor, then edit any row directly.">
      <Dropdown label="Investor" value={userId} onChange={onPickInvestor}
        options={[{ value: "", label: "Select investor…" }, ...investorsList.map((i) => ({ value: i.id, label: i.display_name }))]} />

      {loading && <div style={{ color: T.muted, fontSize: 12.5, marginTop: 14 }}>Loading trades…</div>}

      {!loading && userId && (
        <div style={{ overflowX: "auto", marginTop: 16, border: `1px solid ${T.hairline}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
            <thead>
              <tr style={{ color: T.muted, background: T.panel2 }}>
                {["Script", "Buy Date", "Qty", "Buy Price", "Sell Date", "Sell Price", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 8px", borderBottom: `1px solid ${T.hairline}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const editing = editingId === t.id;
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                    {editing ? (
                      <>
                        <td style={{ padding: 6 }}><input style={cellIn} value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input type="date" style={cellIn} value={draft.buyDate} onChange={(e) => setDraft({ ...draft, buyDate: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input type="number" step="any" style={cellIn} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input type="number" step="any" style={cellIn} value={draft.buyPrice} onChange={(e) => setDraft({ ...draft, buyPrice: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input type="date" style={cellIn} value={draft.sellDate} onChange={(e) => setDraft({ ...draft, sellDate: e.target.value })} /></td>
                        <td style={{ padding: 6 }}><input type="number" step="any" style={cellIn} placeholder="open" value={draft.sellPrice} onChange={(e) => setDraft({ ...draft, sellPrice: e.target.value })} /></td>
                        <td style={{ padding: 6, whiteSpace: "nowrap" }}>
                          <button onClick={() => saveEdit(t.id)} style={{ background: T.gold, border: "none", borderRadius: 5, padding: "5px 9px", color: "#20180a", fontWeight: 600, fontSize: 11, cursor: "pointer", marginRight: 6 }}>Save</button>
                          <button onClick={cancelEdit} style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "5px 9px", color: T.muted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "8px", color: T.bone }}>{t.script}</td>
                        <td style={{ padding: "8px" }}>{t.buy_date || "—"}</td>
                        <td style={{ padding: "8px" }}>{t.qty}</td>
                        <td style={{ padding: "8px" }}>{t.buy_price}</td>
                        <td style={{ padding: "8px" }}>{t.sell_date || "—"}</td>
                        <td style={{ padding: "8px" }}>{t.sell_price ?? "open"}</td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                          <button onClick={() => startEdit(t)} title="Edit" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "5px 7px", color: T.boneDim, cursor: "pointer", marginRight: 6 }}><Pencil size={12} /></button>
                          <button onClick={() => removeTrade(t.id)} title="Delete" style={{ background: "none", border: `1px solid ${T.terracotta}55`, borderRadius: 5, padding: "5px 7px", color: T.terracotta, cursor: "pointer" }}><Trash2 size={12} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {trades.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 18, textAlign: "center", color: T.muted }}>No trades for this investor yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}

/* ---------------- Balance Settlement ---------------- */
function BalanceSettlement({ investorsList, onChanged }) {
  const [userId, setUserId] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ settlementDate: "", amount: "", note: "" });
  const [status, setStatus] = useState(null);

  const cellIn = { width: "100%", background: T.ink, border: `1px solid ${T.hairline}`, borderRadius: 5, padding: "6px 8px", color: T.bone, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" };

  async function loadFor(id) {
    setUserId(id);
    setStatus(null);
    if (!id) { setSettlements([]); return; }
    setLoading(true);
    try {
      const rows = await api.listSettlements(id);
      setSettlements(rows);
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.addSettlement({
        userId: Number(userId), settlementDate: form.settlementDate,
        amount: form.amount === "" ? null : Number(form.amount), note: form.note || null,
      });
      setStatus({ tone: "ok", msg: "Settlement recorded." });
      setForm({ settlementDate: "", amount: "", note: "" });
      loadFor(userId);
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  async function remove(id) {
    setStatus(null);
    try {
      await api.deleteSettlement(id);
      loadFor(userId);
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  const selectedInvestor = investorsList.find((i) => String(i.id) === String(userId));
  const managerCut = selectedInvestor?.summary?.managerRealized || 0;
  const totalSettled = settlements.reduce((s, r) => s + (r.amount || 0), 0);
  const outstanding = managerCut - totalSettled;

  return (
    <Section icon={HandCoins} title="Balance Settlement" subtitle="Balance Settlement = manager's cut of realized profit minus what's already been settled. Once an investor has any entry on file, their dashboard swaps the Tax card for this.">
      <div style={{ marginBottom: 16 }}>
        <Dropdown label="Investor" value={userId} onChange={loadFor}
          options={[{ value: "", label: "Select investor…" }, ...investorsList.map((i) => ({ value: String(i.id), label: i.display_name }))]} />
      </div>

      {userId && !loading && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
          <div><span style={{ color: T.muted }}>Manager's cut (realized): </span><span style={{ color: T.bone }}>{fmtINR(managerCut)}</span></div>
          <div><span style={{ color: T.muted }}>Already settled: </span><span style={{ color: T.bone }}>{fmtINR(totalSettled)}</span></div>
          <div><span style={{ color: T.muted }}>Outstanding: </span><span style={{ color: Math.abs(outstanding) < 1 ? T.emerald : outstanding > 0 ? T.terracotta : T.emerald }}>{Math.abs(outstanding) < 1 ? "Fully settled" : fmtINR(Math.abs(outstanding)) + (outstanding > 0 ? " due from investor" : " refund owed to investor")}</span></div>
        </div>
      )}


      {userId && (
        <>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
            <Field label="Settlement date" required type="date" value={form.settlementDate} onChange={(e) => setForm({ ...form, settlementDate: e.target.value })} />
            <Field label="Amount (optional)" type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 125000" />
            <Field label="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Paid via NEFT" />
            <button type="submit" disabled={!form.settlementDate} style={{ background: T.gold, border: "none", borderRadius: 8, padding: "10px 18px", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: form.settlementDate ? "pointer" : "not-allowed", opacity: form.settlementDate ? 1 : 0.5, height: 37 }}>Record settlement</button>
          </form>

          {loading ? (
            <div style={{ color: T.muted, fontSize: 12.5 }}>Loading…</div>
          ) : (
            <div style={{ overflowX: "auto", border: `1px solid ${T.hairline}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: T.muted, background: T.panel2 }}>
                    {["Date", "Amount", "Note", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "7px 8px", borderBottom: `1px solid ${T.hairline}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                      <td style={{ padding: "8px", color: T.bone }}>{s.settlement_date}</td>
                      <td style={{ padding: "8px", color: T.boneDim }}>{s.amount != null ? fmtINR(s.amount) : "—"}</td>
                      <td style={{ padding: "8px", color: T.boneDim }}>{s.note || "—"}</td>
                      <td style={{ padding: "8px" }}>
                        <button onClick={() => remove(s.id)} title="Delete" style={{ background: "none", border: `1px solid ${T.terracotta}55`, borderRadius: 5, padding: "5px 7px", color: T.terracotta, cursor: "pointer" }}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                  {settlements.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 18, textAlign: "center", color: T.muted }}>No settlements recorded for this investor yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}

/* ---------------- Import Excel/CSV ---------------- */
function ImportExcel({ investorsList, onChanged }) {
  const [preview, setPreview] = useState(null); // parsed rows before confirming
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  // Accepts a sheet with columns (any case/order): username, script, buyDate,
  // qty, buyPrice, sellDate, sellPrice — matching your existing ledger layout.
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const normalized = json.map((row) => {
          const get = (...keys) => {
            for (const k of Object.keys(row)) {
              if (keys.includes(k.trim().toLowerCase())) return row[k];
            }
            return "";
          };
          const asDate = (v) => {
            if (!v) return "";
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            return String(v);
          };
          return {
            username: String(get("username", "investor", "user")).trim(),
            script: String(get("script", "scrip", "stock")).trim(),
            buyDate: asDate(get("buydate", "buy date")),
            qty: get("qty", "quantity"),
            buyPrice: get("buyprice", "buy price", "price"),
            sellDate: asDate(get("selldate", "sell date")),
            sellPrice: get("sellprice", "sell price"),
          };
        }).filter((r) => r.username && r.script && r.qty && r.buyPrice);
        setPreview(normalized);
      } catch (err) {
        setStatus({ tone: "err", msg: "Could not read that file — make sure it's a .xlsx, .xls, or .csv with the expected columns." });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.bulkImportTrades(preview);
      setStatus({
        tone: result.skipped.length ? "err" : "ok",
        msg: `Imported ${result.inserted} trade(s).` + (result.skipped.length ? ` ${result.skipped.length} skipped — ${result.skipped.map((s) => `row ${s.row}: ${s.reason}`).join("; ")}` : ""),
      });
      if (result.inserted) { setPreview(null); if (fileRef.current) fileRef.current.value = ""; onChanged(); }
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section icon={Upload} title="Import from Excel / CSV" subtitle="Bring in trades in bulk from a spreadsheet shaped like your existing ledger.">
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.6 }}>
        Expected columns (any order, case-insensitive): <b style={{ color: T.boneDim }}>username, script, buyDate, qty, buyPrice</b>, and optionally <b style={{ color: T.boneDim }}>sellDate, sellPrice</b> for already-closed trades.
        The <b style={{ color: T.boneDim }}>username</b> must match an investor already added above.
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
        style={{ fontSize: 12.5, color: T.boneDim }} />

      {preview && (
        <>
          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, color: T.muted }}>{preview.length} row(s) ready to import — check this before confirming:</div>
          <div style={{ overflowX: "auto", maxHeight: 240, overflowY: "auto", border: `1px solid ${T.hairline}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>
              <thead>
                <tr style={{ color: T.muted, position: "sticky", top: 0, background: T.panel2 }}>
                  {["username", "script", "buyDate", "qty", "buyPrice", "sellDate", "sellPrice"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.hairline}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    {["username", "script", "buyDate", "qty", "buyPrice", "sellDate", "sellPrice"].map((k) => (
                      <td key={k} style={{ padding: "6px 8px", borderBottom: `1px solid ${T.hairline}`, color: T.bone }}>{r[k] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={confirmImport} disabled={busy} style={{ marginTop: 12, background: T.gold, border: "none", borderRadius: 8, padding: "10px 18px", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Importing…" : `Confirm import of ${preview.length} trade(s)`}
          </button>
        </>
      )}
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}

/* ---------------- Ticker Map ---------------- */
function TickerMap({ onChanged }) {
  const [script, setScript] = useState("");
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.setTickerMap(script, symbol);
      setStatus({ tone: "ok", msg: `${script} will now price from ${symbol}.` });
      setScript(""); setSymbol("");
      onChanged();
    } catch (err) {
      setStatus({ tone: "err", msg: err.message });
    }
  }

  return (
    <Section icon={Link2} title="Map a Script to a Price Feed" subtitle="Tells the live-price refresh which Yahoo Finance symbol to fetch for a script name, e.g. ISWL → ISWL.NS.">
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <Field label="Script name" required value={script} onChange={(e) => setScript(e.target.value)} placeholder="e.g. ISWL" />
        <Field label="Yahoo Finance symbol" required value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. ISWL.NS" />
        <button type="submit" style={{ background: T.gold, border: "none", borderRadius: 8, padding: "10px 18px", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: "pointer", height: 37 }}>Save mapping</button>
      </form>
      {status && <Banner tone={status.tone}>{status.msg}</Banner>}
    </Section>
  );
}
