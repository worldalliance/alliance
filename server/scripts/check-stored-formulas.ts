/**
 * Re-runs the save check over every stored formula, and the condition of
 * each group in a split whose suite hasn't gone live, against this release's
 * catalog and check, so a change that breaks one fails the deploy instead of
 * the formula or group. Run from ~/nest-backend/server by scripts/deploy_backend.sh
 * after migrations, and again once the new backend is healthy.
 *
 *   bun scripts/check-stored-formulas.ts
 */
import dataSource from "../src/datasources/dataSource";
import { checkStoredFormulas } from "./lib/stored-formula-problems";

async function main() {
  await dataSource.initialize();
  try {
    const checked = await checkStoredFormulas(dataSource.manager);
    if (checked.ok) {
      const { formulas, groups } = checked.value;
      console.log(
        `${formulas} stored formulas and ${groups} draft split groups pass the check.`,
      );
      return;
    }
    console.error(checked.error);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
