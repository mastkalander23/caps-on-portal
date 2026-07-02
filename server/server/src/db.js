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
