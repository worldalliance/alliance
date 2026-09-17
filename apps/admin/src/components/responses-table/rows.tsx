import type { AnyField } from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { respondentName } from "../../lib/respondent";
import type { ResponseVariantOption } from "../FormResponsesView";
import { IdentityChip } from "../IdentitySwatch";
import { WithdrawalInfo } from "../WithdrawalInfo";
import { EMPTY_CELL, renderCell, type CellContent } from "./cells";
import type { QuestionColumn } from "./columns";
import {
  ColumnKind,
  MetaColumnId,
  type ResponseRow,
  type TableColumn,
} from "./types";

const META_COLUMN_LABELS: Record<MetaColumnId, string> = {
  [MetaColumnId.Respondent]: "Respondent",
  [MetaColumnId.Submitted]: "Submitted",
  [MetaColumnId.Variant]: "Variant",
  [MetaColumnId.Withdrawal]: "Withdrawal",
  [MetaColumnId.ResponseId]: "Response ID",
  [MetaColumnId.UserId]: "User ID",
};

export const DEFAULT_HIDDEN_COLUMNS: string[] = [
  MetaColumnId.ResponseId,
  MetaColumnId.UserId,
];

export const formatSubmitted = (createdAt: string): string =>
  new Date(createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function buildTableColumns(params: {
  questions: readonly QuestionColumn[];
  hasVariants: boolean;
}): TableColumn[] {
  const metaIds = [
    MetaColumnId.Respondent,
    MetaColumnId.Submitted,
    ...(params.hasVariants ? [MetaColumnId.Variant] : []),
    MetaColumnId.Withdrawal,
    MetaColumnId.ResponseId,
    MetaColumnId.UserId,
  ];

  return [
    ...metaIds.map((id) => ({
      kind: ColumnKind.Meta as const,
      id,
      label: META_COLUMN_LABELS[id],
    })),
    ...params.questions.map((question) => ({
      kind: ColumnKind.Question as const,
      id: question.id,
      label: question.label,
      question,
    })),
  ];
}

/**
 * The field as the response's own snapshot worded it, so option labels read the
 * way they did when the answer was given. Falls back to the column's own
 * definition when that snapshot is not loaded.
 */
const fieldForResponse = (params: {
  response: FormResponseDto;
  question: QuestionColumn;
  fieldsBySnapshot: Map<number, Map<string, AnyField>>;
}): AnyField => {
  const { response, question, fieldsBySnapshot } = params;
  return (
    fieldsBySnapshot.get(response.formSnapshotId)?.get(question.fieldId) ??
    question.field
  );
};

const metaCell = (params: {
  id: MetaColumnId;
  response: FormResponseDto;
  sidsToUserMap: Record<string, ProfileDto>;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  variantByFormId: Map<number, ResponseVariantOption>;
}): CellContent => {
  const { id, response, sidsToUserMap, withdrawnUserMap, variantByFormId } =
    params;

  switch (id) {
    case MetaColumnId.Respondent:
      return { text: respondentName({ response, sidsToUserMap }) };
    case MetaColumnId.Submitted:
      return { text: formatSubmitted(response.createdAt) };
    case MetaColumnId.Variant: {
      const variant = variantByFormId.get(response.formId);
      if (!variant) return EMPTY_CELL;
      return {
        text: variant.name,
        node: <IdentityChip seed={variant.name} label={variant.name} />,
      };
    }
    case MetaColumnId.Withdrawal: {
      const withdrawal =
        response.user?.id == null
          ? undefined
          : withdrawnUserMap.get(response.user.id);
      if (!withdrawal) return EMPTY_CELL;
      return {
        text: "Withdrew",
        node: <WithdrawalInfo withdrawal={withdrawal} />,
      };
    }
    case MetaColumnId.ResponseId:
      return { text: String(response.id) };
    case MetaColumnId.UserId:
      return response.user?.id == null
        ? EMPTY_CELL
        : { text: String(response.user.id) };
    default:
      throw new Error(`unknown meta column: ${id satisfies never}`);
  }
};

export function buildRows(params: {
  responses: readonly FormResponseDto[];
  columns: readonly TableColumn[];
  fieldsBySnapshot: Map<number, Map<string, AnyField>>;
  sidsToUserMap: Record<string, ProfileDto>;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  variantByFormId: Map<number, ResponseVariantOption>;
}): ResponseRow[] {
  const {
    responses,
    columns,
    fieldsBySnapshot,
    sidsToUserMap,
    withdrawnUserMap,
    variantByFormId,
  } = params;

  return responses.map((response) => {
    const cells: Record<string, CellContent> = {};
    for (const column of columns) {
      if (column.kind === ColumnKind.Meta) {
        cells[column.id] = metaCell({
          id: column.id,
          response,
          sidsToUserMap,
          withdrawnUserMap,
          variantByFormId,
        });
        continue;
      }
      cells[column.id] = renderCell({
        field: fieldForResponse({
          response,
          question: column.question,
          fieldsBySnapshot,
        }),
        value: response.answers?.[column.question.fieldId],
      });
    }
    return { response, cells };
  });
}
