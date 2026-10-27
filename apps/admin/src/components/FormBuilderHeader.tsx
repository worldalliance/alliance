import type { FormSchema } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useEffect, type ComponentProps } from "react";
import { IssueTargetKind, type FormIssue } from "../lib/formIssues";
import {
  IssueGate,
  IssueList,
  issueLocation,
  type LoadFailure,
  type SourceCheck,
} from "./form-canvas/IssueList";
import { FormJsonButton } from "./FormJsonButton";
import { HistoryControls } from "./HistoryControls";

export type FormEditorTab =
  | "form"
  | "shareable"
  | "outputs"
  | "aggregates"
  | "variables"
  | "rows"
  | "skip";

export type IssueListState = { gate: IssueGate | null } | null;

const EDITOR_TABS: { tab: FormEditorTab; label: string }[] = [
  { tab: "form", label: "Form Builder" },
  { tab: "shareable", label: "Shareable Text" },
  { tab: "outputs", label: "Output View" },
  { tab: "aggregates", label: "Aggregate Views" },
  { tab: "variables", label: "Variables" },
  { tab: "rows", label: "Rows" },
  { tab: "skip", label: "Skip" },
];

export function FormBuilderHeader({
  schema,
  issues,
  onGoToIssue,
  sources,
  loadFailure,
  issueList,
  onIssueListChange,
  history,
  onEditJson,
  isPreviewMode,
  onPreviewModeChange,
  activeEditor,
  onActiveEditorChange,
  save,
}: {
  schema: FormSchema;
  issues: readonly FormIssue[];
  onGoToIssue: (issue: FormIssue) => void;
  sources: SourceCheck;
  loadFailure: LoadFailure | null;
  issueList: IssueListState;
  onIssueListChange: (issueList: IssueListState) => void;
  history: ComponentProps<typeof HistoryControls>;
  onEditJson: () => void;
  isPreviewMode: boolean;
  onPreviewModeChange: (isPreviewMode: boolean) => void;
  activeEditor: string;
  /** Null where the builder edits only the form, without the other tabs. */
  onActiveEditorChange: ((editor: FormEditorTab) => void) | null;
  save: {
    onSave: () => void;
    isSaving: boolean;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
  };
}) {
  const { onSave, isSaving, isLoading, hasUnsavedChanges } = save;
  const blockingIssues = issues.length + (loadFailure ? 1 : 0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        if (!hasUnsavedChanges || isSaving || isLoading) {
          return;
        }
        onSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSave, hasUnsavedChanges, isLoading, isSaving]);

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-end gap-4 flex-wrap xl:flex-nowrap">
        <div className="flex items-center space-x-2">
          <IssueList
            rows={issues.map((issue) => ({
              location: issueLocation(schema, issue.target),
              message: issue.message,
              onGo:
                issue.target.kind === IssueTargetKind.Form
                  ? null
                  : () => onGoToIssue(issue),
            }))}
            sources={sources}
            loadFailure={loadFailure}
            open={issueList !== null}
            gate={issueList?.gate ?? null}
            onOpenChange={(open) =>
              onIssueListChange(open ? { gate: null } : null)
            }
          />
          {!isPreviewMode && <HistoryControls {...history} />}
          {!isPreviewMode && (
            <FormJsonButton
              label="Edit form JSON"
              onClick={onEditJson}
              className="h-8 w-8 rounded-md hover:bg-gray-100"
            />
          )}
          {activeEditor === "form" && (
            <Button
              onClick={() => {
                if (isPreviewMode) {
                  onPreviewModeChange(false);
                } else if (blockingIssues > 0) {
                  onIssueListChange({ gate: IssueGate.Preview });
                } else {
                  onPreviewModeChange(true);
                }
              }}
              color={ButtonColor.Stone}
              size="small"
            >
              {isPreviewMode ? "Edit" : "Preview"}
            </Button>
          )}
          <Button
            onClick={onSave}
            disabled={isSaving || isLoading || !hasUnsavedChanges}
            color={ButtonColor.Blue}
            size="small"
          >
            {isSaving
              ? "Saving..."
              : hasUnsavedChanges
                ? "Save Form"
                : "No changes"}
          </Button>
        </div>
        {onActiveEditorChange && (
          <div className="inline-flex rounded-md bg-gray-200 p-0.5 text-sm font-medium text-gray-600">
            {EDITOR_TABS.map(({ tab, label }) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  "px-3 py-2 rounded-md text-nowrap",
                  activeEditor === tab
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-600",
                )}
                onClick={() => onActiveEditorChange(tab)}
              >
                {label}
                {tab === "variables" && (schema.variables?.length ?? 0) > 0 && (
                  <span className="ml-1.5 rounded-full bg-gray-300 px-1.5 py-0.5 text-xs text-gray-700">
                    {schema.variables?.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FormBuilderBanners({
  isLoading,
  loadFailure,
  saveError,
}: {
  isLoading: boolean;
  loadFailure: LoadFailure | null;
  saveError: string | null;
}) {
  return (
    <div className="flex-shrink-0 mx-4 min-h-0 relative">
      {isLoading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 mb-2">
          <span className="block sm:inline">Loading form...</span>
        </div>
      )}
      {loadFailure && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-2">
          <span className="block sm:inline">
            Error loading form: {loadFailure.message}
          </span>
          <button
            type="button"
            onClick={loadFailure.onRetry}
            className="ml-2 rounded border border-red-300 px-1.5 py-0.5 text-xs font-medium hover:bg-red-50"
          >
            {loadFailure.retryLabel}
          </button>
        </div>
      )}
      {saveError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-2">
          <span className="block sm:inline">
            Error saving form: {saveError}
          </span>
        </div>
      )}
    </div>
  );
}
