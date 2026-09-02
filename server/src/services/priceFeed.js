import fetch from "node-fetch";
import { get, all, run } from "../db.js";

/**
 * Free, no-signup delayed quotes via Yahoo Finance's public chart endpoint.
 * Typical delay: 15-20 minutes for NSE/BSE tickers. No API key required,
 * but Yahoo may occasionally rate-limit — the cache means the site keeps
 * working with the last known price if a fetch fails.
 *
 * Ticker format for Indian equities: "TCS.NS" (NSE) or "TCS.BO" (BSE).
 * Map your internal script names to the right symbol in ticker_map.
 */

async function upsertPrice(symbol, price) {
  await run(
    `INSERT INTO price_cache (symbol, price, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(symbol) DO UPDATE SET price = excluded.price, updated_at = datetime('now')`,
    [symbol, price]
  );
}

async function fetchOne(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioPortal/1.0)" },
  });
  if (!res.ok) throw new Error(`Price fetch failed for ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number") throw new Error(`No price in response for ${symbol}`);
  return price;
}

export async function refreshAllPrices() {
  const rows = await all("SELECT DISTINCT yahoo_symbol FROM ticker_map");
  const symbols = rows.map((r) => r.yahoo_symbol);
  const results = { ok: [], failed: [] };
  for (const symbol of symbols) {
    try {
      const price = await fetchOne(symbol);
      await upsertPrice(symbol, price);
      results.ok.push({ symbol, price });
    } catch (err) {
      results.failed.push({ symbol, error: err.message });
    }
    // gentle pacing so we don't hammer the free endpoint
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}

export async function getCmpForScript(script) {
  const map = await get("SELECT yahoo_symbol FROM ticker_map WHERE script = ?", [script]);
  if (!map) return null;
  const row = await get("SELECT price FROM price_cache WHERE symbol = ?", [map.yahoo_symbol]);
  return row ? row.price : null;
}

// Fetches every script -> current price in one round trip, so callers that
// need the CMP for many trades (e.g. building a whole investor's position
// list) don't do one network call per trade. Returns a plain object:
// { [script]: price | null }
export async function getCmpMap() {
  const rows = await all(`
    SELECT tm.script, pc.price
    FROM ticker_map tm LEFT JOIN price_cache pc ON pc.symbol = tm.yahoo_symbol
  `);
  const out = {};
  for (const r of rows) out[r.script] = r.price ?? null;
  return out;
}

export async function getAllCachedPrices() {
  return all(`
    SELECT tm.script, tm.yahoo_symbol, pc.price, pc.updated_at
    FROM ticker_map tm LEFT JOIN price_cache pc ON pc.symbol = tm.yahoo_symbol
  `);
}
