import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { rowFromTrade, summarize, scriptBreakdown } from "../services/pnl.js";
import { getCmpForScript } from "../services/priceFeed.js";

const router = Router();

function latestSettlementFor(userId) {
  return db.prepare("SELECT settlement_date, amount, note FROM settlements WHERE user_id = ? ORDER BY settlement_date DESC, id DESC LIMIT 1").get(userId) || null;
}

function loadInvestorData(userId) {
  const user = db.prepare("SELECT id, display_name, ratio, tax_applicable FROM users WHERE id = ? AND role = 'investor'").get(userId);
  if (!user) return null;
  const trades = db.prepare("SELECT * FROM trades WHERE user_id = ? ORDER BY buy_date").all(userId);
  const rows = trades.map((t) => ({ ...rowFromTrade(t, getCmpForScript(t.script), user.ratio), investorId: user.id, investorName: user.display_name }));
  return { user, rows };
}

function sumSummaries(list) {
  const keys = ["realized", "unrealized", "grossTotal", "invested", "currentValue", "managerRealized", "managerUnrealized",
    "investorRealized", "investorUnrealized", "investorTotal", "taxRealized", "taxUnrealized",
    "investorRealizedAfterTax", "investorUnrealizedAfterTax", "investorTotalAfterTax"];
  const out = {};
  for (const k of keys) out[k] = list.reduce((s, x) => s + (x.summary[k] || 0), 0);
  out.taxByFY = [];   // per-investor FY breakdowns don't combine meaningfully across different ratios/holdings
  out.carryForward = { stcl: list.reduce((s, x) => s + x.summary.carryForward.stcl, 0), ltcl: list.reduce((s, x) => s + x.summary.carryForward.ltcl, 0) };
  return out;
}

// Investors can only ever see their own userId. Admins may pass ?userId=
// to view anyone, or ?userId=all to see every investor combined.
router.get("/", requireAuth, (req, res) => {
  const view = req.query.view === "gross" ? "gross" : "net";
  const metric = ["realized", "unrealized", "combined"].includes(req.query.metric) ? req.query.metric : "combined";

  let targetUserId = req.user.id;
  if (req.query.userId) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "You can only view your own positions" });
    targetUserId = req.query.userId;
  }

  if (targetUserId === "all") {
    const investors = db.prepare("SELECT id FROM users WHERE role = 'investor'").all();
    const perInvestor = investors.map((i) => loadInvestorData(i.id)).filter(Boolean)
      .map((d) => ({ ...d, summary: summarize(d.rows, d.user.ratio) }));

    const rows = perInvestor.flatMap((d) => d.rows);
    const summary = sumSummaries(perInvestor);
    const scriptData = scriptBreakdown(rows, metric, view);

    return res.json({
      // "All investors" combines different tax/settlement statuses, so the
      // tax card is shown as normal here rather than trying to merge them.
      investor: { id: "all", name: "All Investors (combined)", ratio: null, taxApplicable: true, settlement: null },
      rows, summary, scriptData,
    });
  }

  const data = loadInvestorData(Number(targetUserId));
  if (!data) return res.status(404).json({ error: "Investor not found" });

  const summary = summarize(data.rows, data.user.ratio);
  const scriptData = scriptBreakdown(data.rows, metric, view);

  res.json({
    investor: {
      id: data.user.id, name: data.user.display_name, ratio: data.user.ratio,
      taxApplicable: !!data.user.tax_applicable,
      settlement: latestSettlementFor(data.user.id),
    },
    rows: data.rows,
    summary,
    scriptData,
  });
});

export default router;
