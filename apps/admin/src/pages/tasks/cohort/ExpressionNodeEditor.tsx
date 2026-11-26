import {
  isBooleanOperator,
  isLeafCondition,
  type AndOperator,
  type BooleanOperator,
  type CohortExpression,
  type LeafCondition,
  type OrOperator,
} from "@alliance/common/cohort-expression";
import { Plus, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Select } from "../../../ui/Select";
import {
  LeafConditionEditor,
  type CohortLeafEditorSources,
} from "./CohortLeafEditors";
import {
  changeNodeType,
  createDefaultLeaf,
  isNodeType,
  LEAF_TYPE_LABELS,
  LEAF_TYPES,
  OPERATOR_LABELS,
  OPERATOR_TYPES,
} from "./cohortRules";

interface ExpressionEditorContext extends CohortLeafEditorSources {
  selectedExpr: CohortExpression | null;
}

export const TYPE_SELECT = "data-cohort-type";

const OWN_LINE: ReadonlySet<LeafCondition["type"]> = new Set([
  "Manual",
  "FormFieldValue",
]);

const nodeLabel = (expr: CohortExpression) =>
  isLeafCondition(expr)
    ? LEAF_TYPE_LABELS[expr.type]
    : OPERATOR_LABELS[expr.type];

const ExpressionNodeEditor: React.FC<{
  expr: CohortExpression;
  onChange: (expr: CohortExpression) => void;
  onRemove?: () => void;
  onSelect?: (expr: CohortExpression) => void;
  isSelected?: boolean;
  depth: number;
  context: ExpressionEditorContext;
}> = ({ expr, onChange, onRemove, onSelect, isSelected, depth, context }) => {
  const leaf = isLeafCondition(expr) ? expr : null;
  const operator = isBooleanOperator(expr) ? expr : null;
  const ownLine = leaf !== null && OWN_LINE.has(leaf.type);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div
        className={cn(
          "-mx-1.5 flex min-h-control-sm flex-wrap items-center gap-2 rounded-md px-1.5",
          isSelected && "bg-accent-soft",
        )}
      >
        <Select
          {...{ [TYPE_SELECT]: "" }}
          aria-label="Condition type"
          value={expr.type}
          onChange={(e) => {
            if (isNodeType(e.target.value))
              onChange(changeNodeType(expr, e.target.value));
          }}
          className="h-control-sm w-auto font-medium"
        >
          <optgroup label="Conditions">
            {LEAF_TYPES.map((type) => (
              <option key={type} value={type}>
                {LEAF_TYPE_LABELS[type]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Combine">
            {OPERATOR_TYPES.map((type) => (
              <option key={type} value={type}>
                {OPERATOR_LABELS[type]}
              </option>
            ))}
          </optgroup>
        </Select>
        {leaf && !ownLine && (
          <LeafConditionEditor
            expr={leaf}
            onChange={onChange}
            sources={context}
          />
        )}
        {((onSelect && depth > 0) || onRemove) && (
          <div className="ml-auto flex items-center gap-1">
            {onSelect && depth > 0 && (
              <Button
                variant={ButtonVariant.Ghost}
                size="small"
                aria-pressed={isSelected ?? false}
                aria-label={`Highlight in chart: ${nodeLabel(expr)}`}
                onClick={() => onSelect(expr)}
              >
                Highlight
              </Button>
            )}
            {/* Hidden, not absent, for a NOT's only child, so Highlight stays in its column. */}
            <Button
              variant={ButtonVariant.Ghost}
              size="small"
              aria-label={`Remove condition: ${nodeLabel(expr)}`}
              title="Remove condition"
              onClick={() => onRemove?.()}
              className={cn(!onRemove && "invisible")}
              disabled={!onRemove}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {leaf && ownLine && (
        <div className="pl-3">
          <LeafConditionEditor
            expr={leaf}
            onChange={onChange}
            sources={context}
          />
        </div>
      )}
      {operator && (
        <OperatorChildren
          expr={operator}
          onChange={onChange}
          onSelect={onSelect}
          selected={isSelected ?? false}
          depth={depth}
          context={context}
        />
      )}
    </div>
  );
};

const OperatorChildren: React.FC<{
  expr: BooleanOperator;
  onChange: (expr: BooleanOperator) => void;
  onSelect?: (expr: CohortExpression) => void;
  selected: boolean;
  depth: number;
  context: ExpressionEditorContext;
}> = ({ expr, onChange, onSelect, selected, depth, context }) => {
  const rail = cn(
    "ml-2 border-l-2 pl-3",
    selected ? "border-accent" : "border-line",
  );
  if (expr.type === "NOT") {
    return (
      <div className={rail}>
        <ExpressionNodeEditor
          expr={expr.child}
          onChange={(child) => onChange({ ...expr, child })}
          onSelect={onSelect}
          isSelected={context.selectedExpr === expr.child}
          depth={depth + 1}
          context={context}
        />
      </div>
    );
  }
  return (
    <ChildList
      expr={expr}
      onChange={onChange}
      onSelect={onSelect}
      rail={rail}
      depth={depth}
      context={context}
    />
  );
};

const ChildList: React.FC<{
  expr: AndOperator | OrOperator;
  onChange: (expr: AndOperator | OrOperator) => void;
  onSelect?: (expr: CohortExpression) => void;
  rail: string;
  depth: number;
  context: ExpressionEditorContext;
}> = ({ expr, onChange, onSelect, rail, depth, context }) => {
  const { children } = expr;
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    setFocusIndex(null);
    const row = listRef.current?.children.item(focusIndex);
    const target =
      row?.querySelector<HTMLElement>(`[${TYPE_SELECT}]`) ?? addRef.current;
    target?.focus();
  }, [focusIndex, children]);

  const setChildren = (next: CohortExpression[]) =>
    onChange({ ...expr, children: next });

  return (
    <div className={cn(rail, "flex flex-col gap-2")}>
      {children.length === 0 ? (
        <p className="text-fg-muted">
          No conditions yet, so this group matches no one.
        </p>
      ) : (
        <ol ref={listRef} className="flex flex-col gap-2">
          {children.map((child, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                aria-hidden={i === 0}
                className="flex h-control-sm w-7 shrink-0 items-center text-caption font-medium text-fg-muted"
              >
                {i === 0 ? "" : expr.type === "AND" ? "and" : "or"}
              </span>
              <ExpressionNodeEditor
                expr={child}
                onChange={(c) =>
                  setChildren(children.map((old, j) => (j === i ? c : old)))
                }
                onRemove={() => {
                  setChildren(children.filter((_, j) => j !== i));
                  setFocusIndex(i < children.length - 1 ? i : i - 1);
                }}
                onSelect={onSelect}
                isSelected={context.selectedExpr === child}
                depth={depth + 1}
                context={context}
              />
            </li>
          ))}
        </ol>
      )}
      <Button
        ref={addRef}
        variant={ButtonVariant.Ghost}
        size="small"
        className="text-accent"
        onClick={() => {
          setChildren([...children, createDefaultLeaf("Tag")]);
          setFocusIndex(children.length);
        }}
      >
        <Plus aria-hidden className="size-4" />
        Add condition
      </Button>
    </div>
  );
};

export default ExpressionNodeEditor;
