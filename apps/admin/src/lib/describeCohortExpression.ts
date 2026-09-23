import type {
  CohortExpression,
  LeafCondition,
} from "@alliance/common/cohort-expression";

export const LEAF_LABELS: Record<LeafCondition["type"], string> = {
  Tag: "Tag",
  Manual: "Manual Users",
  CompletedAction: "Completed Action",
  InProgressAction: "In-Progress Action",
  MissedActionDeadline: "Missed Action Deadline",
  FormFieldValue: "Form Field Value",
  GroupLead: "Group Lead",
  USMember: "US Member",
  NonUSMember: "Non-US Member",
};

export type CohortSegment = { text: string; leaf?: LeafCondition["type"] };

export interface CohortNames {
  tagNames: ReadonlyMap<string, string>;
  actionNames: ReadonlyMap<number, string>;
}

const describeLeaf = (expr: LeafCondition, names: CohortNames): string => {
  switch (expr.type) {
    case "Tag":
      return `Tag: ${names.tagNames.get(expr.tagId) ?? expr.tagId}`;
    case "Manual":
      return `${expr.userIds.length} manual users`;
    case "CompletedAction":
    case "InProgressAction":
    case "MissedActionDeadline":
      return `${LEAF_LABELS[expr.type]}: ${
        names.actionNames.get(expr.actionId) ?? `#${expr.actionId}`
      }`;
    case "FormFieldValue":
      return `Form #${expr.formId} answer`;
    case "GroupLead":
    case "USMember":
    case "NonUSMember":
      return LEAF_LABELS[expr.type];
    default:
      throw new Error(`unknown cohort condition: ${expr satisfies never}`);
  }
};

const describe = (
  expr: CohortExpression,
  names: CohortNames,
  nested: boolean,
): CohortSegment[] => {
  switch (expr.type) {
    case "NOT":
      return [{ text: "not " }, ...describe(expr.child, names, true)];
    case "AND":
    case "OR": {
      const separator = { text: expr.type === "AND" ? " and " : " or " };
      const joined = expr.children.flatMap((child, index) => [
        ...(index > 0 ? [separator] : []),
        ...describe(child, names, true),
      ]);
      return nested && expr.children.length > 1
        ? [{ text: "(" }, ...joined, { text: ")" }]
        : joined;
    }
    default:
      return [{ text: describeLeaf(expr, names), leaf: expr.type }];
  }
};

export const describeCohortExpression = (
  expr: CohortExpression | undefined,
  names: CohortNames,
): CohortSegment[] =>
  expr ? describe(expr, names, false) : [{ text: "None" }];

export const cohortSegmentsText = (segments: CohortSegment[]): string =>
  segments.map((segment) => segment.text).join("");
