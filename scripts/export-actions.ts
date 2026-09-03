import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { renderActionForms } from "./lib/action-forms";
import { queryLocalDb } from "./lib/local-db";

const DEFAULT_OUT_DIR = "misc/action-exports";

const SCALAR_COLUMNS = [
  "id",
  "name",
  "shortDescription",
  "body",
  "category",
  "type",
  "image",
  "squareThumbnailImage",
  "squareThumbnailImageAlt",
  "donationAmount",
  "timeEstimate",
  "visibilityMode",
  "suiteId",
  "taskFormId",
  "isContractSigningAction",
  "onboarding",
  "optional",
  "preventCompletion",
  "publicOnly",
  "shouldCompleteAfterDeadline",
  "isForumParticipationAction",
  "forumParticipationPostId",
  "forumParticipationIncludeChildren",
  "customStatType",
  "customStatLabel",
  "customStatValue",
  "customStatGoal",
  "computedAutocompleteAt",
  "cohortExpression",
] as const;

type ExportedAction = Record<(typeof SCALAR_COLUMNS)[number], unknown> & {
  id: number;
  name: string;
  authorIds: number[];
  reviewers: unknown[];
};

type ExportedActionFile = ExportedAction & { form: string | null };

const exportQuery = (actionIds: number[]) => `
  SELECT
    ${SCALAR_COLUMNS.map((column) => `a."${column}"`).join(",\n    ")},
    COALESCE(
      (SELECT json_agg(au."userId" ORDER BY au."userId")
       FROM action_authors_user au WHERE au."actionId" = a.id),
      '[]'
    ) AS "authorIds",
    COALESCE(
      (SELECT json_agg(json_build_object(
         'name', r.name, 'url', r.url, 'icon', r.icon, 'position', r.position
       ) ORDER BY r.position)
       FROM action_reviewer r WHERE r."actionId" = a.id),
      '[]'
    ) AS reviewers
  FROM action a
  WHERE a.id IN (${actionIds.join(",")})
  ORDER BY a.id
`;

function fileName(action: ExportedAction): string {
  const slug = action.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${action.id}-${slug || "action"}.yml`;
}

function main(): void {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex === -1 ? DEFAULT_OUT_DIR : args[outIndex + 1];
  const idArgs = outIndex === -1 ? args : args.toSpliced(outIndex, 2);
  const actionIds = idArgs.map(Number);

  if (actionIds.length === 0 || !actionIds.every(Number.isInteger)) {
    console.error(
      "usage: bun scripts/export-actions.ts <actionId...> [--out <dir>]",
    );
    process.exit(2);
  }

  const rows = queryLocalDb<ExportedAction>(exportQuery(actionIds));
  const missing = actionIds.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length > 0) {
    throw new Error(`no action with id ${missing.join(", ")}`);
  }

  mkdirSync(outDir, { recursive: true });
  for (const row of rows) {
    const target = path.join(outDir, fileName(row));
    const file: ExportedActionFile = {
      ...row,
      form: renderActionForms(row.id),
    };
    writeFileSync(target, stringify(file, { lineWidth: 0 }));
    console.log(target);
  }
}

main();
