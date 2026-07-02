// Populates the database with starter accounts and sample trades so you can
// see the app working end to end. Run once with: npm run seed
// Re-running is safe — it clears and re-inserts seed data only.

import bcrypt from "bcryptjs";
import { db } from "./db.js";

const hash = (pw) => bcrypt.hashSync(pw, 12);

db.exec("DELETE FROM trades; DELETE FROM users; DELETE FROM ticker_map;");

const insertUser = db.prepare(`
  INSERT INTO users (username, password_hash, display_name, role, ratio, tax_rate, joined_on)
  VALUES (@username, @password_hash, @display_name, @role, @ratio, @tax_rate, @joined_on)
`);

const admin = insertUser.run({
  username: "admin",
  password_hash: hash("ChangeMe123!"),
  display_name: "Fund Manager",
  role: "admin",
  ratio: 0,
  tax_rate: 0,
  joined_on: "2025-11-01",
});

const investors = [
  { username: "anuj", password: "Investor123!", display_name: "Anuj Mehta", ratio: 0.30, joined_on: "2025-11-01" },
  { username: "anup", password: "Investor123!", display_name: "Anup Shah", ratio: 0.30, joined_on: "2025-11-01" },
  { username: "amit", password: "Investor123!", display_name: "Amit Kapoor", ratio: 0.40, joined_on: "2025-12-01" },
  { username: "porus", password: "Investor123!", display_name: "Porus Wadia", ratio: 0.40, joined_on: "2026-02-01" },
];

const investorIds = {};
for (const inv of investors) {
  const info = insertUser.run({
    username: inv.username,
    password_hash: hash(inv.password),
    display_name: inv.display_name,
    role: "investor",
    ratio: inv.ratio,
    tax_rate: 0.1,
    joined_on: inv.joined_on,
  });
  investorIds[inv.username] = info.lastInsertRowid;
}

const insertTrade = db.prepare(`
  INSERT INTO trades (user_id, script, buy_date, qty, buy_price, sell_date, sell_price)
  VALUES (@user_id, @script, @buy_date, @qty, @buy_price, @sell_date, @sell_price)
`);

const trades = [
  // Anuj — open
  { u: "anuj", script: "ISWL", buy_date: "2026-03-02", qty: 28150, buy_price: 14.4799, sell_date: null, sell_price: null },
  { u: "anuj", script: "Worth", buy_date: "2026-05-27", qty: 4237, buy_price: 4.54, sell_date: null, sell_price: null },
  // Anuj — closed
  { u: "anuj", script: "ISWL", buy_date: "2025-11-17", qty: 18206, buy_price: 12.39, sell_date: "2026-03-04", sell_price: 14.44 },
  { u: "anuj", script: "Lloyds Engg", buy_date: "2025-12-16", qty: 1424, buy_price: 53.98, sell_date: "2026-01-02", sell_price: 56.24 },
  { u: "anuj", script: "Viceroy Hotels", buy_date: "2026-01-05", qty: 788, buy_price: 135.10, sell_date: "2026-02-24", sell_price: 149.57 },

  // Anup — open
  { u: "anup", script: "ISWL", buy_date: "2026-03-02", qty: 6960.65, buy_price: 14.791, sell_date: null, sell_price: null },
  { u: "anup", script: "Worth", buy_date: "2026-05-27", qty: 5065, buy_price: 4.54, sell_date: null, sell_price: null },
  // Anup — closed
  { u: "anup", script: "ISWL", buy_date: "2025-12-02", qty: 4352, buy_price: 11.56, sell_date: "2026-03-04", sell_price: 14.22 },
  { u: "anup", script: "Viceroy Hotels", buy_date: "2026-01-05", qty: 125, buy_price: 135.10, sell_date: "2026-02-24", sell_price: 149.56 },

  // Amit — open
  { u: "amit", script: "ISWL", buy_date: "2026-03-10", qty: 115200, buy_price: 15.0629, sell_date: null, sell_price: null },
  // Amit — closed
  { u: "amit", script: "ISWL", buy_date: "2025-12-19", qty: 136183, buy_price: 14.21, sell_date: "2026-06-01", sell_price: 17.67 },
  { u: "amit", script: "Lloyds Engg", buy_date: "2025-12-19", qty: 14894, buy_price: 56.49, sell_date: "2026-01-02", sell_price: 56.02 },
  { u: "amit", script: "Viceroy Hotels", buy_date: "2026-01-05", qty: 2589, buy_price: 134.87, sell_date: "2026-03-06", sell_price: 147.35 },
  { u: "amit", script: "Lloyds Enterprises", buy_date: "2026-03-05", qty: 27520, buy_price: 48.19, sell_date: "2026-03-10", sell_price: 48.73 },

  // Porus — open, long-term holder, no closed trades yet
  { u: "porus", script: "ISWL", buy_date: "2026-06-17", qty: 170474, buy_price: 16.300774, sell_date: null, sell_price: null },
  { u: "porus", script: "Worth", buy_date: "2026-04-22", qty: 99147, buy_price: 4.7789435, sell_date: null, sell_price: null },
  { u: "porus", script: "GMRP & UI", buy_date: "2026-05-21", qty: 8855, buy_price: 112.9695, sell_date: null, sell_price: null },
  { u: "porus", script: "SW Solar", buy_date: "2026-06-23", qty: 2000, buy_price: 248.99, sell_date: null, sell_price: null },
  { u: "porus", script: "DBL", buy_date: "2026-06-30", qty: 1090, buy_price: 457.50, sell_date: null, sell_price: null },
];

for (const t of trades) {
  insertTrade.run({
    user_id: investorIds[t.u],
    script: t.script,
    buy_date: t.buy_date,
    qty: t.qty,
    buy_price: t.buy_price,
    sell_date: t.sell_date,
    sell_price: t.sell_price,
  });
}

// Map each script to its Yahoo Finance symbol so the price feed knows what to fetch.
// EDIT THESE to match your actual tickers — .NS = NSE, .BO = BSE.
const tickerMap = [
  { script: "ISWL", yahoo_symbol: "ISWL.NS" },
  { script: "Worth", yahoo_symbol: "WORTH.NS" },
  { script: "GMRP & UI", yahoo_symbol: "GMRP.NS" },
  { script: "SW Solar", yahoo_symbol: "SWSOLAR.NS" },
  { script: "DBL", yahoo_symbol: "DBL.NS" },
];
const insertMap = db.prepare("INSERT INTO ticker_map (script, yahoo_symbol) VALUES (?, ?)");
for (const m of tickerMap) insertMap.run(m.script, m.yahoo_symbol);

console.log("Seed complete.");
console.log("Admin login:    admin / ChangeMe123!");
console.log("Investor login: anuj / Investor123!  (also anup, amit, porus — same password)");
console.log("Change every password immediately after first login in a real deployment.");
