// ts-node uses node10 resolution here and cannot follow common's exports map.
import path from "path";
import process from "process";
import { assertNotDevDatabase } from "../../common/src/dev-database";
import {
  assertNotWorktree,
  devPorts,
  PortCaller,
} from "../../common/src/dev-ports";

const repoRoot = path.resolve(__dirname, "..", "..");

/** Returns the throwaway database to drop, ignoring the dev DB_NAME. */
export function screenshotDatabase(): string {
  assertNotWorktree({
    ports: devPorts(PortCaller.Tooling),
    what: "the screenshot run",
  });

  const database = process.env.CITESTING_DB_NAME ?? "citesting";

  assertNotDevDatabase({
    repoRoot,
    database,
    action: "drop",
    recovery: "Set CITESTING_DB_NAME to a throwaway database.",
  });

  return database;
}
