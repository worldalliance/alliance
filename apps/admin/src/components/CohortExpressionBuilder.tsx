/* eslint-disable react/prop-types */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TagDto, FormDto } from "@alliance/shared/client";
import { tasksGetForm, actionsFindOneAdmin } from "@alliance/shared/client";
import type { AnyField, FormSchema } from "@alliance/shared/forms/formschema";
import type { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import { cn } from "@alliance/shared/styles/util";
import {
  Plus,
  Trash2,
  EllipsisVertical,
  Copy,
  ClipboardPaste,
  CopyMinus,
} from "lucide-react";
import CohortVisualization from "./CohortVisualization";
import type {
  CohortExpression,
  LeafCondition,
  BooleanOperator,
  TagCondition,
  ManualCondition,
  CompletedActionCondition,
  InProgressActionCondition,
  FormFieldValueCondition,
  AndOperator,
  OrOperator,
} from "@alliance/shared/cohort-expression.types";

export type { CohortExpression } from "@alliance/shared/cohort-expression.types";

interface CohortExpressionBuilderProps {
  value: CohortExpression | null | undefined;
  onChange: (value: CohortExpression | null) => void;
  availableTags: TagDto[];
  availableActions: { id: number; name: string }[];
  availableForms: FormDto[];
  availableUsers: UserSelectUser[];
  usersLoading?: boolean;
  activeContractUserIds?: Set<number>;
  everyoneShouldComplete?: boolean;
  /** @internal used to thread selected expression to nested editors */
  _selectedExpr?: CohortExpression | null;
}

const LEAF_TYPES = [
  { value: "Tag", label: "Tag" },
  { value: "Manual", label: "Manual Users" },
  { value: "CompletedAction", label: "Completed Action" },
  { value: "InProgressAction", label: "In-Progress Action" },
  { value: "FormFieldValue", label: "Form Field Value" },
  { value: "GroupLead", label: "Group Lead" },
] as const;

const OPERATOR_TYPES = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
  { value: "NOT", label: "NOT" },
] as const;

function isLeaf(expr: CohortExpression): expr is LeafCondition {
  return "type" in expr;
}

function createDefaultLeaf(type: LeafCondition["type"]): LeafCondition {
  switch (type) {
    case "Tag":
      return { type: "Tag", tagId: "" };
    case "Manual":
      return { type: "Manual", userIds: [] };
    case "CompletedAction":
      return { type: "CompletedAction", actionId: 0 };
    case "InProgressAction":
      return { type: "InProgressAction", actionId: 0 };
    case "FormFieldValue":
      return { type: "FormFieldValue", formId: 0, fieldId: "" };
    case "GroupLead":
      return { type: "GroupLead" };
  }
}

// --- Leaf Editors ---

const TagEditor: React.FC<{
  value: TagCondition;
  onChange: (v: TagCondition) => void;
  availableTags: TagDto[];
}> = ({ value, onChange, availableTags }) => (
  <select
    value={value.tagId}
    onChange={(e) => onChange({ ...value, tagId: e.target.value })}
    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
  >
    <option value="">Select tag...</option>
    {availableTags.map((tag) => (
      <option key={tag.id} value={tag.id}>
        {tag.name}
      </option>
    ))}
  </select>
);

const ManualEditor: React.FC<{
  value: ManualCondition;
  onChange: (v: ManualCondition) => void;
  availableUsers: UserSelectUser[];
  usersLoading?: boolean;
}> = ({ value, onChange, availableUsers, usersLoading }) => (
  <UserSelect
    users={availableUsers}
    selectedUserIds={value.userIds}
    onChange={(ids) => onChange({ ...value, userIds: ids })}
    loading={usersLoading}
    label="Select users"
  />
);

