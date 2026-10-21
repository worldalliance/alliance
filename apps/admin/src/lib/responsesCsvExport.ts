import { rowValueText } from "@alliance/common/forms/row-list";
import type { FormResponseDto } from "@alliance/shared/client";
import { parseAssignedRow } from "@alliance/shared/parsed-dtos";
import { formatAnswerValue } from "./answerValues";
import { assignedRowFields } from "./assignedRowFields";

const csvEscape = (s: string): string => {
  const needsQuotes = /[",\n\r]/.test(s);
  let v = s.replace(/"/g, '""');
  v = v.replace(/\r?\n/g, " ");
  return needsQuotes ? `"${v}"` : v;
};

export function buildResponsesCsv(params: {
  responses: FormResponseDto[];
  orderedFieldIds: string[];
  fieldLabels: Map<string, string>;
  /** Adds a Variant column when present. */
  variantName?: (response: FormResponseDto) => string | null;
}): string {
  const { responses, orderedFieldIds, fieldLabels, variantName } = params;
  const metaHeaders = ["Response ID", "User ID", "User Name", "SID"];
  if (variantName) metaHeaders.push("Variant");
  const rowFields = assignedRowFields(responses);
  metaHeaders.push(...rowFields.map((field) => `row.${field}`));
  const used = new Set<string>();
  const questionHeaders = orderedFieldIds.map((id) => {
    const base = fieldLabels.get(id) ?? id;
    let name = base;
    let i = 2;
    while (used.has(name)) {
      name = `${base} (${i++})`;
    }
    used.add(name);
    return name;
  });
  const headers = [...metaHeaders, ...questionHeaders];

  const rows = responses.map((resp) => {
    const user = resp?.user;
    const userName = [user?.name ?? resp.id].filter(Boolean).join(" ");
    const values = [
      String(resp.id ?? ""),
      String(user?.id ?? ""),
      userName,
      resp.sid ?? "",
      ...(variantName ? [variantName(resp) ?? ""] : []),
      ...rowFields.map((field) =>
        rowValueText(parseAssignedRow(resp.assignedRow)?.values[field]),
      ),
      ...orderedFieldIds.map((id) => formatAnswerValue(resp.answers?.[id])),
    ];
    return values;
  });

  return [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")),
  ].join("\n");
}
