import { SQL } from "bun";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { stringify } from "yaml";
import { envFileValue } from "../common/src/dev-database";
import { renderActionForm } from "./lib/action-form-text";

const { values, positionals } = parseArgs({
  options: { repo: { type: "string", default: "." } },
  allowPositionals: true,
});
const id = Number(positionals[0]);
if (positionals.length !== 1 || !Number.isInteger(id)) {
  console.error("usage: bun scripts/export-action.ts [--repo <checkout>] <id>");
  process.exit(2);
}

const repo = path.resolve(values.repo);
const envFile = path.join(repo, "server", ".env");
function env(key: string): string {
  const value = envFileValue(envFile, key);
  if (value === null) throw new Error(`${key} missing from ${envFile}`);
  return value;
}
const sql = new SQL({
  hostname: env("DB_HOST"),
  port: Number(env("DB_PORT")),
  username: env("DB_USERNAME"),
  password: env("DB_PASSWORD"),
  database: env("DB_NAME"),
});

const [action] = await sql`
  SELECT id, name, "shortDescription", body,
    array_to_string(category, ', ') AS category,
    image, "squareThumbnailImage", "squareThumbnailImageAlt", "timeEstimate",
    "visibilityMode", "suiteId", "taskFormId", "isContractSigningAction",
    onboarding, optional, "preventCompletion", "publicOnly",
    "shouldCompleteAfterDeadline", "isForumParticipationAction",
    "forumParticipationPostId", "forumParticipationIncludeChildren",
    "customStatType", "customStatLabel", "customStatValue", "customStatGoal",
    to_json("computedAutocompleteAt") #>> '{}' AS "computedAutocompleteAt",
    "cohortExpression"
  FROM action WHERE id = ${id}`;
if (!action) throw new Error(`no action ${id} in ${env("DB_NAME")}`);

const authors = await sql`
  SELECT "userId" FROM action_authors_user
  WHERE "actionId" = ${id} ORDER BY "userId"`;
const reviewers = await sql`
  SELECT name, url, icon, position FROM action_reviewer
  WHERE "actionId" = ${id} ORDER BY position`;
const [form] = action.taskFormId
  ? await sql`
      SELECT f.title, s.schema FROM form f
      JOIN form_snapshot s ON s.id = f."formSnapshotId"
      WHERE f.id = ${action.taskFormId}`
  : [];
await sql.close();
if (action.taskFormId && !form) {
  throw new Error(`action ${id} names missing form ${action.taskFormId}`);
}

const exported = {
  ...action,
  authorIds: authors.map((row: { userId: number }) => row.userId),
  reviewers: [...reviewers],
  form: form
    ? renderActionForm({
        formId: action.taskFormId,
        title: form.title,
        schema: form.schema,
      })
    : null,
};

const slug = action.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const outFile = path.join(repo, ".scratch", `${id}-${slug}.yml`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(
  outFile,
  "# yaml-language-server: $schema=../skills/export-action/action-export.schema.yml\n" +
    stringify(exported, { lineWidth: 0 }),
);
console.log(path.relative(process.cwd(), outFile));