const ActionSelectEditor: React.FC<{
  value: CompletedActionCondition | InProgressActionCondition;
  onChange: (v: CompletedActionCondition | InProgressActionCondition) => void;
  availableActions: { id: number; name: string }[];
}> = ({ value, onChange, availableActions }) => (
  <select
    value={value.actionId || ""}
    onChange={(e) => onChange({ ...value, actionId: parseInt(e.target.value) })}
    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
  >
    <option value="">Select action...</option>
    {availableActions.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name}
      </option>
    ))}
  </select>
);

const FormFieldEditor: React.FC<{
  value: FormFieldValueCondition;
  onChange: (v: FormFieldValueCondition) => void;
  availableForms: FormDto[];
}> = ({ value, onChange, availableForms }) => {
  const [sourceFields, setSourceFields] = useState<AnyField[]>([]);

  useEffect(() => {
    if (!value.formId) {
      setSourceFields([]);
      return;
    }
    let cancelled = false;
    tasksGetForm({ path: { id: value.formId } })
      .then((response) => {
        if (cancelled || !response.data) return;
        const schema = (response.data as unknown as { schema: FormSchema })
          .schema;
        const fields: AnyField[] = [];
        for (const page of schema.pages ?? []) {
          for (const element of page.fields ?? []) {
            if ("label" in element) {
              fields.push(element as AnyField);
            }
          }
        }
        setSourceFields(fields);
      })
      .catch(() => {
        if (!cancelled) setSourceFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [value.formId]);

  return (
    <div className="space-y-2">
      <select
        value={value.formId || ""}
        onChange={(e) =>
          onChange({ ...value, formId: parseInt(e.target.value), fieldId: "" })
        }
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Select form...</option>
        {availableForms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title ?? `Form #${f.id}`}
          </option>
        ))}
      </select>
      <select
        value={value.fieldId}
        onChange={(e) => onChange({ ...value, fieldId: e.target.value })}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
        disabled={!value.formId}
      >
        <option value="">Select field...</option>
        {sourceFields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label} ({f.kind})
          </option>
        ))}
      </select>
      {!value.responseAny ? (
        <input
          type="text"
          placeholder="Response equals (optional)"
          value={value.responseEqualTo ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              responseEqualTo: e.target.value || undefined,
            })
          }
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
        />
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.responseAny ?? false}
          onChange={(e) =>
            onChange({ ...value, responseAny: e.target.checked || undefined })
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        Any response (ignore value)
      </label>
    </div>
  );
};

// --- Expression Node Editor ---

const ExpressionNodeEditor: React.FC<{
  expr: CohortExpression;
  onChange: (expr: CohortExpression) => void;
  onRemove?: () => void;
  onSelect?: (expr: CohortExpression) => void;
  isSelected?: boolean;
  depth: number;
  props: CohortExpressionBuilderProps;
}> = ({ expr, onChange, onRemove, onSelect, isSelected, depth, props }) => {
  const currentType = isLeaf(expr) ? expr.type : expr.op;

  const handleTypeChange = (newType: string) => {
    const leafTypes = LEAF_TYPES.map((t) => t.value as string);
    if (leafTypes.includes(newType)) {
      onChange(createDefaultLeaf(newType as LeafCondition["type"]));
    } else {
      const op = newType as BooleanOperator["op"];
      // Preserve children when switching between operator types
      const existingChildren: CohortExpression[] = !isLeaf(expr)
        ? expr.op === "NOT"
          ? [expr.child]
          : expr.children
        : [];

      if (op === "NOT") {
        onChange({
          op: "NOT",
          child: existingChildren[0] ?? createDefaultLeaf("Tag"),
        });
      } else {
        onChange({ op, children: existingChildren } as
          | AndOperator
          | OrOperator);
      }
    }
  };

  return (
    <div
      className={cn(
        "border rounded-md transition-colors",
        isSelected
          ? "border-blue-400 ring-1 ring-blue-200"
          : depth === 0
          ? "border-gray-300"
          : "border-gray-200",
        depth > 0 && "ml-4"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-md",
          isSelected ? "bg-blue-50" : "bg-gray-50",
          onSelect && "cursor-pointer"
        )}
        onClick={(e) => {
          if (onSelect && !(e.target instanceof HTMLSelectElement)) {
            e.stopPropagation();
            onSelect(expr);
          }
        }}
      >
        <select
          value={currentType}
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
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-auto p-1 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-3">
        {isLeaf(expr) ? (
          <LeafConditionEditor
            expr={expr}
            onChange={onChange as (v: LeafCondition) => void}
            props={props}
          />
        ) : (
          <BooleanOperatorEditor
            expr={expr}
            onChange={onChange as (v: BooleanOperator) => void}
            onSelect={onSelect}
            selectedExpr={props._selectedExpr}
            depth={depth}
            props={props}
          />
        )}
      </div>
    </div>
  );
};

