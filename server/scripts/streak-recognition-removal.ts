/**
 * Deploy-time helper for the RemoveStreakRecognition migration, run from
 * ~/nest-backend/server by scripts/deploy_backend.sh.
 *
 *   bun scripts/streak-recognition-removal.ts state    # prints absent, applied, or pending
 *   bun scripts/streak-recognition-removal.ts revert   # undoes it and every migration recorded after it, then checks the old schema is back
 */
import dataSource from "../src/datasources/dataSource";
import {
  REMOVAL_MIGRATION,
  removalState,
  revertRemoval,
} from "./lib/streak-recognition-removal";

async function main(command: string | undefined) {
  // The deploy reads stdout as the state, and slow-query warnings go there too.
  dataSource.setOptions({ maxQueryExecutionTime: undefined });
  await dataSource.initialize();
  try {
    switch (command) {
      case "state":
        console.log(await removalState(dataSource));
        return;
      case "revert":
        await revertRemoval(dataSource);
        console.log(`reverted ${REMOVAL_MIGRATION}`);
        return;
      default:
        throw new Error(`usage: streak-recognition-removal.ts state|revert`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
