import {
  isLeafCondition,
  type BooleanOperator,
  type CohortExpression,
  type LeafCondition,
} from "@alliance/common/cohort-expression";

type LeafType = LeafCondition["type"];
type OperatorType = BooleanOperator["type"];
export type NodeType = LeafType | OperatorType;

export const LEAF_TYPE_LABELS: Record<LeafType, string> = {
  Tag: "Has tag",
  Manual: "Is one of these members",
  CompletedAction: "Completed task",
  MissedActionDeadline: "Missed task deadline",
  FormFieldValue: "Answered form field",
  GroupLead: "Is a group lead",
  USMember: "Is a US member",
  NonUSMember: "Is a non-US member",
  AllMembers: "All members",
  Staff: "Is staff",
};

export const OPERATOR_LABELS: Record<OperatorType, string> = {
  AND: "All of these",
  OR: "Any of these",
  NOT: "Not this",
};

export const LEAF_TYPES = Object.keys(LEAF_TYPE_LABELS).filter(
  (type): type is LeafType => type in LEAF_TYPE_LABELS,
);
export const OPERATOR_TYPES = Object.keys(OPERATOR_LABELS).filter(
  (type): type is OperatorType => type in OPERATOR_LABELS,
);

export const isNodeType = (value: string): value is NodeType =>
  value in LEAF_TYPE_LABELS || value in OPERATOR_LABELS;

const isLeafType = (type: NodeType): type is LeafType =>
  type in LEAF_TYPE_LABELS;

export function operatorChildren(expr: BooleanOperator): CohortExpression[] {
  switch (expr.type) {
    case "AND":
    case "OR":
      return expr.children;
    case "NOT":
      return [expr.child];
    default:
      throw new Error(
        `unknown operator: ${JSON.stringify(expr satisfies never)}`,
      );
  }
}

export function createDefaultLeaf(type: LeafType): LeafCondition {
  switch (type) {
    case "Tag":
      return { type: "Tag", tagId: "" };
    case "Manual":
      return { type: "Manual", userIds: [] };
    case "CompletedAction":
      return { type: "CompletedAction", actionId: 0 };
    case "MissedActionDeadline":
      return { type: "MissedActionDeadline", actionId: 0 };
    case "FormFieldValue":
      return { type: "FormFieldValue", formId: 0, fieldId: "" };
    case "GroupLead":
    case "USMember":
    case "NonUSMember":
    case "AllMembers":
    case "Staff":
      return { type };
    default:
      throw new Error(`unknown condition: ${type satisfies never}`);
  }
}

/** A node turned into another type; an operator keeps the children it had. */
export function changeNodeType(
  expr: CohortExpression,
  type: NodeType,
): CohortExpression {
  if (isLeafType(type)) return createDefaultLeaf(type);
  const children = isLeafCondition(expr) ? [] : operatorChildren(expr);
  switch (type) {
    case "NOT":
      return { type: "NOT", child: children[0] ?? createDefaultLeaf("Tag") };
    case "AND":
    case "OR":
      return { type, children };
    default:
      throw new Error(`unknown operator: ${type satisfies never}`);
  }
}
