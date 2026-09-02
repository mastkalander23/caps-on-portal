import { Router } from "express";
import { get, all } from "../db.js";
import { requireAuth } from "../auth.js";
import { rowFromTrade, summarize, scriptBreakdown } from "../services/pnl.js";
import { getCmpMap } from "../services/priceFeed.js";

const router = Router();

// All settlement rows for one investor, most recent first.
async function settlementsFor(userId) {
  return all(
    "SELECT settlement_date, amount, direction, note FROM settlements WHERE user_id = ? ORDER BY settlement_date DESC, id DESC",
    [userId]
  );
}

// Balance Settlement = manager's cut (on realized profit — the only part
// that's actually cash-settleable) minus whatever has already been settled
// between the two parties. Each settlement counts towards or against that
// cut depending on which way the money moved:
//   'to_manager'  — investor paid the manager  → reduces outstanding
//   'to_investor' — manager paid/refunded the investor → increases outstanding
// `settlements` must be sorted most-recent-first. Always returns a value
// (even with zero settlements on file) so the card can be shown unconditionally.
function balanceSettlementFor(managerRealized, settlements) {
  const totalSettled = settlements.reduce((s, r) => {
    const amt = r.amount || 0;
    return s + (r.direction === "to_investor" ? -amt : amt);
  }, 0);
  const outstanding = managerRealized - totalSettled;
  return {
    managerCut: managerRealized,
    totalSettled,
    outstanding,
    isSettled: Math.abs(outstanding) < 1, // within a rupee — treat as fully settled
    hasEntries: settlements.length > 0,
    lastDate: settlements.length ? settlements[0].settlement_date : null,
    lastAmount: settlements.length ? settlements[0].amount : null,
    lastDirection: settlements.length ? settlements[0].direction : null,
    lastNote: settlements.length ? settlements[0].note : null,
  };
}

async function loadInvestorData(userId, cmpMap) {
  const user = await get("SELECT id, display_name, ratio, tax_applicable FROM users WHERE id = ? AND role = 'investor'", [userId]);
  if (!user) return null;
  const trades = await all("SELECT * FROM trades WHERE user_id = ? ORDER BY buy_date", [userId]);
  const rows = trades.map((t) => ({ ...rowFromTrade(t, cmpMap[t.script] ?? null, user.ratio), investorId: user.id, investorName: user.display_name }));
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
router.get("/", requireAuth, async (req, res) => {
  const view = req.query.view === "gross" ? "gross" : "net";
  const metric = ["realized", "unrealized", "combined"].includes(req.query.metric) ? req.query.metric : "combined";

  let targetUserId = req.user.id;
  if (req.query.userId) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "You can only view your own positions" });
    targetUserId = req.query.userId;
  }

  const cmpMap = await getCmpMap();

  if (targetUserId === "all") {
    const investors = await all("SELECT id FROM users WHERE role = 'investor'");
    const perInvestorRaw = await Promise.all(investors.map((i) => loadInvestorData(i.id, cmpMap)));
    const perInvestor = perInvestorRaw.filter(Boolean)
      .map((d) => ({ ...d, summary: summarize(d.rows, d.user.ratio) }));

    const rows = perInvestor.flatMap((d) => d.rows);
    const summary = sumSummaries(perInvestor);
    const scriptData = scriptBreakdown(rows, metric, view);

    // Combine every investor's settlements into one pool so the top card can
    // still swap to Balance Settlement when viewing everyone at once.
    const settlementsPerInvestor = await Promise.all(
      perInvestor.map((d) => settlementsFor(d.user.id).then((rows) => rows.map((s) => ({ ...s, userId: d.user.id }))))
    );
    const allSettlements = settlementsPerInvestor.flat()
      .sort((a, b) => (a.settlement_date < b.settlement_date ? 1 : -1));
    const settlement = balanceSettlementFor(summary.managerRealized, allSettlements);

    return res.json({
      investor: { id: "all", name: "All Investors (combined)", ratio: null, taxApplicable: true, settlement },
      rows, summary, scriptData,
    });
  }

  const data = await loadInvestorData(Number(targetUserId), cmpMap);
  if (!data) return res.status(404).json({ error: "Investor not found" });

  const summary = summarize(data.rows, data.user.ratio);
  const scriptData = scriptBreakdown(data.rows, metric, view);
  const settlement = balanceSettlementFor(summary.managerRealized, await settlementsFor(data.user.id));

  res.json({
    investor: {
      id: data.user.id, name: data.user.display_name, ratio: data.user.ratio,
      taxApplicable: !!data.user.tax_applicable,
      settlement,
    },
    rows: data.rows,
    summary,
    scriptData,
  });
});

export default router;
