// Pure calculation helpers — no DB or network calls, easy to unit test.

// Indian equity capital gains rates (as instructed): LTCG applies once a
// position has been held 365 days or more; anything shorter is STCG.
// Tax only ever applies to a gain — losses are never taxed here.
export const LTCG_RATE = 0.125;
export const STCG_RATE = 0.20;
const HOLD_DAYS_FOR_LTCG = 365;

function holdingDays(buyDate, endDate) {
  if (!buyDate) return 0;
  const start = new Date(buyDate);
  const end = endDate ? new Date(endDate) : new Date();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function taxRateFor(buyDate, endDate) {
  return holdingDays(buyDate, endDate) >= HOLD_DAYS_FOR_LTCG ? LTCG_RATE : STCG_RATE;
}

export function rowFromTrade(trade, cmp, ratio) {
  const isOpen = trade.sell_date == null || trade.sell_price == null;
  const invested = trade.qty * trade.buy_price;
  const exitPrice = isOpen ? cmp ?? trade.buy_price : trade.sell_price;
  const value = trade.qty * exitPrice;
  const profit = value - invested;

  // Tax is computed on the INVESTOR's post-share portion of the gain.
  // For open positions this is a projection ("if sold today"), since the
  // holding clock and price are both still moving.
  const investorProfit = profit * (1 - ratio);
  const gainType = holdingDays(trade.buy_date, isOpen ? null : trade.sell_date) >= HOLD_DAYS_FOR_LTCG ? "LTCG" : "STCG";
  const taxRate = taxRateFor(trade.buy_date, isOpen ? null : trade.sell_date);
  const taxAmount = investorProfit > 0 ? investorProfit * taxRate : 0;

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
    profit,
    gainType,        // "LTCG" (12.5%) or "STCG" (20%), based on 365-day holding
    taxRate,
    investorShare: investorProfit,
    taxAmount,
    investorNetAfterTax: investorProfit - taxAmount,
  };
}

export function summarize(rows, ratio) {
  const realized = rows.filter((r) => r.status === "closed").reduce((s, r) => s + r.profit, 0);
  const unrealized = rows.filter((r) => r.status === "open").reduce((s, r) => s + r.profit, 0);
  const invested = rows.filter((r) => r.status === "open").reduce((s, r) => s + r.invested, 0);
  const currentValue = rows.filter((r) => r.status === "open").reduce((s, r) => s + r.value, 0);
  const investorRealized = realized * (1 - ratio);
  const investorUnrealized = unrealized * (1 - ratio);
  const taxRealized = rows.filter((r) => r.status === "closed").reduce((s, r) => s + r.taxAmount, 0);
  const taxUnrealized = rows.filter((r) => r.status === "open").reduce((s, r) => s + r.taxAmount, 0);

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
    taxUnrealized,          // projected tax if open positions were sold today
    investorRealizedAfterTax: investorRealized - taxRealized,
    investorUnrealizedAfterTax: investorUnrealized - taxUnrealized,
    investorTotalAfterTax: (investorRealized - taxRealized) + (investorUnrealized - taxUnrealized),
  };
}

export function scriptBreakdown(rows, metric, ratio, view) {
  const map = {};
  for (const r of rows) {
    if (metric === "realized" && r.status !== "closed") continue;
    if (metric === "unrealized" && r.status !== "open") continue;
    const val = view === "net" ? r.profit * (1 - ratio) : r.profit;
    map[r.script] = (map[r.script] || 0) + val;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}
