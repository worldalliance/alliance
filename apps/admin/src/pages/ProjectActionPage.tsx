import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { useAdminTaskForm } from "@alliance/shared/lib/useTaskForm";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { FormBuilder } from "../components/FormBuilder";
import { actionPhase } from "../lib/actionPhase";
import { ActionEditorSection } from "../lib/staffTestingGate";
import ActionEditor from "./action-dashboard/ActionEditor";
import ActionReadinessChecklist from "./action-dashboard/ActionReadinessChecklist";
import { useActionCommands } from "./action-dashboard/useActionCommands";
import { useActionEditor } from "./action-dashboard/useActionEditor";
import { useActionEditorLookups } from "./action-dashboard/useActionEditorLookups";
import { taskFormWithSchema } from "./action-dashboard/useActionReporting";
import PhaseHeader from "./project-action/PhaseHeader";
import ReleasePanel from "./project-action/ReleasePanel";

const ProjectActionPage = () => {
  const params = useParams<{ projectId: string; actionId: string }>();
  const projectId = Number(params.projectId);
  const actionId = Number(params.actionId);
  const admin = useActionAdmin(actionId);
  const { action, cohortExpressionError, isUpdating, isRemoving } = admin;
  const [error, setError] = useState<string | null>(null);
  const [formUnsaved, setFormUnsaved] = useState(false);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const lookups = useActionEditorLookups();
  const taskForm = useAdminTaskForm(action?.taskFormId);
  const editor = useActionEditor({
    admin,
    actionId,
    isNew: false,
    cohortParseFailed: cohortExpressionError != null,
    searchParams,
    setError,
  });
  const { handleDelete } = useActionCommands({
    admin,
    actionId,
    form: editor.form,
    imageKey: editor.imageKey,
    imageUploading: editor.imageUploading,
    setError,
  });

  if (admin.isError) {
    return <p className="p-5 text-red-500">Failed to load action</p>;
  }
  if (!action || !editor.draftSeeded || isRemoving) {
    return <p className="p-5">Loading action…</p>;
  }
  if (action.project?.id !== projectId) {
    return (
      <Navigate
        replace
        to={
          action.project
            ? `/projects/${action.project.id}/action/${action.id}`
            : `/actions/${action.id}`
        }
      />
    );
  }

  const phase = actionPhase(action, new Date());
  const unsaved = editor.dirty || formUnsaved;

  return (
    <div className="flex max-w-6xl flex-col gap-y-5 p-5">
      <title>{action.name}</title>
      <Link
        to={`/projects/${projectId}`}
        className="flex w-fit items-center gap-x-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} />
        {action.project.name}
      </Link>
      <div className="flex items-center justify-between gap-x-3">
        <h1 className="text-xl font-bold">{action.name}</h1>
        <Link
          to={`/actions/${action.id}`}
          className="flex items-center gap-x-1 text-sm text-blue-600 hover:underline"
        >
          Full dashboard
          <ExternalLink size={14} />
        </Link>
      </div>
      <PhaseHeader
        action={action}
        phase={phase}
        unsaved={unsaved}
        busy={isUpdating}
        onStaffPreviewChange={(staffPreview) =>
          void editor.setStaffPreview(staffPreview)
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
        >
          {error}
        </div>
      )}
      <ActionReadinessChecklist
        action={action}
        taskForm={taskFormWithSchema(taskForm)}
        collapsed={checklistCollapsed}
        onCollapsedChange={setChecklistCollapsed}
      />
      <section id={ActionEditorSection.Details}>
        <ActionEditor
          editor={editor}
          lookups={lookups}
          action={action}
          saving={isUpdating}
          mode={{
            isNew: false,
            cohortParseFailed: cohortExpressionError != null,
            onDelete: handleDelete,
            checklist: null,
            hideStaffPreview: true,
          }}
        />
      </section>
      <Card style={CardStyle.White} id={ActionEditorSection.TaskForm}>
        <button
          type="button"
          onClick={() => setTaskFormOpen((open) => !open)}
          disabled={formUnsaved}
          title={formUnsaved ? "Save the task form first" : undefined}
          aria-expanded={taskFormOpen}
          className="flex items-center gap-x-2 text-lg font-semibold"
        >
          Task form
          {taskFormOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {taskFormOpen && (
          <div className="mt-3">
            <FormBuilder
              formId={action.taskFormId ?? undefined}
              setFormId={editor.setTaskFormId}
              actionName={action.name}
              onUnsavedChangesChange={setFormUnsaved}
            />
          </div>
        )}
      </Card>
      <ReleasePanel action={action} phase={phase} disabled={unsaved} />
    </div>
  );
};

export default ProjectActionPage;
