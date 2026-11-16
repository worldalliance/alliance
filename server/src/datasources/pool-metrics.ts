import pg from "pg";
import client from "prom-client";
import { register } from "../metrics";

type ConnectCallback = Parameters<pg.Pool["connect"]>[0];

const livePools = new Set<pg.Pool>();

// pg-pool's two ways a checkout runs out of time: waiting in the queue for a
// busy pool, and opening a new connection to a slow database.
const ACQUIRE_TIMEOUT_MESSAGES = new Set([
  "timeout exceeded when trying to connect",
  "Connection terminated due to connection timeout",
]);

const acquireTimeouts = new client.Counter({
  name: "db_pool_acquire_timeouts_total",
  help: "Checkouts from the application's Postgres pool that timed out",
  registers: [register],
});

function poolGauge(params: {
  name: string;
  help: string;
  read: (pool: pg.Pool) => number;
}): void {
  new client.Gauge({
    name: params.name,
    help: params.help,
    registers: [register],
    collect() {
      let sum = 0;
      for (const pool of livePools) sum += params.read(pool);
      this.set(sum);
    },
  });
}

poolGauge({
  name: "db_pool_connections",
  help: "Open connections in the application's Postgres pool",
  read: (pool) => pool.totalCount,
});
poolGauge({
  name: "db_pool_idle_connections",
  help: "Idle connections in the application's Postgres pool",
  read: (pool) => pool.idleCount,
});
poolGauge({
  name: "db_pool_waiting_requests",
  help: "Requests waiting for a connection from the application's Postgres pool",
  read: (pool) => pool.waitingCount,
});

function countTimeout(err: unknown): void {
  if (err instanceof Error && ACQUIRE_TIMEOUT_MESSAGES.has(err.message)) {
    acquireTimeouts.inc();
  }
}

export class InstrumentedPool extends pg.Pool {
  constructor(config?: pg.PoolConfig) {
    super(config);
    livePools.add(this);
  }

  override connect(): Promise<pg.PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<pg.PoolClient> | void {
    if (!callback) {
      return super.connect().catch((err: unknown) => {
        countTimeout(err);
        throw err;
      });
    }
    super.connect((err, poolClient, done) => {
      countTimeout(err);
      callback(err, poolClient, done);
    });
  }

  override end(): Promise<void>;
  override end(callback: () => void): void;
  override end(callback?: () => void): Promise<void> | void {
    livePools.delete(this);
    return callback ? super.end(callback) : super.end();
  }
}

export const instrumentedPg = { ...pg, Pool: InstrumentedPool };
