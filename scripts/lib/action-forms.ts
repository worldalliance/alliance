import type { DisplayBlock } from "../../common/src/forms/display-blocks";
import { displayBlockPreview } from "../../common/src/forms/element-descriptors";
import {
  formSchema,
  isQuestionField,
  type AnyField,
  type FormSchema,
} from "../../common/src/forms/form-schema";
import { queryLocalDb } from "./local-db";

interface FormRow {
  role: string;
  formId: number;
  title: string;
  schema: unknown;
}

const formsQuery = (actionId: number) => `
  SELECT role, "formId", f.title, s.schema
  FROM (
    SELECT 1 AS rank, 'task form' AS role, a."taskFormId" AS "formId"
    FROM action a WHERE a.id = ${actionId} AND a."taskFormId" IS NOT NULL
    UNION ALL
    SELECT 2, 'variant: ' || v.name, v."formId"
    FROM action_form_variant v WHERE v."actionId" = ${actionId}
    UNION ALL
    SELECT 3, 'follow-up: ' || COALESCE(u.name, '(unnamed)'), u."formId"
    FROM follow_up_form u WHERE u."actionId" = ${actionId}
  ) forms
  JOIN form f ON f.id = forms."formId"
  JOIN form_snapshot s ON s.id = f."formSnapshotId"
  ORDER BY rank, role, "formId"
`;

function fieldLines(field: AnyField): string[] {
  const label = field.label?.trim() || `(no label, ${field.id})`;
  const lines = [
    `[${field.kind}${field.required ? ", required" : ""}] ${label}`,
  ];
  if (field.description) lines.push(`  ${field.description}`);
  if ("options" in field) {
    lines.push(...field.options.map((option) => `  - ${option.label}`));
  }
  if (field.kind === "range") {
    lines.push(`  ${field.startLabel ?? ""} … ${field.endLabel ?? ""}`);
  }
  if (field.kind === "list") {
    lines.push(
      ...field.fields.flatMap((sub) =>
        fieldLines(sub).map((line) => `  ${line}`),
      ),
    );
  }
  return lines;
}

function elementLines(element: AnyField | DisplayBlock): string[] {
  if (isQuestionField(element)) return fieldLines(element);
  const preview = displayBlockPreview(element);
  return preview ? [preview] : [];
}

function renderForm(row: FormRow): string {
  const parsed: FormSchema = formSchema.parse(row.schema);
  const lines = [`=== ${row.role} — form #${row.formId}: ${row.title} ===`];
  if (parsed.description) lines.push("", parsed.description);
  for (const [index, page] of parsed.pages.entries()) {
    lines.push("", `--- Page ${index + 1}: ${page.title ?? page.id} ---`);
    if (page.description) lines.push(page.description);
    for (const element of page.fields) {
      lines.push("", ...elementLines(element));
    }
  }
  if (parsed.submit?.label) lines.push("", `[submit] ${parsed.submit.label}`);
  return lines.join("\n");
}

/** Null when the action has no task form, variants or follow-up forms. */
export function renderActionForms(actionId: number): string | null {
  const rows = queryLocalDb<FormRow>(formsQuery(actionId));
  return rows.length === 0 ? null : rows.map(renderForm).join("\n\n");
}
