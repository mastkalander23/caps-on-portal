// One-time migration: copies every row from your existing local
// server/data/portal.db (better-sqlite3 file) into your new Turso database.
// Preserves ids (so trades still point at the right investor) and existing
// password hashes (so nobody has to reset their password).
//
// Usage:
//   1. Make sure server/.env has TURSO_DATABASE_URL and TURSO_AUTH_TOKEN set.
//   2. Make sure your local server/data/portal.db still exists (don't run
//      this after that file has already been wiped by a redeploy).
//   3. From the server/ folder:  npm install  &&  npm run migrate-to-turso
//   4. Check the printed counts, then log in on the live site to confirm.
//
// Safe to re-run against an EMPTY Turso database. Do NOT re-run it against
// a Turso database that already has real data — it will throw on the
// duplicate primary keys, which is a deliberate safety net.

import Database from "better-sqlite3";
import "dotenv/config";
import { client } from "./db.js"; // importing db.js also creates the schema on Turso if it's missing

const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || "./data/portal.db";

const local = new Database(LOCAL_DB_PATH, { readonly: true });

async function copyTable(table, columns) {
  const rows = local.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all();
  if (rows.length === 0) {
    console.log(`${table}: nothing to copy`);
    return 0;
  }
  const placeholders = columns.map(() => "?").join(", ");
  const statements = rows.map((r) => ({
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    args: columns.map((c) => r[c]),
  }));
  await client.batch(statements, "write");
  console.log(`${table}: copied ${rows.length} row(s)`);
  return rows.length;
}

async function main() {
  console.log(`Reading from local database: ${LOCAL_DB_PATH}`);
  console.log(`Writing to Turso database:   ${process.env.TURSO_DATABASE_URL}`);
  console.log("");

  // Order matters: users before trades/settlements (foreign keys).
  await copyTable("users", [
    "id", "username", "password_hash", "display_name", "role",
    "ratio", "tax_rate", "tax_applicable", "joined_on", "created_at",
  ]);
  await copyTable("trades", [
    "id", "user_id", "script", "buy_date", "qty", "buy_price",
    "sell_date", "sell_price", "notes", "created_at",
  ]);
  await copyTable("settlements", [
    "id", "user_id", "settlement_date", "amount", "direction", "note", "created_at",
  ]);
  await copyTable("ticker_map", ["script", "yahoo_symbol"]);
  await copyTable("price_cache", ["symbol", "price", "updated_at"]);

  console.log("");
  console.log("Migration complete. Log in on the live site with an existing username/password to confirm.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    console.error("If this is a UNIQUE/PRIMARY KEY error, your Turso database already has data in it —");
    console.error("this script is only meant to run once, against a freshly-created empty database.");
    process.exit(1);
  })
  .finally(() => {
    local.close();
  });
