import { createClient } from "@libsql/client";
import fs from "fs";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Copy server/.env.example to server/.env and fill in your Turso credentials."
  );
}

// Raw libsql client — exported in case you ever need it directly.
export const client = createClient({ url, authToken });

// --- Thin async helpers that mirror the old better-sqlite3 shape -----------
// get()  -> single row or null   (was db.prepare(sql).get(...))
// all()  -> array of rows        (was db.prepare(sql).all(...))
// run()  -> { lastInsertRowid, changes } (was db.prepare(sql).run(...))
// args can be a positional array ([1, 2]) or a named object ({ id: 1 }),
// matching whichever placeholder style (?, @name, :name) the SQL uses.

export async function get(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0] ?? null;
}

export async function all(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

export async function run(sql, args = []) {
  const result = await client.execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    changes: result.rowsAffected ?? 0,
  };
}

// Run a batch of statements as a single atomic transaction. Pass an array
// of { sql, args }. Replaces the old db.transaction(fn) pattern.
export async function runBatch(statements) {
  return client.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write"
  );
}

// --- Boot-time schema + lightweight migrations ------------------------------
// Executed once when the server starts. Safe to run every boot: everything
// here is IF NOT EXISTS / guarded by a column-existence check.

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
// executeMultiple runs a whole SQL script (multiple statements, comments and
// all) in one call — much more robust than manually splitting on ";", which
// can break on comment lines.
await client.executeMultiple(schema);

// Lightweight migration for databases created before `tax_applicable`
// existed — CREATE TABLE IF NOT EXISTS above won't add columns to a table
// that's already there, so add it here if missing.
const userColumns = (await client.execute("PRAGMA table_info(users)")).rows.map((c) => c.name);
if (!userColumns.includes("tax_applicable")) {
  await client.execute("ALTER TABLE users ADD COLUMN tax_applicable INTEGER NOT NULL DEFAULT 1");
}

// Same idea for `settlements.direction`, added after the table itself
// first shipped.
const settlementColumns = (await client.execute("PRAGMA table_info(settlements)")).rows.map((c) => c.name);
if (!settlementColumns.includes("direction")) {
  await client.execute("ALTER TABLE settlements ADD COLUMN direction TEXT NOT NULL DEFAULT 'to_manager'");
}