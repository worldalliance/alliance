import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import { setEnv } from "@alliance/common/set-env";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DataSource } from "typeorm";
import { PostgresDriver } from "typeorm/driver/postgres/PostgresDriver";
import { connectionOptions } from "./connection-options";
import { InstrumentedPool } from "./pool-metrics";
import { poolOptions } from "./pool-options";

describe("poolOptions", () => {
  it("times out a connection request instead of waiting forever", () => {
    expect(poolOptions.connectTimeoutMS).toBeGreaterThan(0);
  });
});

describe("connectionOptions", () => {
  let savedDbName: string | undefined;

  beforeEach(() => {
    savedDbName = process.env.DB_NAME;
    const devDatabase = devPorts(PortCaller.Server).database;
    if (devDatabase !== null) setEnv("DB_NAME", devDatabase);
  });

  afterEach(() => setEnv("DB_NAME", savedDbName));

  it("gives the app's DataSource the pool size, timeout and instrumented pool", () => {
    const { driver } = new DataSource(connectionOptions());
    if (!(driver instanceof PostgresDriver)) throw new Error("not Postgres");

    expect(driver.options.poolSize).toBe(poolOptions.poolSize);
    expect(driver.options.connectTimeoutMS).toBe(poolOptions.connectTimeoutMS);
    expect(driver.postgres.Pool).toBe(InstrumentedPool);
  });
});
