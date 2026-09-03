import { Router } from "express";
import bcrypt from "bcryptjs";
import { get, all, run, runBatch } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { rowFromTrade, summarize } from "../services/pnl.js";
import { getCmpMap, getAllCachedPrices } from "../services/priceFeed.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Quick-glance totals for every investor
router.get("/investors", async (req, res) => {
  const users = await all("SELECT id, username, display_name, ratio, tax_rate, tax_applicable, joined_on FROM users WHERE role = 'investor'");
  const cmpMap = await getCmpMap();
  const out = await Promise.all(
    users.map(async (u) => {
      const trades = await all("SELECT * FROM trades WHERE user_id = ?", [u.id]);
      const rows = trades.map((t) => rowFromTrade(t, cmpMap[t.script] ?? null, u.ratio));
      const summary = summarize(rows, u.ratio, !!u.tax_applicable);
      const latestSettlement = await get(
        "SELECT settlement_date, amount, note FROM settlements WHERE user_id = ? ORDER BY settlement_date DESC, id DESC LIMIT 1",
        [u.id]
      );
      return { ...u, taxApplicable: !!u.tax_applicable, settlement: latestSettlement, summary };
    })
  );
  res.json(out);
});

// Add a new investor account
router.post("/investors", async (req, res) => {
  const { username, password, displayName, ratio, taxRate, taxApplicable } = req.body || {};
  if (!username || !password || !displayName || ratio == null) {
    return res.status(400).json({ error: "username, password, displayName and ratio are required" });
  }
  const password_hash = bcrypt.hashSync(password, 12);
  const info = await run(
    `INSERT INTO users (username, password_hash, display_name, role, ratio, tax_rate, tax_applicable, joined_on)
     VALUES (?, ?, ?, 'investor', ?, ?, ?, date('now'))`,
    [username.trim().toLowerCase(), password_hash, displayName, ratio, taxRate || 0, taxApplicable === false ? 0 : 1]
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Edit an existing investor's details — name, profit-share ratio, username,
// or whether tax is applicable to them at all.
// Password is changed separately via /investors/:id/password.
router.patch("/investors/:id", async (req, res) => {
  const { displayName, ratio, username, taxApplicable } = req.body || {};
  const existing = await get("SELECT id FROM users WHERE id = ? AND role = 'investor'", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Investor not found" });

  const fields = [];
  const values = [];
  if (displayName != null && displayName !== "") { fields.push("display_name = ?"); values.push(displayName); }
  if (ratio != null && ratio !== "") { fields.push("ratio = ?"); values.push(Number(ratio)); }
  if (username != null && username !== "") { fields.push("username = ?"); values.push(String(username).trim().toLowerCase()); }
  if (typeof taxApplicable === "boolean") { fields.push("tax_applicable = ?"); values.push(taxApplicable ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: "Nothing to update" });

  try {
    await run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, [...values, req.params.id]);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "That username is already taken" });
    throw err;
  }
  res.json({ ok: true });
});

// Admin can reset any investor's password directly (e.g. they forgot it).
router.post("/investors/:id/password", async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const info = await run(
    "UPDATE users SET password_hash = ? WHERE id = ? AND role = 'investor'",
    [bcrypt.hashSync(password, 12), req.params.id]
  );
  if (info.changes === 0) return res.status(404).json({ error: "Investor not found" });
  res.json({ ok: true });
});

// Add a trade (buy, or buy+sell if closing a position immediately)
router.post("/trades", async (req, res) => {
  const { userId, script, buyDate, qty, buyPrice, sellDate, sellPrice, notes } = req.body || {};
  if (!userId || !script || !qty || !buyPrice) {
    return res.status(400).json({ error: "userId, script, qty and buyPrice are required" });
  }
  const info = await run(
    `INSERT INTO trades (user_id, script, buy_date, qty, buy_price, sell_date, sell_price, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, script, buyDate || null, qty, buyPrice, sellDate || null, sellPrice || null, notes || null]
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Bulk import trades — used by the "Import from Excel/CSV" screen. The
// client parses the spreadsheet in the browser (so any .xlsx/.csv layout
// works) and sends plain rows here.
// Each row: { username, script, buyDate, qty, buyPrice, sellDate?, sellPrice? }
router.post("/trades/bulk", async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows must be a non-empty array" });
  }

  // Resolve usernames -> user ids up front (one query), then batch-insert
  // everything that's valid in a single atomic transaction.
  const users = await all("SELECT id, username FROM users");
  const byUsername = new Map(users.map((u) => [u.username, u.id]));

  const results = { inserted: 0, skipped: [] };
  const statements = [];
  rows.forEach((row, i) => {
    const uname = String(row.username || "").trim().toLowerCase();
    const userId = byUsername.get(uname);
    if (!userId) { results.skipped.push({ row: i + 1, reason: `Unknown username "${row.username}"` }); return; }
    if (!row.script || !row.qty || !row.buyPrice) { results.skipped.push({ row: i + 1, reason: "Missing script, qty, or buyPrice" }); return; }
    statements.push({
      sql: `INSERT INTO trades (user_id, script, buy_date, qty, buy_price, sell_date, sell_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId, String(row.script).trim(), row.buyDate || null,
        Number(row.qty), Number(row.buyPrice),
        row.sellDate || null, row.sellPrice ? Number(row.sellPrice) : null,
      ],
    });
  });

  if (statements.length) await runBatch(statements);
  results.inserted = statements.length;

  res.json(results);
});

