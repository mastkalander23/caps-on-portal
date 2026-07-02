import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rowFromTrade, summarize } from "../services/pnl.js";
import { getCmpForScript, refreshAllPrices, getAllCachedPrices } from "../services/priceFeed.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Quick-glance totals for every investor
router.get("/investors", (req, res) => {
  const users = db.prepare("SELECT id, username, display_name, ratio, tax_rate, joined_on FROM users WHERE role = 'investor'").all();
  const out = users.map((u) => {
    const trades = db.prepare("SELECT * FROM trades WHERE user_id = ?").all(u.id);
    const rows = trades.map((t) => rowFromTrade(t, getCmpForScript(t.script), u.ratio));
    const summary = summarize(rows, u.ratio);
    return { ...u, summary };
  });
  res.json(out);
});

// Add a new investor account
router.post("/investors", (req, res) => {
  const { username, password, displayName, ratio, taxRate } = req.body || {};
  if (!username || !password || !displayName || ratio == null) {
    return res.status(400).json({ error: "username, password, displayName and ratio are required" });
  }
  const password_hash = bcrypt.hashSync(password, 12);
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role, ratio, tax_rate, joined_on)
    VALUES (?, ?, ?, 'investor', ?, ?, date('now'))
  `);
  const info = stmt.run(username.trim().toLowerCase(), password_hash, displayName, ratio, taxRate || 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Add a trade (buy, or buy+sell if closing a position immediately)
router.post("/trades", (req, res) => {
  const { userId, script, buyDate, qty, buyPrice, sellDate, sellPrice, notes } = req.body || {};
  if (!userId || !script || !qty || !buyPrice) {
    return res.status(400).json({ error: "userId, script, qty and buyPrice are required" });
  }
  const stmt = db.prepare(`
    INSERT INTO trades (user_id, script, buy_date, qty, buy_price, sell_date, sell_price, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(userId, script, buyDate || null, qty, buyPrice, sellDate || null, sellPrice || null, notes || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Bulk import trades — used by the "Import from Excel/CSV" screen. The
// client parses the spreadsheet in the browser (so any .xlsx/.csv layout
// works) and sends plain rows here.
// Each row: { username, script, buyDate, qty, buyPrice, sellDate?, sellPrice? }
router.post("/trades/bulk", (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows must be a non-empty array" });
  }

  const findUser = db.prepare("SELECT id FROM users WHERE username = ?");
  const insert = db.prepare(`
    INSERT INTO trades (user_id, script, buy_date, qty, buy_price, sell_date, sell_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const results = { inserted: 0, skipped: [] };
  const runAll = db.transaction((items) => {
    items.forEach((row, i) => {
      const uname = String(row.username || "").trim().toLowerCase();
      const user = findUser.get(uname);
      if (!user) { results.skipped.push({ row: i + 1, reason: `Unknown username "${row.username}"` }); return; }
      if (!row.script || !row.qty || !row.buyPrice) { results.skipped.push({ row: i + 1, reason: "Missing script, qty, or buyPrice" }); return; }
      insert.run(
        user.id, String(row.script).trim(), row.buyDate || null,
        Number(row.qty), Number(row.buyPrice),
        row.sellDate || null, row.sellPrice ? Number(row.sellPrice) : null
      );
      results.inserted += 1;
    });
  });
  runAll(rows);

  res.json(results);
});

// Close an existing open trade
router.patch("/trades/:id/close", (req, res) => {
  const { sellDate, sellPrice } = req.body || {};
  if (!sellPrice) return res.status(400).json({ error: "sellPrice is required" });
  db.prepare("UPDATE trades SET sell_date = ?, sell_price = ? WHERE id = ?")
    .run(sellDate || new Date().toISOString().slice(0, 10), sellPrice, req.params.id);
  res.json({ ok: true });
});

// List every trade for one investor — used by the "Manage / Edit Trades"
// admin screen so previously-uploaded data can be corrected.
router.get("/trades", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId query param is required" });
  const trades = db.prepare("SELECT * FROM trades WHERE user_id = ? ORDER BY buy_date DESC, id DESC").all(userId);
  res.json(trades);
});

// Full edit of an existing trade (script, dates, qty, prices). Send null /
// empty string for sellDate & sellPrice to re-open a previously closed trade.
router.patch("/trades/:id", (req, res) => {
  const { script, buyDate, qty, buyPrice, sellDate, sellPrice } = req.body || {};
  if (!script || !qty || buyPrice == null) {
    return res.status(400).json({ error: "script, qty and buyPrice are required" });
  }
  const info = db.prepare(`
    UPDATE trades SET script = ?, buy_date = ?, qty = ?, buy_price = ?, sell_date = ?, sell_price = ?
    WHERE id = ?
  `).run(script.trim(), buyDate || null, qty, buyPrice, sellDate || null, sellPrice || null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Trade not found" });
  res.json({ ok: true });
});

// Delete a trade entirely (e.g. it was uploaded in error)
router.delete("/trades/:id", (req, res) => {
  const info = db.prepare("DELETE FROM trades WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Trade not found" });
  res.json({ ok: true });
});

// Map a script name to a Yahoo Finance symbol (e.g. "ISWL" -> "ISWL.NS")
router.post("/ticker-map", (req, res) => {
  const { script, yahooSymbol } = req.body || {};
  if (!script || !yahooSymbol) return res.status(400).json({ error: "script and yahooSymbol are required" });
  db.prepare(`
    INSERT INTO ticker_map (script, yahoo_symbol) VALUES (?, ?)
    ON CONFLICT(script) DO UPDATE SET yahoo_symbol = excluded.yahoo_symbol
  `).run(script, yahooSymbol);
  res.json({ ok: true });
});

router.get("/prices", (req, res) => {
  res.json(getAllCachedPrices());
});

router.post("/prices/refresh", async (req, res) => {
  const result = await refreshAllPrices();
  res.json(result);
});

export default router;
