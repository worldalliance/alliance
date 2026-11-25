import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto, UserDto } from "@alliance/shared/client";
import { TaskFlowMode } from "@alliance/shared/forms/useTaskFlow";
import {
  ActionPageTaskPanelState,
  cardStylesForState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import { noop } from "@alliance/shared/lib/constants";
import { TaskFlowCompletionProvider } from "@alliance/shared/lib/TaskFlowCompletionContext";
import type { TaskFlowHost } from "@alliance/sharedweb/forms/taskflow/host";
import TaskFlow from "@alliance/sharedweb/forms/taskflow/TaskFlow";
import {
  CompletedTaskHeader,
  TaskPanelCard,
} from "@alliance/sharedweb/forms/taskflow/TaskPanelCard";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { PreviewBoundary } from "./form-canvas/ElementBoundary";

export const taskFlowPreviewCopy = {
  title: "Preview",
  description: "Nothing you enter here is saved.",
  startOver: "Start over",
  fallbackActionName: "Task preview",
};

const refuseSubmit = async (): Promise<boolean> => {
  throw new Error("A task flow preview never submits");
};

const previewHost = (panelContainer: HTMLElement | null): TaskFlowHost => ({
  useChrome: noop,
  useResume: noop,
  useCompletionExits: () => ({
    leavesToTasks: true,
    close: (finish) => finish(),
    invite: (finish) => finish(),
    signUp: null,
  }),
  panelClassName: "absolute inset-0",
  panelContainer,
});

const previewHeader = (
  <div>
    <p className="font-medium">{taskFlowPreviewCopy.title}</p>
    <p className="text-zinc-500">{taskFlowPreviewCopy.description}</p>
  </div>
);

/**
 * The members' task panel and flow for `schema`, as `user` would see it.
 * Submitting saves nothing and shows the members' completed card from the
 * answers. The full-screen panel fills `panelContainer`.
 */
export function TaskFlowPreview({
  schema,
  user,
  previewUserId,
  actionName,
  panelContainer,
}: {
  schema: FormSchema;
  user: UserDto;
  previewUserId: number | "preview";
  actionName: string | undefined;
  panelContainer: HTMLElement | null;
}) {
  const [completed, setCompleted] = useState<FormResponseDto | null>(null);
  const host = useMemo(() => previewHost(panelContainer), [panelContainer]);

  const flowProps = {
    host,
    viewer: {
      user,
      isAuthenticated: true,
      isImpersonation: false,
      userLoading: false,
      previewUserId,
    },
    action: {
      id: 0,
      name: actionName ?? taskFlowPreviewCopy.fallbackActionName,
    },
    schema,
    formId: 0,
    taskFormId: 0,
    formSnapshotId: null,
    draftFormResponse: undefined,
    phDistinctId: "",
    sessionReplayUrl: undefined,
    submitTaskForm: refuseSubmit,
    submitError: null,
    onCompleteAction: noop,
    onFormStarted: noop,
  };

  return (
    <PreviewBoundary resetKeys={[schema, previewUserId]}>
      <TaskFlowCompletionProvider>
        {completed ? (
          <TaskPanelCard
            header={
              <CompletedTaskHeader>
                <button
                  type="button"
                  className="flex min-h-6 items-center gap-x-1.5 text-sm text-zinc-500 hover:text-zinc-700"
                  onClick={() => setCompleted(null)}
                >
                  <RotateCcw className="size-3.5 shrink-0" aria-hidden />
                  {taskFlowPreviewCopy.startOver}
                </button>
              </CompletedTaskHeader>
            }
            styles={cardStylesForState(ActionPageTaskPanelState.Completed)}
          >
            <TaskFlow
              {...flowProps}
              key="completed"
              mode={TaskFlowMode.ReadOnly}
              completedFormResponse={completed}
            />
          </TaskPanelCard>
        ) : (
          <TaskPanelCard
            header={previewHeader}
            styles={cardStylesForState(ActionPageTaskPanelState.StaffPreview)}
          >
            <TaskFlow
              {...flowProps}
              key="preview"
              mode={TaskFlowMode.Preview}
              onPreviewCompleted={setCompleted}
            />
          </TaskPanelCard>
        )}
      </TaskFlowCompletionProvider>
    </PreviewBoundary>
  );
}
