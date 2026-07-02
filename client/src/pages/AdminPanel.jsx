import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { UserPlus, TrendingUp, Upload, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
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
      <AddTrade investorsList={investorsList} onChanged={onChanged} />
      <ImportExcel investorsList={investorsList} onChanged={onChanged} />
      <TickerMap onChanged={onChanged} />
    </div>
  );
}

/* ---------------- Add Investor ---------------- */
function AddInvestor({ onChanged }) {
  const [form, setForm] = useState({ username: "", password: "", displayName: "", ratio: "30" });
  const [status, setStatus] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.addInvestor({
        username: form.username, password: form.password, displayName: form.displayName,
        ratio: Number(form.ratio) / 100,
      });
      setStatus({ tone: "ok", msg: `${form.displayName} added. They can sign in with username "${form.username.toLowerCase()}".` });
      setForm({ username: "", password: "", displayName: "", ratio: "30" });
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
        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" style={{ background: T.gold, border: "none", borderRadius: 8, padding: "10px 18px", color: "#20180a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add investor</button>
        </div>
      </form>
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
