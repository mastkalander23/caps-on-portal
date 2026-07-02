import fetch from "node-fetch";
import { db } from "../db.js";

/**
 * Free, no-signup delayed quotes via Yahoo Finance's public chart endpoint.
 * Typical delay: 15-20 minutes for NSE/BSE tickers. No API key required,
 * but Yahoo may occasionally rate-limit — the cache means the site keeps
 * working with the last known price if a fetch fails.
 *
 * Ticker format for Indian equities: "TCS.NS" (NSE) or "TCS.BO" (BSE).
 * Map your internal script names to the right symbol in ticker_map.
 */

const upsertPrice = db.prepare(`
  INSERT INTO price_cache (symbol, price, updated_at)
  VALUES (@symbol, @price, datetime('now'))
  ON CONFLICT(symbol) DO UPDATE SET price = @price, updated_at = datetime('now')
`);

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
  const symbols = db.prepare("SELECT DISTINCT yahoo_symbol FROM ticker_map").all().map((r) => r.yahoo_symbol);
  const results = { ok: [], failed: [] };
  for (const symbol of symbols) {
    try {
      const price = await fetchOne(symbol);
      upsertPrice.run({ symbol, price });
      results.ok.push({ symbol, price });
    } catch (err) {
      results.failed.push({ symbol, error: err.message });
    }
    // gentle pacing so we don't hammer the free endpoint
    await new Promise((r) => setTimeout(r, 250));
  }
  return results;
}

export function getCmpForScript(script) {
  const map = db.prepare("SELECT yahoo_symbol FROM ticker_map WHERE script = ?").get(script);
  if (!map) return null;
  const row = db.prepare("SELECT price FROM price_cache WHERE symbol = ?").get(map.yahoo_symbol);
  return row ? row.price : null;
}

export function getAllCachedPrices() {
  return db.prepare(`
    SELECT tm.script, tm.yahoo_symbol, pc.price, pc.updated_at
    FROM ticker_map tm LEFT JOIN price_cache pc ON pc.symbol = tm.yahoo_symbol
  `).all();
}
