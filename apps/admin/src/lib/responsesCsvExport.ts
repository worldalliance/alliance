import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { fieldsWithSavedChoices } from "@alliance/common/forms/formula-choices";
import { rowValueText } from "@alliance/common/forms/row-list";
import type { FormResponseDto } from "@alliance/shared/client";
import {
  parseAssignedRow,
  parseFormulaChoices,
} from "@alliance/shared/parsed-dtos";
import { answerText } from "./answerLabels";
import { assignedRowFields } from "./assignedRowFields";
import {
  parseStoredSchema,
  questionFieldsOf,
} from "./responsesHtmlExport/schema";

const csvEscape = (s: string): string => {
  const needsQuotes = /[",\n\r]/.test(s);
  let v = s.replace(/"/g, '""');
  v = v.replace(/\r?\n/g, " ");
  return needsQuotes ? `"${v}"` : v;
};

type SnapshotFields = Map<string, AnyField>;

const fieldsOfSchema = (schema: unknown): AnyField[] =>
  questionFieldsOf(parseStoredSchema(schema));

export function buildResponsesCsv(params: {
  responses: FormResponseDto[];
  orderedFieldIds: string[];
  fieldLabels: Map<string, string>;
  /** The form's current schema: tells a removed question from one the CSV leaves out. */
  schema?: unknown;
  /** The form `schema` belongs to; only its responses can show a question it removed. */
  formId?: number;
  /** Adds a Variant column when present. */
  variantName?: (response: FormResponseDto) => string | null;
}): string {
  const {
    responses,
    orderedFieldIds,
    fieldLabels,
    schema,
    formId,
    variantName,
  } = params;
  const metaHeaders = [
    "Response ID",
    "User ID",
    "User Name",
    "SID",
    "Submitted at",
  ];
  if (variantName) metaHeaders.push("Variant");
  const rowFields = assignedRowFields(responses);
  metaHeaders.push(...rowFields.map((field) => `row.${field}`));

  const currentFields = fieldsOfSchema(schema);
  const current = new Set(currentFields.map((field) => field.id));
  const columnIds = new Set(orderedFieldIds);
  const bySnapshot = new Map<number, AnyField[]>();
  const snapshotFields = (response: FormResponseDto): SnapshotFields => {
    let fields = bySnapshot.get(response.formSnapshotId);
    if (!fields) {
      fields = fieldsOfSchema(response.schemaSnapshot);
      bySnapshot.set(response.formSnapshotId, fields);
    }
    return new Map(
      fieldsWithSavedChoices(
        fields.length > 0 ? fields : currentFields,
        parseFormulaChoices(response.formulaChoices),
      ).map((field) => [field.id, field]),
    );
  };

  const perResponse = responses.map((response) => ({
    response,
    fields: snapshotFields(response),
  }));

  // Answers to questions the current form doesn't ask, labelled from the version that asked
  // them. Another form's response (a variant's) may answer a question that form still asks.
  const extra = new Map<string, { label: string; removed: boolean }>();
  for (const { response, fields } of perResponse) {
    for (const id of Object.keys(response.answers ?? {})) {
      if (columnIds.has(id) || current.has(id)) continue;
      const ownForm = response.formId === formId;
      const seen = extra.get(id);
      if (seen) {
        seen.removed &&= ownForm;
        continue;
      }
      const field = fields.get(id);
      extra.set(id, {
        label: field ? elementInternalDescriptor(field) : id,
        removed: ownForm,
      });
    }
  }
  const extraIds = [...extra.keys()];

  const used = new Set<string>();
  const unique = (base: string): string => {
    let name = base;
    let i = 2;
    while (used.has(name)) {
      name = `${base} (${i++})`;
    }
    used.add(name);
    return name;
  };
  const questionHeaders = [
    ...orderedFieldIds.map((id) => unique(fieldLabels.get(id) ?? id)),
    ...[...extra.values()].map(({ label, removed }) =>
      unique(removed ? `${label} (removed)` : label),
    ),
  ];
  const headers = [...metaHeaders, ...questionHeaders];

  const rows = perResponse.map(({ response, fields }) => {
    const user = response.user;
    return [
      String(response.id ?? ""),
      String(user?.id ?? ""),
      user?.name?.trim() ?? "",
      response.sid ?? "",
      response.createdAt,
      ...(variantName ? [variantName(response) ?? ""] : []),
      ...rowFields.map((field) =>
        rowValueText(parseAssignedRow(response.assignedRow)?.values[field]),
      ),
      ...[...orderedFieldIds, ...extraIds].map((id) =>
        answerText(fields.get(id), response.answers?.[id]),
      ),
    ];
  });

  return [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")),
  ].join("\n");
}
