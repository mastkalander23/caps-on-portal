import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { rowFromTrade, summarize, scriptBreakdown } from "../services/pnl.js";
import { getCmpForScript } from "../services/priceFeed.js";

const router = Router();

// Investors can only ever see their own userId. Admins may pass ?userId= to view anyone.
router.get("/", requireAuth, (req, res) => {
  let targetUserId = req.user.id;

  if (req.query.userId) {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "You can only view your own positions" });
    }
    targetUserId = Number(req.query.userId);
  }

  const user = db.prepare("SELECT id, display_name, ratio, tax_rate FROM users WHERE id = ?").get(targetUserId);
  if (!user) return res.status(404).json({ error: "Investor not found" });

  const trades = db.prepare("SELECT * FROM trades WHERE user_id = ? ORDER BY buy_date").all(targetUserId);
  const rows = trades.map((t) => rowFromTrade(t, getCmpForScript(t.script), user.ratio));
  const summary = summarize(rows, user.ratio);

  const view = req.query.view === "gross" ? "gross" : "net";
  const metric = ["realized", "unrealized", "combined"].includes(req.query.metric) ? req.query.metric : "combined";
  const scriptData = scriptBreakdown(rows, metric, user.ratio, view);

  res.json({
    investor: { id: user.id, name: user.display_name, ratio: user.ratio, taxRate: user.tax_rate },
    rows,
    summary,
    scriptData,
  });
});

export default router;
