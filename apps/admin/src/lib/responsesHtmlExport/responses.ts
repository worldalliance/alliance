import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import {
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import { fieldsWithSavedChoices } from "@alliance/common/forms/formula-options";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { parseFormulaChoices } from "@alliance/shared/parsed-dtos";
import { z } from "zod";
import { isEmptyAnswer } from "../answerValues";
import { respondentName } from "../respondent";
import { escapeXml, tag } from "./xml";

const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? "";
};

const recordSchema = z.record(z.string(), z.unknown());

const headingOf = (field: AnyField): string =>
  field.label?.trim() ? field.label.trim() : field.id;

const optionLabel = (field: AnyField, value: string): string => {
  if (!fieldHasOptions(field)) return value;
  return field.options.find((option) => option.value === value)?.label ?? value;
};

const selectionsOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(stringify);
  const single = stringify(value);
  return single === "" ? [] : [single];
};

const renderPretty = (field: AnyField, value: unknown): string => {
  switch (field.kind) {
    case "radio":
    case "select":
    case "checkbox":
      return escapeXml(optionLabel(field, stringify(value)));
    case "multiselect":
      return selectionsOf(value)
        .map((selection) =>
          tag("item", [], escapeXml(optionLabel(field, selection))),
        )
        .join("");
    case "ranking":
      return selectionsOf(value)
        .map((selection, index) =>
          tag(
            "item",
            [["rank", index + 1]],
            escapeXml(optionLabel(field, selection)),
          ),
        )
        .join("");
    case "city": {
      const city = parseCityValue(value);
      return escapeXml(city ? formatCityValue(city) : stringify(value));
    }
    case "list": {
      const rows = z.array(z.unknown()).safeParse(value);
      if (!rows.success) return escapeXml(stringify(value));
      const subById = new Map(field.fields.map((sub) => [sub.id, sub]));
      return rows.data
        .map((row, index) => {
          const record = recordSchema.safeParse(row);
          if (!record.success) {
            return tag(
              "item",
              [["index", index + 1]],
              escapeXml(stringify(row)),
            );
          }
          const cells = Object.entries(record.data).map(([key, cell]) => {
            const sub = subById.get(key);
            return tag(
              "sub",
              [
                ["field", key],
                ["label", sub ? headingOf(sub) : key],
              ],
              sub ? renderPretty(sub, cell) : escapeXml(stringify(cell)),
            );
          });
          return tag("item", [["index", index + 1]], cells.join(""));
        })
        .join("");
    }
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "number":
    case "range":
    case "date":
    case "time":
    case "timezone":
    case "contract":
    case "file":
    case "custom":
      return escapeXml(stringify(value));
    default:
      throw new Error(`unknown field kind: ${field satisfies never}`);
  }
};

const renderAnswer = (field: AnyField, value: unknown): string => {
  const heading = headingOf(field);
  const headings =
    tag("field-id", [], escapeXml(field.id)) +
    tag("field-label", [], escapeXml(heading));
  if (isEmptyAnswer(value)) {
    return tag(
      "answer",
      [
        ["field", field.id],
        ["kind", field.kind],
        ["label", heading],
        ["unanswered", "true"],
      ],
      headings,
    );
  }
  return tag(
    "answer",
    [
      ["field", field.id],
      ["kind", field.kind],
      ["label", heading],
    ],
    headings +
      tag("raw", [], escapeXml(stringify(value))) +
      tag("pretty", [], renderPretty(field, value)),
  );
};

const renderOrphanAnswer = (fieldId: string, value: unknown): string =>
  tag(
    "answer",
    [
      ["field", fieldId],
      ["label", fieldId],
      ["orphan", "true"],
    ],
    tag("field-id", [], escapeXml(fieldId)) +
      tag("field-label", [], escapeXml(fieldId)) +
      tag("raw", [], escapeXml(stringify(value))) +
      tag("pretty", [], escapeXml(stringify(value))),
  );

const withdrawalReason = (withdrawal: ActionWithdrawalDto): string =>
  [
    withdrawal.outOfTime ? "out of time" : null,
    withdrawal.isMoral ? "moral objection" : null,
    withdrawal.declineReason,
  ]
    .filter((part): part is string => Boolean(part))
    .join("; ");

const renderRespondent = (params: {
  response: FormResponseDto;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
}): string => {
  const { response, withdrawnUserMap, sidsToUserMap } = params;
  const user = response.user;
  const name = user?.name?.trim();
  const text =
    user && name
      ? `${name} <${user.email}>`
      : respondentName({ response, sidsToUserMap });
  const withdrawal =
    user?.id != null ? withdrawnUserMap.get(user.id) : undefined;
  return tag(
    "respondent",
    [
      ["user-id", user?.id],
      ["sid", response.sid],
      ["withdrawn", withdrawal ? "true" : "false"],
      ["withdrawal-reason", withdrawal ? withdrawalReason(withdrawal) : null],
    ],
    escapeXml(text),
  );
};

export const renderResponse = (params: {
  response: FormResponseDto;
  fields: AnyField[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
}): string => {
  const { response, fields, withdrawnUserMap, sidsToUserMap } = params;
  const answers = response.answers ?? {};
  const declared = new Set(fields.map((field) => field.id));
  const orphans = Object.entries(answers).filter(
    ([fieldId]) => !declared.has(fieldId),
  );
  return tag(
    "response",
    [
      ["id", response.id],
      ["submitted-at", response.createdAt],
      ["device", response.deviceType],
    ],
    renderRespondent({ response, withdrawnUserMap, sidsToUserMap }) +
      fieldsWithSavedChoices(
        fields,
        parseFormulaChoices(response.formulaChoices),
      )
        .map((field) => renderAnswer(field, answers[field.id]))
        .join("") +
      orphans
        .map(([fieldId, value]) => renderOrphanAnswer(fieldId, value))
        .join(""),
  );
};
