import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import { setEnv } from "@alliance/common/set-env";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { DataSource } from "typeorm";
import { PostgresDriver } from "typeorm/driver/postgres/PostgresDriver";
import { connectionOptions } from "./connection-options";
import { poolOptions } from "./pool-options";

// Lower bounds from a static reading of each locked job: "Connections per
// locked job" in docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks/EVIDENCE.md.
const connectionsPerLockedJob: Record<keyof typeof LOCK_KEYS, number> = {
  contractReminder: 2,
  waitlistEmail: 2,
  mmsMediaCopy: 2,
  actionEventNotif: 3,
  contractSuspender: 3,
  actionUpdateRecognitionDelivery: 3,
  taskBadgeSweep: 3,
  cohortDecision: 4,
  cohortDecisionDivergence: 4,
  forumActionCompleter: 5,
  reloadUsersJoined: 5,
};

describe("poolOptions", () => {
  it("leaves a connection free when every locked job waits for its next one", () => {
    const heldWhileWaiting = Object.values(connectionsPerLockedJob).reduce(
      (sum, connections) => sum + connections - 1,
      0,
    );
    expect(poolOptions.poolSize).toBeGreaterThan(heldWhileWaiting);
  });

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

  it("gives the app's DataSource the pool size and timeout", () => {
    const { driver } = new DataSource(connectionOptions());
    if (!(driver instanceof PostgresDriver)) throw new Error("not Postgres");

    expect(driver.options.poolSize).toBe(poolOptions.poolSize);
    expect(driver.options.connectTimeoutMS).toBe(poolOptions.connectTimeoutMS);
  });
});
