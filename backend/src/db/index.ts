import "./../lib/env";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import { LibsqlSqlite } from "./libsqlSqlite";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

type SqliteLike = {
  pragma: (sql: string) => void;
  exec: (sql: string) => unknown;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
  transaction: <T>(fn: () => T) => () => T;
};

function openLocalSqlite(): SqliteLike {
  const dbPath = path.join(__dirname, "..", "..", "data", "alter.db");
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite as unknown as SqliteLike;
}

export const sqlite: SqliteLike =
  tursoUrl && tursoToken ? new LibsqlSqlite(tursoUrl, tursoToken) : openLocalSqlite();

export const db = drizzle(sqlite as InstanceType<typeof Database>, { schema });
export { schema };
export const dbDriver = tursoUrl && tursoToken ? "turso" : "sqlite";
