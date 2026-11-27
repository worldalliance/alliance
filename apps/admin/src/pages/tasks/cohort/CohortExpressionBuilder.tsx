import {
  cohortExpressionSchema,
  isBooleanOperator,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import {
  ChevronDown,
  ClipboardPaste,
  Copy,
  CopyMinus,
  Plus,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Button, { ButtonVariant, buttonVariants } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { cn } from "../../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import InlineError from "../../../ui/InlineError";
import { Select } from "../../../ui/Select";
import { useToast } from "../../../ui/ToastProvider";
import type { CohortLeafEditorSources } from "./CohortLeafEditors";
import { createDefaultLeaf } from "./cohortRules";
import CohortVisualization from "./CohortVisualization";
import ExpressionNodeEditor, { TYPE_SELECT } from "./ExpressionNodeEditor";

interface CohortExpressionBuilderProps extends CohortLeafEditorSources {
  value: CohortExpression | null | undefined;
  onChange: (value: CohortExpression | null) => void;
  activeContractUserIds?: Set<number>;
  onboarding?: boolean;
  /** What an empty cohort means where the builder is mounted. */
  emptyHint?: ReactNode;
  /** The stored cohort failed to parse, so `value` is null but the cohort isn't empty. */
  unreadable?: boolean;
}

const DEFAULT_EMPTY_HINT = "No conditions, so no members match.";

const CohortExpressionBuilder: React.FC<CohortExpressionBuilderProps> = (
  props,
) => {
  const {
    value,
    onChange,
    availableUsers,
    activeContractUserIds,
    onboarding,
    emptyHint = DEFAULT_EMPTY_HINT,
    unreadable = false,
  } = props;
  const { success } = useToast();

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
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [focusAdd, setFocusAdd] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);
  const [focusRow, setFocusRow] = useState(false);

  useEffect(() => {
    if (!focusAdd) return;
    setFocusAdd(false);
    addRef.current?.focus();
  }, [focusAdd]);

  useEffect(() => {
    if (!focusRow) return;
    setFocusRow(false);
    treeRef.current?.querySelector<HTMLElement>(`[${TYPE_SELECT}]`)?.focus();
  }, [focusRow]);

  const copyJson = useCallback(
    async (json: CohortExpression, done: string) => {
      if (await copyToClipboard(JSON.stringify(json, null, 2))) {
        setClipboardError(null);
        success(done);
      } else {
        setClipboardError("Couldn't copy to the clipboard.");
      }
    },
    [success],
  );

  const pasteExpression = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = cohortExpressionSchema.safeParse(JSON.parse(text));
      if (parsed.success) {
        setClipboardError(null);
        onChange(parsed.data);
        setSelectedSubExpr(null);
      } else {
        setClipboardError(
          "The clipboard doesn't hold a valid cohort expression.",
        );
      }
    } catch {
      setClipboardError(
        "Couldn't paste: the clipboard isn't readable or isn't JSON.",
      );
    }
  }, [onChange]);

  const setExpression = (expr: CohortExpression | null) => {
    onChange(expr);
    setSelectedSubExpr(null);
  };

  const toggleSelected = useCallback((expr: CohortExpression) => {
    setSelectedSubExpr((prev) => (prev === expr ? null : expr));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-caption font-medium text-fg-muted">
            Members who match
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex",
                buttonVariants({ variant: ButtonVariant.Ghost, size: "small" }),
              )}
            >
              Copy or paste
              <ChevronDown aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem
                disabled={!value}
                onClick={() =>
                  value && void copyJson(value, "Copied the cohort")
                }
              >
                <Copy aria-hidden className="size-4 text-fg-muted" />
                Copy expression
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={unreadable}
                onClick={() => void pasteExpression()}
              >
                <ClipboardPaste aria-hidden className="size-4 text-fg-muted" />
                Paste expression
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!value}
                onClick={() =>
                  value &&
                  void copyJson(
                    { type: "NOT", child: value },
                    "Copied the complement cohort",
                  )
                }
              >
                <CopyMinus aria-hidden className="size-4 text-fg-muted" />
                Copy complement cohort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <InlineError message={clipboardError} />
        {unreadable ? (
          <p className="text-fg-muted">
            The stored cohort couldn&apos;t be read, so its conditions and
            members aren&apos;t shown.
          </p>
        ) : value ? (
          <div ref={treeRef}>
            <ExpressionNodeEditor
              expr={value}
              onChange={setExpression}
              onSelect={isBooleanOperator(value) ? toggleSelected : undefined}
              isSelected={false}
              depth={0}
              context={{ ...props, selectedExpr: selectedSubExpr }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-fg-muted">{emptyHint}</p>
            <Button
              ref={addRef}
              variant={ButtonVariant.Default}
              size="small"
              onClick={() => {
                onChange(createDefaultLeaf("Tag"));
                setFocusRow(true);
              }}
            >
              <Plus aria-hidden className="size-4" />
              Add condition
            </Button>
          </div>
        )}
        {value && !unreadable && (
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            className="text-fg-muted"
            onClick={() => {
              setExpression(null);
              setFocusAdd(true);
            }}
          >
            Clear all conditions
          </Button>
        )}
      </div>

      {!unreadable && (
        <div className="rounded-card bg-surface-2 p-4">
          <CohortVisualization
            expression={value}
            selectedSubExpression={selectedSubExpr}
            users={visualizationUsers}
            compareExpression={compareExpression}
            usersLoading={props.usersLoading}
            usersError={props.usersError}
          />
        </div>
      )}

      {!unreadable && (
        <div className="flex flex-col gap-2">
          <label className="flex w-fit items-center gap-2">
            <Checkbox
              checked={compareEnabled}
              onChange={(e) => {
                setCompareEnabled(e.target.checked);
                if (!e.target.checked) setCompareActionId(null);
              }}
            />
            Compare with another task&apos;s cohort
          </label>
          {compareEnabled && (
            <>
              <Select
                aria-label="Task to compare with"
                value={compareActionId ?? ""}
                disabled={props.actionsLoading}
                onChange={(e) => {
                  setCompareActionId(
                    e.target.value ? parseInt(e.target.value) : null,
                  );
                  setSelectedSubExpr(null);
                }}
              >
                <option value="">
                  {props.actionsLoading
                    ? "Loading tasks…"
                    : props.actionsError
                      ? "Couldn't load tasks"
                      : "Choose a task to compare…"}
                </option>
                {props.availableActions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <InlineError
                message={
                  compareLoadFailed
                    ? "Couldn't load that task's cohort."
                    : compareParseError
                      ? "That task's stored cohort couldn't be read, so it can't be compared."
                      : null
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CohortExpressionBuilder;
