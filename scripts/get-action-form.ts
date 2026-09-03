import { renderActionForms } from "./lib/action-forms";
import { queryLocalDb } from "./lib/local-db";

function main(): void {
  const actionId = Number(process.argv[2]);
  if (!Number.isInteger(actionId)) {
    console.error("usage: bun scripts/get-action-form.ts <actionId>");
    process.exit(2);
  }

  const [action] = queryLocalDb<{ name: string }>(
    `SELECT name FROM action WHERE id = ${actionId}`,
  );
  if (!action) throw new Error(`no action with id ${actionId}`);
  console.log(`Action ${actionId} — ${action.name}\n`);

  const forms = renderActionForms(actionId);
  console.log(forms ?? "No forms associated with this action.");
}

main();
