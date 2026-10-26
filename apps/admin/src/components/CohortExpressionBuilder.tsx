import {
  cohortExpressionSchema,
  isBooleanOperator,
  isLeafCondition,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import {
  ClipboardPaste,
  Copy,
  CopyMinus,
  EllipsisVertical,
  Plus,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BranchRouting } from "../lib/useBranchRoutingPreviewAdmin";
import type { CohortLeafEditorSources } from "./CohortLeafEditors";
import CohortVisualization from "./CohortVisualization";
import ExpressionNodeEditor from "./ExpressionNodeEditor";

interface CohortExpressionBuilderProps extends CohortLeafEditorSources {
  value: CohortExpression | null | undefined;
  onChange: (value: CohortExpression | null) => void;
  activeContractUserIds?: Set<number>;
  onboarding?: boolean;
  routing?: BranchRouting;
}

const CohortExpressionBuilder: React.FC<CohortExpressionBuilderProps> = (
  props,
) => {
  const { value, onChange, availableUsers, activeContractUserIds, onboarding } =
    props;

  const { error: pushError } = useToast();

  const visualizationUsers = useMemo(() => {
    if (onboarding || !activeContractUserIds) return availableUsers;
    return availableUsers.filter((u) => activeContractUserIds.has(u.id));
  }, [availableUsers, activeContractUserIds, onboarding]);
  const [selectedSubExpr, setSelectedSubExpr] =
    useState<CohortExpression | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareActionId, setCompareActionId] = useState<number | null>(null);
  const {
    action: compareAction,
    cohortExpressionError: compareParseError,
    isError: compareLoadFailed,
  } = useActionAdmin(compareEnabled ? compareActionId : null);
  const compareExpression = compareAction?.cohortExpression ?? null;

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

  const copyJson = useCallback(
    async (json: unknown) => {
      if (!(await copyToClipboard(JSON.stringify(json, null, 2)))) {
        pushError("Could not copy to the clipboard");
      }
    },
    [pushError],
  );

  const handleCopyExpression = useCallback(() => {
    if (value) void copyJson(value);
    setMenuOpen(false);
  }, [value, copyJson]);

  const handleCopyComplement = useCallback(() => {
    if (value) void copyJson({ type: "NOT", child: value });
    setMenuOpen(false);
  }, [value, copyJson]);

  const handlePasteExpression = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = cohortExpressionSchema.safeParse(JSON.parse(text));
      if (parsed.success) {
        onChange(parsed.data);
      } else {
        pushError("Clipboard does not contain a valid cohort expression");
      }
    } catch {
      pushError("Failed to paste — invalid JSON or clipboard not available");
    }
    setMenuOpen(false);
  }, [onChange, pushError]);

  const toastedCompareActionId = useRef<number | null>(null);
  useEffect(() => {
    if (!compareLoadFailed && !compareParseError) {
      toastedCompareActionId.current = null;
      return;
    }
    if (toastedCompareActionId.current === compareActionId) return;
    toastedCompareActionId.current = compareActionId;
    pushError("Failed to load the compare action's cohort expression");
  }, [compareLoadFailed, compareParseError, compareActionId, pushError]);

  const handleSetExpression = useCallback(
    (expr: CohortExpression) => {
      onChange(expr);
      setSelectedSubExpr(null);
    },
    [onChange],
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
      return;
    }
    const wrapInOr = () =>
      onChange({ type: "OR", children: [value, { type: "Tag", tagId: "" }] });
    if (isLeafCondition(value)) {
      wrapInOr();
      return;
    }
    switch (value.type) {
      case "OR":
        onChange({
          ...value,
          children: [...value.children, { type: "Tag", tagId: "" }],
        });
        break;
      case "AND":
      case "NOT":
        wrapInOr();
        break;
      default:
        throw new Error(
          `unknown operator: ${JSON.stringify(value satisfies never)}`,
        );
    }
  };

  // Determine if we should show select hint (only for compound expressions)
  const isCompound = value && isBooleanOperator(value);

  // Thread selectedExpr through props for nested components
  const propsWithSelection = { ...props, selectedExpr: selectedSubExpr };

  return (
    <div className="space-y-3 relative">
      <div ref={menuRef} className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1 text-gray-600 hover:text-gray-600 rounded hover:bg-gray-100"
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
            No cohort set — no users will participate. Add a condition to target
            users.
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
            context={propsWithSelection}
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
          compareExpression={compareExpression}
          routing={props.routing}
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
              }
            }}
            className="h-4 w-4 rounded border-gray-300"
          />
          Compare to another action
        </label>
        {compareEnabled && (
          <select
            value={compareActionId ?? ""}
            disabled={props.actionsLoading}
            onChange={(e) => {
              setCompareActionId(
                e.target.value ? parseInt(e.target.value) : null,
              );
              setSelectedSubExpr(null);
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          >
            <option value="">
              {props.actionsLoading
                ? "Loading actions…"
                : props.actionsError
                  ? "Couldn't load actions"
                  : "Select action to compare..."}
            </option>
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