const LeafConditionEditor: React.FC<{
  expr: LeafCondition;
  onChange: (expr: LeafCondition) => void;
  props: CohortExpressionBuilderProps;
}> = ({ expr, onChange, props }) => {
  switch (expr.type) {
    case "Tag":
      return (
        <TagEditor
          value={expr}
          onChange={onChange}
          availableTags={props.availableTags}
        />
      );
    case "Manual":
      return (
        <ManualEditor
          value={expr}
          onChange={onChange}
          availableUsers={props.availableUsers}
          usersLoading={props.usersLoading}
        />
      );
    case "CompletedAction":
    case "InProgressAction":
      return (
        <ActionSelectEditor
          value={expr}
          onChange={onChange}
          availableActions={props.availableActions}
        />
      );
    case "FormFieldValue":
      return (
        <FormFieldEditor
          value={expr}
          onChange={onChange}
          availableForms={props.availableForms}
        />
      );
    case "GroupLead":
      return (
        <p className="text-sm text-gray-500 italic">
          All community group leaders
        </p>
      );
  }
};

const BooleanOperatorEditor: React.FC<{
  expr: BooleanOperator;
  onChange: (expr: BooleanOperator) => void;
  onSelect?: (expr: CohortExpression) => void;
  selectedExpr?: CohortExpression | null;
  depth: number;
  props: CohortExpressionBuilderProps;
}> = ({ expr, onChange, onSelect, selectedExpr, depth, props }) => {
  if (expr.op === "NOT") {
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
  }

  const children = expr.children;

  const addChild = () => {
    onChange({
      ...expr,
      children: [...children, createDefaultLeaf("Tag")],
    } as AndOperator | OrOperator);
  };

  const removeChild = (index: number) => {
    onChange({
      ...expr,
      children: children.filter((_, i) => i !== index),
    } as AndOperator | OrOperator);
  };

  const updateChild = (index: number, child: CohortExpression) => {
    const newChildren = [...children];
    newChildren[index] = child;
    onChange({ ...expr, children: newChildren } as AndOperator | OrOperator);
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
                {expr.op}
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

// --- Main Component ---

const CohortExpressionBuilder: React.FC<CohortExpressionBuilderProps> = (
  props
) => {
  const {
    value,
    onChange,
    availableUsers,
    activeContractUserIds,
    everyoneShouldComplete,
  } = props;

  const visualizationUsers = useMemo(() => {
    if (everyoneShouldComplete || !activeContractUserIds) return availableUsers;
    return availableUsers.filter((u) => activeContractUserIds.has(u.id));
  }, [availableUsers, activeContractUserIds, everyoneShouldComplete]);
  const [selectedSubExpr, setSelectedSubExpr] =
    useState<CohortExpression | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareActionId, setCompareActionId] = useState<number | null>(null);
  const [compareExpression, setCompareExpression] =
    useState<CohortExpression | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleCopyExpression = useCallback(() => {
    if (value) {
      navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    }
    setMenuOpen(false);
  }, [value]);

  const handleCopyComplement = useCallback(() => {
    if (value) {
      const complement = { op: "NOT", child: value };
      navigator.clipboard.writeText(JSON.stringify(complement, null, 2));
    }
    setMenuOpen(false);
  }, [value]);

  const handlePasteExpression = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      onChange(parsed as CohortExpression);
    } catch {
      // invalid JSON or clipboard access denied — silently ignore
    }
    setMenuOpen(false);
  }, [onChange]);

  // Fetch compare action's cohort expression when selected
  useEffect(() => {
    if (!compareEnabled || !compareActionId) {
      setCompareExpression(null);
      return;
    }
    let cancelled = false;
    actionsFindOneAdmin({ path: { id: compareActionId } })
      .then((res) => {
        if (!cancelled && res.data) {
          setCompareExpression(
            (res.data.cohortExpression as unknown as CohortExpression) ?? null
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCompareExpression(null);
      });
    return () => {
      cancelled = true;
    };
  }, [compareEnabled, compareActionId]);

  const handleSetExpression = useCallback(
    (expr: CohortExpression) => {
      onChange(expr);
      setSelectedSubExpr(null);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setSelectedSubExpr(null);
  }, [onChange]);

  const handleSelectNode = useCallback((expr: CohortExpression) => {
    setSelectedSubExpr((prev) => (prev === expr ? null : expr));
  }, []);

  // Quick-add presets
  const handleAddTagPreset = () => {
    if (!value) {
      onChange({ type: "Tag", tagId: "" });
    } else if ("op" in value && value.op === "OR") {
      onChange({
        ...value,
        children: [...value.children, { type: "Tag", tagId: "" }],
      });
    } else {
      onChange({
        op: "OR",
        children: [value, { type: "Tag", tagId: "" }],
      });
    }
  };

  // Determine if we should show select hint (only for compound expressions)
  const isCompound = value && "op" in value;

  // Thread selectedExpr through props for nested components
  const propsWithSelection = { ...props, _selectedExpr: selectedSubExpr };

  return (
    <div className="space-y-3 relative">
      <div ref={menuRef} className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
        >
          <EllipsisVertical size={20} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg py-1">
            <button
              type="button"
              onClick={handleCopyExpression}
              disabled={!value}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy expression
            </button>
            <button
              type="button"
              onClick={handlePasteExpression}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste expression
            </button>
            <button
              type="button"
              onClick={handleCopyComplement}
              disabled={!value}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-white"
            >
              <CopyMinus className="h-3.5 w-3.5" />
              Copy complement cohort
            </button>
          </div>
        )}
      </div>
      {!value ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            No cohort expression set. All members will participate.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAddTagPreset}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Plus className="h-3 w-3" />
              Add Condition
            </button>
          </div>
        </div>
      ) : (
        <>
          <ExpressionNodeEditor
            expr={value}
            onChange={handleSetExpression}
            onSelect={isCompound ? handleSelectNode : undefined}
            isSelected={false}
            depth={0}
            props={propsWithSelection}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-zinc-500 hover:text-red-600"
            >
              Clear expression
            </button>
          </div>
        </>
      )}
      <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
        <CohortVisualization
          expression={value}
          selectedSubExpression={selectedSubExpr}
          users={visualizationUsers}
          compareExpression={compareEnabled ? compareExpression : null}
        />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => {
              setCompareEnabled(e.target.checked);
              if (!e.target.checked) {
                setCompareActionId(null);
                setCompareExpression(null);
              }
            }}
            className="h-4 w-4 rounded border-gray-300"
          />
          Compare to another action
        </label>
        {compareEnabled && (
          <select
            value={compareActionId ?? ""}
            onChange={(e) => {
              setCompareActionId(
                e.target.value ? parseInt(e.target.value) : null
              );
              setSelectedSubExpr(null);
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select action to compare...</option>
            {props.availableActions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default CohortExpressionBuilder;