// Close an existing open trade
router.patch("/trades/:id/close", async (req, res) => {
  const { sellDate, sellPrice } = req.body || {};
  if (!sellPrice) return res.status(400).json({ error: "sellPrice is required" });
  await run(
    "UPDATE trades SET sell_date = ?, sell_price = ? WHERE id = ?",
    [sellDate || new Date().toISOString().slice(0, 10), sellPrice, req.params.id]
  );
  res.json({ ok: true });
});

// List every trade for one investor — used by the "Manage / Edit Trades"
// admin screen so previously-uploaded data can be corrected.
router.get("/trades", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId query param is required" });
  const trades = await all("SELECT * FROM trades WHERE user_id = ? ORDER BY buy_date DESC, id DESC", [userId]);
  res.json(trades);
});

// Full edit of an existing trade (script, dates, qty, prices). Send null /
// empty string for sellDate & sellPrice to re-open a previously closed trade.
router.patch("/trades/:id", async (req, res) => {
  const { script, buyDate, qty, buyPrice, sellDate, sellPrice } = req.body || {};
  if (!script || !qty || buyPrice == null) {
    return res.status(400).json({ error: "script, qty and buyPrice are required" });
  }
  const info = await run(
    `UPDATE trades SET script = ?, buy_date = ?, qty = ?, buy_price = ?, sell_date = ?, sell_price = ?
     WHERE id = ?`,
    [script.trim(), buyDate || null, qty, buyPrice, sellDate || null, sellPrice || null, req.params.id]
  );
  if (info.changes === 0) return res.status(404).json({ error: "Trade not found" });
  res.json({ ok: true });
});

// Delete a trade entirely (e.g. it was uploaded in error)
router.delete("/trades/:id", async (req, res) => {
  const info = await run("DELETE FROM trades WHERE id = ?", [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: "Trade not found" });
  res.json({ ok: true });
});

// Map a script name to a Yahoo Finance symbol (e.g. "ISWL" -> "ISWL.NS")
router.post("/ticker-map", async (req, res) => {
  const { script, yahooSymbol } = req.body || {};
  if (!script || !yahooSymbol) return res.status(400).json({ error: "script and yahooSymbol are required" });
  await run(
    `INSERT INTO ticker_map (script, yahoo_symbol) VALUES (?, ?)
     ON CONFLICT(script) DO UPDATE SET yahoo_symbol = excluded.yahoo_symbol`,
    [script, yahooSymbol]
  );
  res.json({ ok: true });
});

router.get("/prices", async (req, res) => {
  res.json(await getAllCachedPrices());
});

// List every settlement recorded for one investor (most recent first) —
// used by the "Balance Settlement" admin screen.
router.get("/settlements", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId query param is required" });
  const rows = await all("SELECT * FROM settlements WHERE user_id = ? ORDER BY settlement_date DESC, id DESC", [userId]);
  res.json(rows);
});

// Record a settlement of balance between manager and investor. `direction`
// is 'to_manager' (investor paid the manager) or 'to_investor' (manager
// paid/refunded the investor).
router.post("/settlements", async (req, res) => {
  const { userId, settlementDate, amount, direction, note } = req.body || {};
  if (!userId || !settlementDate) return res.status(400).json({ error: "userId and settlementDate are required" });
  if (direction && !["to_manager", "to_investor"].includes(direction)) {
    return res.status(400).json({ error: "direction must be 'to_manager' or 'to_investor'" });
  }
  const user = await get("SELECT id FROM users WHERE id = ? AND role = 'investor'", [userId]);
  if (!user) return res.status(404).json({ error: "Investor not found" });
  const info = await run(
    `INSERT INTO settlements (user_id, settlement_date, amount, direction, note) VALUES (?, ?, ?, ?, ?)`,
    [userId, settlementDate, amount === "" || amount == null ? null : Math.abs(Number(amount)), direction || "to_manager", note || null]
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Remove a settlement entry (e.g. it was logged in error).
router.delete("/settlements/:id", async (req, res) => {
  const info = await run("DELETE FROM settlements WHERE id = ?", [req.params.id]);
  if (info.changes === 0) return res.status(404).json({ error: "Settlement not found" });
  res.json({ ok: true });
});

export default router;
