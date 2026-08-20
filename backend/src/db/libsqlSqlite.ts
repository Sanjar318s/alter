import { MessageChannel, receiveMessageOnPort, Worker } from "worker_threads";
import path from "path";

type QueryResult = {
  ok: boolean;
  error?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowsAffected?: number;
  lastInsertRowid?: number;
};

export class LibsqlSqlite {
  private worker: Worker;

  constructor(url: string, authToken: string) {
    this.worker = new Worker(path.join(__dirname, "libsqlWorker.cjs"), {
      workerData: { url, authToken },
    });
  }

  private call(kind: "exec" | "query", sql: string, args: unknown[] = []): QueryResult {
    const sab = new SharedArrayBuffer(4);
    const lock = new Int32Array(sab);
    const { port1, port2 } = new MessageChannel();
    this.worker.postMessage({ kind, sql, args, sab, port: port2 }, [port2]);
    Atomics.wait(lock, 0, 0);
    const msg = receiveMessageOnPort(port1);
    const result = (msg?.message || { ok: false, error: "no worker response" }) as QueryResult;
    if (!result.ok) throw new Error(result.error || "libsql error");
    return result;
  }

  pragma(_sql: string) {
    return;
  }

  exec(sql: string) {
    this.call("exec", sql);
    return this;
  }

  prepare(sql: string) {
    const runQuery = (...params: unknown[]) => this.call("query", sql, flattenParams(params));
    const toArray = (row: unknown, columns?: string[]) => {
      if (Array.isArray(row)) return row;
      const rec = row as Record<string, unknown>;
      const keys = columns?.length ? columns : Object.keys(rec);
      return keys.map((k) => rec[k]);
    };
    const toObject = (row: unknown, columns?: string[]) => {
      if (!Array.isArray(row)) return row;
      const obj: Record<string, unknown> = {};
      (columns || []).forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    };
    const stmt: {
      raw: (isRaw?: boolean) => typeof stmt;
      run: (...params: unknown[]) => { changes: number; lastInsertRowid: number };
      get: (...params: unknown[]) => unknown;
      all: (...params: unknown[]) => unknown[];
    } = {
      raw(isRaw = true) {
        rawMode = isRaw !== false;
        return stmt;
      },
      run: (...params: unknown[]) => {
        const res = runQuery(...params);
        return { changes: res.rowsAffected || 0, lastInsertRowid: res.lastInsertRowid || 0 };
      },
      get: (...params: unknown[]) => {
        const res = runQuery(...params);
        const row = res.rows?.[0];
        if (!row) return undefined;
        return rawMode ? toArray(row, res.columns) : toObject(row, res.columns);
      },
      all: (...params: unknown[]) => {
        const res = runQuery(...params);
        const rows = res.rows || [];
        return rawMode ? rows.map((row) => toArray(row, res.columns)) : rows.map((row) => toObject(row, res.columns));
      },
    };
    let rawMode = false;
    return stmt;
  }

  transaction<T>(fn: () => T) {
    return () => fn();
  }

  close() {
    void this.worker.terminate();
  }
}

function flattenParams(params: unknown[]) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0] as unknown[];
  return params;
}
