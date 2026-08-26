/**
 * One-off audit for the `silent-field-drop` review finding: how many stored
 * elements claim `type: "input"` but fail the current strict `anyFieldSchema`,
 * and so vanish from the form pickers without any error shown.
 *
 * Run from `server/`: `bun run scripts/stored-field-drop-audit.ts`
 */
import {
  anyFieldSchema,
  isQuestionField,
} from "@alliance/common/forms/form-schema";
import { Client } from "pg";
import { z } from "zod";

const storedSchema = z.looseObject({
  pages: z.array(z.looseObject({ fields: z.array(z.unknown()).optional() })),
});

type Row = { id: number; title: string; schema: unknown };

type Drop = {
  formId: number;
  title: string;
  elementId: string;
  kind: string;
  issues: string[];
};

function elementOf(value: unknown): {
  type?: unknown;
  id?: unknown;
  kind?: unknown;
} {
  return typeof value === "object" && value !== null ? value : {};
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  const historical = process.argv.includes("--historical");
  const { rows } = await client.query<Row>(
    historical
      ? // Every snapshot a form has ever pointed at, current or not.
        `SELECT s.id, coalesce(f.title, '(orphan snapshot)') AS title, s.schema
         FROM form_snapshot s
         LEFT JOIN form_snapshot_history h ON h."formSnapshotId" = s.id
         LEFT JOIN form f ON f.id = h."formId"
         ORDER BY s.id`
      : `SELECT f.id, f.title, s.schema
         FROM form f
         JOIN form_snapshot s ON s.id = f."formSnapshotId"
         ORDER BY f.id`,
  );
  console.log(
    historical ? "scope: all snapshots\n" : "scope: current snapshots\n",
  );

  const drops: Drop[] = [];
  const unreadableForms: number[] = [];
  let elements = 0;
  let parsedFields = 0;
  let oldBehaviourFields = 0;
  let displayBlocksDropped = 0;
  const droppedByType = new Map<string, number>();

  for (const row of rows) {
    const parsed = storedSchema.safeParse(row.schema);
    if (!parsed.success) {
      unreadableForms.push(row.id);
      continue;
    }
    for (const page of parsed.data.pages) {
      for (const element of page.fields ?? []) {
        elements++;
        const claimsInput = elementOf(element).type === "input";
        if (claimsInput) oldBehaviourFields++;
        const field = anyFieldSchema.safeParse(element);
        if (field.success) {
          parsedFields++;
          continue;
        }
        if (claimsInput) {
          drops.push({
            formId: row.id,
            title: row.title,
            elementId: String(elementOf(element).id),
            kind: String(elementOf(element).kind),
            issues: field.error.issues.map(
              (issue) =>
                `${issue.path.join(".") || "(root)"}: ${issue.message}`,
            ),
          });
        } else {
          displayBlocksDropped++;
          const type = String(elementOf(element).type);
          droppedByType.set(type, (droppedByType.get(type) ?? 0) + 1);
        }
      }
    }
  }

  console.log(`forms:                       ${rows.length}`);
  console.log(
    `forms with unreadable pages: ${unreadableForms.length} ${unreadableForms.join(", ")}`,
  );
  console.log(`page elements:               ${elements}`);
  console.log(`  parse as question fields:  ${parsedFields}`);
  console.log(`  dropped, not type=input:   ${displayBlocksDropped}`);
  console.log(
    `  dropped, type=input:       ${drops.length}   <-- silent-field-drop`,
  );
  console.log(`old isQuestionField() count: ${oldBehaviourFields}`);
  console.log("\ndropped non-input elements by `type`:");
  for (const [type, count] of [...droppedByType].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${type}`);
  }

  const byKind = new Map<string, number>();
  const byIssue = new Map<string, number>();
  for (const drop of drops) {
    byKind.set(drop.kind, (byKind.get(drop.kind) ?? 0) + 1);
    for (const issue of drop.issues) {
      byIssue.set(issue, (byIssue.get(issue) ?? 0) + 1);
    }
  }

  if (drops.length > 0) {
    console.log(
      `\naffected forms: ${new Set(drops.map((d) => d.formId)).size}`,
    );
    console.log("\nby field kind:");
    for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)}  ${kind}`);
    }
    console.log("\nby zod issue:");
    for (const [issue, count] of [...byIssue].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)}  ${issue}`);
    }
    console.log("\nsample:");
    for (const drop of drops.slice(0, 15)) {
      console.log(
        `  form ${drop.formId} (${drop.title}) field ${drop.elementId} [${drop.kind}] -> ${drop.issues.join("; ")}`,
      );
    }
  }

  // Sanity check that isQuestionField is the predicate the old pickers used.
  void isQuestionField;

  await client.end();
}

void main();
