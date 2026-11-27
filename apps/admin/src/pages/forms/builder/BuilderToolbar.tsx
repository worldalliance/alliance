import { IssueTargetKind } from "../../../lib/formIssues";
import Badge from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Kbd } from "../../../ui/Kbd";
import { Tabs, TabsList, TabsTab } from "../../../ui/Tabs";
import { WorkspaceToolbar } from "../../../ui/templates/Workspace";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../ui/Tooltip";
import { useBuilder } from "./BuilderContext";
import { issueLocation } from "./issues/IssueList";
import { IssuesButton } from "./IssuesButton";
import { LiveFormStatus } from "./LiveFormStatus";
import { SaveStatus } from "./SaveStatus";
import { FormEditor } from "./useFormBuilder";

const EDITOR_LABELS: Record<FormEditor, string> = {
  [FormEditor.Form]: "Form",
  [FormEditor.Shareable]: "Shareable text",
  [FormEditor.Outputs]: "Output views",
  [FormEditor.Aggregates]: "Aggregates",
  [FormEditor.Variables]: "Formulas",
  [FormEditor.Rows]: "Rows",
};

const EDITORS = Object.values(FormEditor);

/** Across the builder: its editors, what blocks saving, who a save reaches, and Save. */
export function BuilderToolbar() {
  const {
    schema,
    issues,
    goToIssue,
    sources,
    loadFailure,
    issueList,
    setIssueList,
    activeEditor,
    setActiveEditor,
    reach,
    saveStatus,
    requestSave,
    save: { isSaving },
    saved: { isLoading },
    props: { displayOnly },
  } = useBuilder();
  const formulas = schema.variables?.length ?? 0;
  const hideCount = isLoading || formulas === 0;

  return (
    <WorkspaceToolbar>
      {!displayOnly && (
        <Tabs
          value={activeEditor}
          onValueChange={(editor: FormEditor) => setActiveEditor(editor)}
          className="min-w-0 flex-1"
        >
          <TabsList
            aria-label="Editors"
            className="overflow-x-auto overflow-y-hidden border-b-0"
          >
            {EDITORS.map((editor) => (
              <TabsTab key={editor} value={editor} className="h-14">
                {EDITOR_LABELS[editor]}
                {editor === FormEditor.Variables && (
                  // Laid out with no formulas and while loading, so the count landing moves no tab.
                  <span
                    aria-hidden={hideCount}
                    className={cn("flex", hideCount && "invisible")}
                  >
                    <Badge>{formulas}</Badge>
                  </span>
                )}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <IssuesButton
          rows={issues.map((issue) => ({
            location: issueLocation(schema, issue.target),
            message: issue.message,
            onGo:
              issue.target.kind === IssueTargetKind.Form
                ? null
                : () => goToIssue(issue),
          }))}
          sources={sources}
          loadFailure={loadFailure}
          loading={isLoading}
          open={issueList !== null}
          gate={issueList?.gate ?? null}
          onOpenChange={(open) => setIssueList(open ? { gate: null } : null)}
        />
        <LiveFormStatus reach={reach} />
        <SaveStatus status={saveStatus} />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={ButtonVariant.Primary}
                size="small"
                busy={isSaving}
                disabled={isLoading}
                onClick={requestSave}
              >
                {displayOnly ? "Save content" : "Save form"}
              </Button>
            }
          />
          <TooltipContent>
            <Kbd>⌘S</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </WorkspaceToolbar>
  );
}
