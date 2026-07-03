import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import "dotenv/config";

const dbPath = process.env.DB_PATH || "./data/portal.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
db.exec(schema);

// Lightweight migration for databases created before `tax_applicable`
// existed — CREATE TABLE IF NOT EXISTS above won't add columns to a table
// that's already there, so add it here if missing.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes("tax_applicable")) {
  db.exec("ALTER TABLE users ADD COLUMN tax_applicable INTEGER NOT NULL DEFAULT 1");
}

// Same idea for `settlements.direction`, added after the table itself
// first shipped.
const settlementColumns = db.prepare("PRAGMA table_info(settlements)").all().map((c) => c.name);
if (!settlementColumns.includes("direction")) {
  db.exec("ALTER TABLE settlements ADD COLUMN direction TEXT NOT NULL DEFAULT 'to_manager'");
}
