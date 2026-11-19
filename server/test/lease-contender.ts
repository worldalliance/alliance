import { LocksStorage } from "@nestjs/locks";
import { createInterface } from "node:readline";
import { testConnectionOptions } from "src/datasources/dataSourceTest";
import { PgLockStore } from "src/leases/pg-lock-store";
import { DataSource } from "typeorm";

/**
 * One contender process for lease-store.e2e-spec.ts. Each stdin line is
 * `acquire <key> <owner>` or `release <key> <owner>`, answered on stdout by
 * one JSON line holding what the store returned.
 */
async function main() {
  const options = testConnectionOptions();
  if (options.type !== "postgres") throw new Error("expected Postgres");
  // Not the test options whole: their schema drop would wipe the table the
  // other process is racing on.
  const dataSource = new DataSource({
    type: "postgres",
    host: options.host,
    port: options.port,
    username: options.username,
    password: options.password,
    database: options.database,
  });
  await dataSource.initialize();
  const store = new PgLockStore(dataSource, new LocksStorage());
  console.log(JSON.stringify({ ready: true }));

  for await (const line of createInterface({ input: process.stdin })) {
    const [command, key, owner] = line.split(" ");
    const answer =
      command === "acquire"
        ? await store.acquire(key, owner, 60_000)
        : await store.release(key, owner);
    console.log(JSON.stringify(answer));
  }
  await dataSource.destroy();
}

void main();
