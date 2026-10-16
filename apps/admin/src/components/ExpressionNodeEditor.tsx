/* eslint-disable react/prop-types */
import {
  isLeafCondition,
  type BooleanOperator,
  type CohortExpression,
  type LeafCondition,
} from "@alliance/common/cohort-expression";
import { cn } from "@alliance/shared/styles/util";
import { Plus, Trash2 } from "lucide-react";
import React from "react";
import { LEAF_LABELS } from "../lib/describeCohortExpression";
import {
  LeafConditionEditor,
  type CohortLeafEditorSources,
} from "./CohortLeafEditors";

interface ExpressionEditorContext extends CohortLeafEditorSources {
  selectedExpr: CohortExpression | null;
}

const LEAF_TYPES = Object.entries(LEAF_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const OPERATOR_TYPES = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
  { value: "NOT", label: "NOT" },
] as const;

function operatorChildren(expr: BooleanOperator): CohortExpression[] {
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

function createDefaultLeaf(type: LeafCondition["type"]): LeafCondition {
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
      return { type: "GroupLead" };
    case "USMember":
      return { type: "USMember" };
    case "NonUSMember":
      return { type: "NonUSMember" };
    case "AllMembers":
      return { type: "AllMembers" };
    case "Staff":
      return { type: "Staff" };
  }
}

const ExpressionNodeEditor: React.FC<{
  expr: CohortExpression;
  onChange: (expr: CohortExpression) => void;
  onRemove?: () => void;
  onSelect?: (expr: CohortExpression) => void;
  isSelected?: boolean;
  depth: number;
  props: ExpressionEditorContext;
}> = ({ expr, onChange, onRemove, onSelect, isSelected, depth, props }) => {
  const handleTypeChange = (newType: string) => {
    const leafTypes = LEAF_TYPES.map((t) => t.value as string);
    if (leafTypes.includes(newType)) {
      onChange(createDefaultLeaf(newType as LeafCondition["type"]));
    } else {
      const op = newType as BooleanOperator["type"];
      // Preserve children when switching between operator types
      const existingChildren: CohortExpression[] = isLeafCondition(expr)
        ? []
        : operatorChildren(expr);

      switch (op) {
        case "NOT":
          onChange({
            type: "NOT",
            child: existingChildren[0] ?? createDefaultLeaf("Tag"),
          });
          break;
        case "AND":
        case "OR":
          onChange({ type: op, children: existingChildren });
          break;
        default:
          throw new Error(`unknown operator: ${op satisfies never}`);
      }
    }
  };

  const bigEditors: LeafCondition["type"][] = [
    "Manual",
    "FormFieldValue",
  ] as const;

  return (
    <div
      className={cn(
        "border rounded-md transition-colors",
        isSelected
          ? "border-blue-400 ring-1 ring-blue-200"
          : depth === 0
            ? "border-gray-300"
            : "border-gray-200",
        depth > 0 && "ml-4",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-md",
          isSelected ? "bg-blue-50" : "bg-gray-50",
          onSelect && "cursor-pointer",
        )}
        onClick={(e) => {
          if (onSelect && !(e.target instanceof HTMLSelectElement)) {
            e.stopPropagation();
            onSelect(expr);
          }
        }}
      >
        <select
          value={expr.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <optgroup label="Conditions">
            {LEAF_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Operators">
            {OPERATOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
        </select>
        {isLeafCondition(expr) && !bigEditors.includes(expr.type) && (
          <LeafConditionEditor
            expr={expr}
            onChange={onChange as (v: LeafCondition) => void}
            props={props}
          />
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-auto p-1 text-gray-600 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLeafCondition(expr) && bigEditors.includes(expr.type) && (
        <div className="p-3">
          <LeafConditionEditor
            expr={expr}
            onChange={onChange as (v: LeafCondition) => void}
            props={props}
          />
        </div>
      )}
      {!isLeafCondition(expr) && (
        <div className="p-3">
          <BooleanOperatorEditor
            expr={expr}
            onChange={onChange as (v: BooleanOperator) => void}
            onSelect={onSelect}
            selectedExpr={props.selectedExpr}
            depth={depth}
            props={props}
          />
        </div>
      )}
    </div>
  );
};

const BooleanOperatorEditor: React.FC<{
  expr: BooleanOperator;
  onChange: (expr: BooleanOperator) => void;
  onSelect?: (expr: CohortExpression) => void;
  selectedExpr?: CohortExpression | null;
  depth: number;
  props: ExpressionEditorContext;
}> = ({ expr, onChange, onSelect, selectedExpr, depth, props }) => {
  switch (expr.type) {
    case "NOT":
      return (
        <div>
          <p className="text-xs text-gray-500 mb-2">Exclude users matching:</p>
          <ExpressionNodeEditor
            expr={expr.child}
            onChange={(child) => onChange({ ...expr, child })}
            onSelect={onSelect}
            isSelected={selectedExpr === expr.child}
            depth={depth + 1}
            props={props}
          />
        </div>
      );
    case "AND":
    case "OR":
      break;
    default:
      throw new Error(
        `unknown operator: ${JSON.stringify(expr satisfies never)}`,
      );
  }

  const children = expr.children;

  const addChild = () => {
    onChange({
      ...expr,
      children: [...children, createDefaultLeaf("Tag")],
    });
  };

  const removeChild = (index: number) => {
    onChange({
      ...expr,
      children: children.filter((_, i) => i !== index),
    });
  };

  const updateChild = (index: number, child: CohortExpression) => {
    const newChildren = [...children];
    newChildren[index] = child;
    onChange({ ...expr, children: newChildren });
  };

  return (
    <div className="space-y-2">
      {children.length === 0 && (
        <p className="text-sm text-gray-400 italic">No conditions yet</p>
      )}
      {children.map((child, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex items-center justify-center pb-2">
              <span className="text-xs font-medium text-zinc-500">
                {expr.type}
              </span>
            </div>
          )}
          <ExpressionNodeEditor
            expr={child}
            onChange={(c) => updateChild(i, c)}
            onRemove={() => removeChild(i)}
            onSelect={onSelect}
            isSelected={selectedExpr === child}
            depth={depth + 1}
            props={props}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addChild}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
      >
        <Plus className="h-3 w-3" />
        Add condition
      </button>
    </div>
  );
};

export default ExpressionNodeEditor;
