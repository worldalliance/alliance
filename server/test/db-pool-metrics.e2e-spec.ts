import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createServer, type Socket } from "node:net";
import type pg from "pg";
import { testConnectionOptions } from "src/datasources/dataSourceTest";
import { InstrumentedPool } from "src/datasources/pool-metrics";
import { register } from "src/metrics";

async function metric(name: string): Promise<number> {
  const found = (await register.getMetricsAsJSON()).find(
    (m) => m.name === name,
  );
  if (!found) throw new Error(`metric ${name} is not registered`);
  return found.values.reduce((sum, v) => sum + v.value, 0);
}

function connectWithCallback(pool: pg.Pool): Promise<Error | undefined> {
  return new Promise((resolve) =>
    pool.connect((err, client, done) => {
      if (client) done();
      resolve(err);
    }),
  );
}

function testPool(): InstrumentedPool {
  const options = testConnectionOptions();
  if (options.type !== "postgres") throw new Error("not Postgres");
  return new InstrumentedPool({
    host: options.host,
    port: options.port,
    user: options.username,
    password: options.password,
    database: options.database,
    max: 1,
    connectionTimeoutMillis: 1_000,
  });
}

describe("InstrumentedPool metrics (e2e)", () => {
  let pool: InstrumentedPool;
  let held: pg.PoolClient;

  beforeAll(async () => {
    pool = testPool();
    held = await pool.connect();
  });

  afterAll(async () => {
    held.release();
    await pool.end();
  });

  it("reports the open, idle and waiting counts of a starved pool", async () => {
    const waiting = pool.connect();
    expect(await metric("db_pool_connections")).toBe(1);
    expect(await metric("db_pool_idle_connections")).toBe(0);
    expect(await metric("db_pool_waiting_requests")).toBe(1);
    await waiting.catch(() => {});
    expect(await metric("db_pool_waiting_requests")).toBe(0);
  });

  it("counts a checkout that times out, through the promise and callback APIs", async () => {
    const before = await metric("db_pool_acquire_timeouts_total");

    const promiseError = await pool.connect().then(
      () => undefined,
      (err: unknown) => err,
    );
    expect(promiseError).toBeInstanceOf(Error);
    expect((await connectWithCallback(pool))?.message).toContain(
      "timeout exceeded",
    );

    expect(await metric("db_pool_acquire_timeouts_total")).toBe(before + 2);
  });

  it("counts a new connection that times out against a database that never answers", async () => {
    const sockets: Socket[] = [];
    const silent = createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) =>
      silent.listen(0, "127.0.0.1", resolve),
    );
    const address = silent.address();
    if (address === null || typeof address === "string") {
      throw new Error("no TCP address");
    }
    const unanswered = new InstrumentedPool({
      host: "127.0.0.1",
      port: address.port,
      connectionTimeoutMillis: 200,
    });
    try {
      const before = await metric("db_pool_acquire_timeouts_total");
      const err = await unanswered.connect().then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(Error);
      expect(err instanceof Error && err.message).toBe(
        "Connection terminated due to connection timeout",
      );
      expect(await metric("db_pool_acquire_timeouts_total")).toBe(before + 1);
    } finally {
      await unanswered.end();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => silent.close(resolve));
    }
  });

  it("stops counting a pool once it has ended", async () => {
    const other = testPool();
    (await other.connect()).release();
    const before = await metric("db_pool_connections");
    await other.end();
    expect(await metric("db_pool_connections")).toBe(before - 1);
  });
});
