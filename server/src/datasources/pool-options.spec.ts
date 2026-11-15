import { describe, expect, it } from "bun:test";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { poolOptions } from "./pool-options";

describe("poolOptions", () => {
  it("sizes the pool for every lock-taking cron holding two connections", () => {
    const connectionsPerCron = 2;
    const cronConnections = Object.keys(LOCK_KEYS).length * connectionsPerCron;
    expect(poolOptions.poolSize).toBeGreaterThan(cronConnections);
  });

  it("times out a connection request instead of waiting forever", () => {
    expect(poolOptions.connectTimeoutMS).toBeGreaterThan(0);
  });
});
