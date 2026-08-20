const { parentPort, workerData } = require("worker_threads");
const { createClient } = require("@libsql/client");

const client = createClient({
  url: workerData.url,
  authToken: workerData.authToken,
});

parentPort.on("message", async (msg) => {
  const { kind, sql, args, sab, port } = msg;
  const lock = new Int32Array(sab);
  try {
    if (kind === "exec") {
      await client.executeMultiple(sql);
      port.postMessage({ ok: true });
    } else {
      const rs = await client.execute({ sql, args: args || [] });
      const columns = rs.columns || [];
      port.postMessage({
        ok: true,
        columns,
        rows: rs.rows.map((row) => columns.map((col, i) => (Array.isArray(row) ? row[i] : row[col]))),
        rowsAffected: Number(rs.rowsAffected || 0),
        lastInsertRowid: Number(rs.lastInsertRowid || 0),
      });
    }
  } catch (err) {
    port.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    Atomics.store(lock, 0, 1);
    Atomics.notify(lock, 0);
  }
});
