// Pure calculation helpers — no DB or network calls, easy to unit test.

// Indian equity capital gains rates, as instructed:
export const LTCG_RATE = 0.125;   // held >= 365 days
export const STCG_RATE = 0.20;    // held < 365 days
const HOLD_DAYS_FOR_LTCG = 365;

function holdingDays(buyDate, endDate) {
  if (!buyDate) return 0;
  const start = new Date(buyDate);
  const end = endDate ? new Date(endDate) : new Date();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function gainTypeFor(buyDate, endDate) {
  return holdingDays(buyDate, endDate) >= HOLD_DAYS_FOR_LTCG ? "LTCG" : "STCG";
}

// Indian financial year runs April 1 -> March 31. Returns the starting
// calendar year, e.g. a date of Feb 2026 is FY 2025 ("FY 2025-26").
function fyOf(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 4 ? y : y - 1;
}
function fyLabel(y) {
  return `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export function rowFromTrade(trade, cmp, ratio) {
  const isOpen = trade.sell_date == null || trade.sell_price == null;
  const invested = trade.qty * trade.buy_price;
  const exitPrice = isOpen ? cmp ?? trade.buy_price : trade.sell_price;
  const value = trade.qty * exitPrice;
  const profit = value - invested;
  const investorShare = profit * (1 - ratio);
  const gainType = gainTypeFor(trade.buy_date, isOpen ? null : trade.sell_date);

  return {
    id: trade.id,
    script: trade.script,
    status: isOpen ? "open" : "closed",
    qty: trade.qty,
    buyPrice: trade.buy_price,
    exitPrice,
    buyDate: trade.buy_date,
    sellDate: trade.sell_date,
    invested,
    value,
    profit,             // gross profit/loss on the whole position
    gainType,           // "LTCG" or "STCG", by 365-day holding period
    investorShare,      // investor's post-split profit/loss (pre-tax)
  };
}

/**
 * Nets gains against losses within and across financial years and returns
 * the tax actually payable, following the standard Indian I-T set-off rule:
 *   - STCL can be set off against either STCG or LTCG.
 *   - LTCL can only be set off against LTCG.
 *   - Whatever isn't absorbed in a year carries forward to the next.
 *
 * `rows` must each have { investorShare, gainType, fyDate }.
 */
export function computeTaxEngine(rows) {
  const buckets = {};
  for (const r of rows) {
    const fy = fyOf(r.fyDate);
    buckets[fy] = buckets[fy] || { stcgGain: 0, stcgLoss: 0, ltcgGain: 0, ltcgLoss: 0 };
    const amt = r.investorShare;
    if (r.gainType === "STCG") {
      if (amt >= 0) buckets[fy].stcgGain += amt; else buckets[fy].stcgLoss += -amt;
    } else {
      if (amt >= 0) buckets[fy].ltcgGain += amt; else buckets[fy].ltcgLoss += -amt;
    }
  }

  const years = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  let cfSTCL = 0, cfLTCL = 0;
  const byFY = [];

  for (const y of years) {
    const b = buckets[y];
    const totalSTCL = cfSTCL + b.stcgLoss;
    const totalLTCL = cfLTCL + b.ltcgLoss;

    // LTCL absorbs LTCG first (its only allowed use).
    let taxableLTCG = Math.max(0, b.ltcgGain - totalLTCL);
    let leftoverLTCL = Math.max(0, totalLTCL - b.ltcgGain);

    // STCL absorbs STCG first (natural head)...
    let taxableSTCG = Math.max(0, b.stcgGain - totalSTCL);
    let leftoverSTCL = Math.max(0, totalSTCL - b.stcgGain);

    // ...then any leftover STCL can also reduce LTCG.
    const crossApplied = Math.min(leftoverSTCL, taxableLTCG);
    taxableLTCG -= crossApplied;
    leftoverSTCL -= crossApplied;

    const tax = taxableSTCG * STCG_RATE + taxableLTCG * LTCG_RATE;

    byFY.push({
      fy: fyLabel(y),
      stcgGain: b.stcgGain, stcgLoss: b.stcgLoss,
      ltcgGain: b.ltcgGain, ltcgLoss: b.ltcgLoss,
      taxableSTCG, taxableLTCG, tax,
      stclCarriedForward: leftoverSTCL, ltclCarriedForward: leftoverLTCL,
    });

    cfSTCL = leftoverSTCL;
    cfLTCL = leftoverLTCL;
  }

  return {
    byFY,
    totalTax: byFY.reduce((s, f) => s + f.tax, 0),
    carryForward: { stcl: cfSTCL, ltcl: cfLTCL }, // still unabsorbed, available for future years
  };
}

export function summarize(rows, ratio) {
  const closed = rows.filter((r) => r.status === "closed");
  const open = rows.filter((r) => r.status === "open");

  const realized = closed.reduce((s, r) => s + r.profit, 0);
  const unrealized = open.reduce((s, r) => s + r.profit, 0);
  const invested = open.reduce((s, r) => s + r.invested, 0);
  const currentValue = open.reduce((s, r) => s + r.value, 0);
  const investorRealized = realized * (1 - ratio);
  const investorUnrealized = unrealized * (1 - ratio);

  // Tax on realized trades: net gains/losses across financial years, with
  // carry-forward, using only what's actually been sold.
  const realizedTax = computeTaxEngine(closed.map((r) => ({ ...r, fyDate: r.sellDate })));

  // Tax on the book INCLUDING today's open positions, as if everything were
  // sold today — the difference from realizedTax.totalTax is what the open
  // book currently adds (or saves, if it's carrying losses) in tax terms.
  const today = new Date().toISOString().slice(0, 10);
  const projectedTax = computeTaxEngine([
    ...closed.map((r) => ({ ...r, fyDate: r.sellDate })),
    ...open.map((r) => ({ ...r, fyDate: today })),
  ]);

  const taxRealized = realizedTax.totalTax;
  const taxUnrealized = projectedTax.totalTax - realizedTax.totalTax; // marginal effect of the open book

  return {
    realized,
    unrealized,
    grossTotal: realized + unrealized,
    invested,
    currentValue,
    managerRealized: realized * ratio,
    managerUnrealized: unrealized * ratio,
    investorRealized,
    investorUnrealized,
    investorTotal: investorRealized + investorUnrealized,
    taxRealized,
    taxUnrealized,
    investorRealizedAfterTax: investorRealized - taxRealized,
    investorUnrealizedAfterTax: investorUnrealized - taxUnrealized,
    investorTotalAfterTax: (investorRealized - taxRealized) + (investorUnrealized - taxUnrealized),
    taxByFY: realizedTax.byFY,                 // locked-in, FY-wise breakdown
    carryForward: realizedTax.carryForward,    // real, currently-available carry-forward losses
  };
}

export function scriptBreakdown(rows, metric, view) {
  const map = {};
  for (const r of rows) {
    if (metric === "realized" && r.status !== "closed") continue;
    if (metric === "unrealized" && r.status !== "open") continue;
    const val = view === "gross" ? r.profit : r.investorShare;
    map[r.script] = (map[r.script] || 0) + val;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}
