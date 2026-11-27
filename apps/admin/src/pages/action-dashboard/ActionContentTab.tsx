import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useEffect, useState } from "react";
import ActionFollowUpFormsTab from "../../components/ActionFollowUpFormsTab";
import ActionFormVariantsTab from "../../components/ActionFormVariantsTab";
import { FormBuilder } from "../../components/FormBuilder";
import type { FormWithSchema } from "../../components/FormResponsesView";
import Tabs, { TabsStyle } from "../../components/ui/Tabs";
import { ActionEditorSection } from "../../lib/staffTestingGate";
import { useSearchParamTab } from "../../lib/useSearchParamTab";
import ActionEditor from "./ActionEditor";
import ActionReadinessChecklist from "./ActionReadinessChecklist";
import type { ActionEditorState } from "./useActionEditor";
import type { ActionEditorLookups } from "./useActionEditorLookups";
import { ContentView, VIEW_PARAM } from "./workspaceLocation";

const VIEWS = [
  { key: ContentView.TaskForm, label: "Task form" },
  { key: ContentView.FormVariants, label: "Form variants" },
  { key: ContentView.FollowUpForms, label: "Follow-up forms" },
];

export const CopyGuidelines = () => (
  <p className="text-sm text-zinc-600">
    Before writing copy, read the{" "}
    <a
      className="text-blue-600 underline"
      href="https://docs.google.com/document/d/1vxeA31milcWRhpkGjGWHp1RQbpDFRjS541E9SzdKkFc/edit?usp=sharing"
      target="_blank"
      rel="noreferrer"
    >
      action copy guidelines
    </a>
    .
  </p>
);

/** Reports the form's unsaved edits, and clears them once it unmounts. */
const TaskFormView = ({
  action,
  setTaskFormId,
  onUnsavedChange,
}: {
  action: ParsedActionDto;
  setTaskFormId: ActionEditorState["setTaskFormId"];
  onUnsavedChange: (unsaved: boolean) => void;
}) => {
  useEffect(() => () => onUnsavedChange(false), [onUnsavedChange]);
  return (
    <FormBuilder
      formId={action.taskFormId ?? undefined}
      setFormId={setTaskFormId}
      actionName={action.name}
      onUnsavedChangesChange={onUnsavedChange}
      taskFlow
    />
  );
};

const ActionContentTab = ({
  action,
  editor,
  lookups,
  saving,
  cohortParseFailed,
  showStaffPreview,
  taskForm,
  onTaskFormUnsavedChange,
}: {
  action: ParsedActionDto;
  editor: ActionEditorState;
  lookups: ActionEditorLookups;
  saving: boolean;
  cohortParseFailed: boolean;
  showStaffPreview: boolean;
  taskForm: FormWithSchema | null;
  onTaskFormUnsavedChange: (unsaved: boolean) => void;
}) => {
  const [checklistCollapsed, setChecklistCollapsed] = useState(true);
  const [view, , viewHref] = useSearchParamTab(
    VIEWS.map(({ key }) => key),
    ContentView.TaskForm,
    { param: VIEW_PARAM },
  );

  return (
    <div className="flex flex-col gap-y-4">
      <CopyGuidelines />
      <ActionReadinessChecklist
        action={action}
        taskForm={taskForm}
        collapsed={checklistCollapsed}
        onCollapsedChange={setChecklistCollapsed}
      />
      <section id={ActionEditorSection.Details}>
        <ActionEditor
          editor={editor}
          lookups={lookups}
          action={action}
          saving={saving}
          mode={{ isNew: false, cohortParseFailed, showStaffPreview }}
        />
      </section>
      <section id={view} className="flex flex-col gap-y-3">
        <Tabs
          label="Forms"
          items={VIEWS}
          current={view}
          href={viewHref}
          style={TabsStyle.Segmented}
        />
        {(() => {
          switch (view) {
            case ContentView.TaskForm:
              return (
                <TaskFormView
                  action={action}
                  setTaskFormId={editor.setTaskFormId}
                  onUnsavedChange={onTaskFormUnsavedChange}
                />
              );
            case ContentView.FormVariants:
              return <ActionFormVariantsTab action={action} />;
            case ContentView.FollowUpForms:
              return (
                <ActionFollowUpFormsTab
                  action={action}
                  availableTags={lookups.availableTags}
                  tagsLoading={lookups.tagsLoading}
                  tagsError={lookups.tagsError}
                  availableActions={lookups.allActions}
                  actionsLoading={lookups.allActionsLoading}
                  actionsError={lookups.allActionsLoadFailed}
                  availableUsers={lookups.availableUsers}
                  usersLoading={lookups.usersLoading}
                  usersError={lookups.usersError}
                />
              );
            default:
              throw new Error(`unknown view: ${view satisfies never}`);
          }
        })()}
      </section>
    </div>
  );
};

export default ActionContentTab;
