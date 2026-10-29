import { type FormSchema } from "@alliance/common/forms/form-schema";
import {
  type ActionDto,
  type FormResponseDto,
  type SubmitFormDto,
} from "@alliance/shared/client";
import {
  useFlowPosition,
  type FlowPositionStorage,
} from "@alliance/shared/forms/useFlowPosition";
import { FlowStage, useTaskFlow } from "@alliance/shared/forms/useTaskFlow";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow } from "@alliance/shared/lib/copy";
import {
  useReopenLeftTask,
  useTaskFlowReturn,
} from "@alliance/shared/lib/TaskFlowReturnContext";
import { cn } from "@alliance/shared/styles/util";
import { StickyAccordionTitles } from "@alliance/sharedweb/forms/accordionStyles";
import { formBlockedView } from "@alliance/sharedweb/forms/FormElements";
import { useWebFormState } from "@alliance/sharedweb/forms/useWebFormState";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../lib/AuthContext";
import {
  ImmersiveTone,
  useImmersiveNavbar,
} from "../../lib/NavbarOptionsContext";
import ProgressBar from "../system/ProgressBar";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { afterMotion, flowMotion, transition } from "./flowMotion";
import TaskFlowComplete from "./TaskFlowComplete";
import TaskFlowIntro from "./TaskFlowIntro";
import TaskFlowScreen, {
  FLOW_COLUMN,
  TaskFlowPage,
  TaskFlowTitle,
} from "./TaskFlowScreen";
import { useExpandingPanel } from "./useExpandingPanel";

const PROGRESS_TRANSITION = transition(flowMotion.progress, "width");

const isTaskPage = (path: string, actionId: number) =>
  matchPath("/actions/:id", path)?.params.id === String(actionId);

const localFlowStorage: FlowPositionStorage = {
  getItem: async (key) => window.localStorage.getItem(key),
  setItem: async (key, value) => window.localStorage.setItem(key, value),
  removeItem: async (key) => window.localStorage.removeItem(key),
};

type TaskFlowProps = {
  action: ActionDto;
  schema: FormSchema;
  formId: number;
  taskFormId: number;
  formSnapshotId: number;
  draftFormResponse: FormResponseDto | null | undefined;
  phDistinctId: string;
  sessionReplayUrl: string | undefined;
  submitTaskForm: (data: SubmitFormDto) => Promise<boolean>;
  submitError: string | null;
  onCompleteAction: () => void;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
};

/**
 * `onCompleteAction` runs only once the member leaves the completion screen,
 * since completing the action unmounts this panel.
 */
export default function TaskFlow({
  action,
  schema,
  formId,
  taskFormId,
  formSnapshotId,
  draftFormResponse,
  phDistinctId,
  sessionReplayUrl,
  submitTaskForm,
  submitError,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
}: TaskFlowProps) {
  const { user, isAuthenticated, loading: userLoading } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Leaving through the nav or the browser's Back unmounts the flow before
  // its buttons can complete the action, even while the submit is in flight.
  const completionPending = useRef(false);
  const submitInFlight = useRef(false);
  const unmounted = useRef(false);
  const onCompleteActionRef = useRef(onCompleteAction);
  onCompleteActionRef.current = onCompleteAction;
  const completeAction = useCallback(() => {
    if (!completionPending.current) return;
    completionPending.current = false;
    onCompleteActionRef.current();
  }, []);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      completeAction();
    };
  }, [completeAction]);
  const submit = async (data: SubmitFormDto) => {
    submitInFlight.current = true;
    try {
      const submitted = await submitTaskForm(data);
      if (submitted) {
        completionPending.current = true;
        if (unmounted.current) completeAction();
      }
      return submitted;
    } finally {
      submitInFlight.current = false;
    }
  };

  const form = useWebFormState({
    form: schema,
    id: formId,
    formSnapshotId,
    actionId: action.id,
    persistKey: String(taskFormId),
    userId: user?.id,
    user,
    userLoading,
    loadCurrentUserLocation: !!user && isAuthenticated,
    syncDraftToServer: isAuthenticated,
    draftFormResponse,
    phDistinctId,
    sessionReplayUrl,
    onFormStarted,
    onAbandonAction,
    onSubmit: submit,
    scrollContainerRef: scrollRef,
  });
  const position = useFlowPosition({
    taskFormId,
    formSnapshotId,
    storage: localFlowStorage,
  });
  const flow = useTaskFlow({
    actionId: action.id,
    form,
    position,
    onExit: () => void close(),
  });
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { leaveTask } = useTaskFlowReturn();

  // Navigating away mid-task (the browser's Back, say) unmounts the flow.
  // Only the task's own page reopens it, as on mobile.
  const openRef = useRef(flow.open);
  openRef.current = flow.open;
  const mountedPathRef = useRef(pathname);
  useEffect(
    () => () => {
      const mountedPath = mountedPathRef.current;
      if (
        openRef.current &&
        !submitInFlight.current &&
        isTaskPage(mountedPath, action.id) &&
        window.location.pathname !== mountedPath
      ) {
        leaveTask(action.id);
      }
    },
    [action.id, leaveTask],
  );

  useReopenLeftTask({
    actionId: action.id,
    onTaskPage: isTaskPage(pathname, action.id),
    ready: position.loaded && form.visibilitySettled,
    begin: flow.begin,
  });

  const anchorRef = useRef<HTMLDivElement>(null);
  const { panel, panelRef, collapse } = useExpandingPanel(anchorRef);
  const closing = useRef(false);
  const [recoloring, setRecoloring] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const shown = flow.stage !== FlowStage.Closed && !shrunk;
  useImmersiveNavbar({
    immersive: shown,
    tone:
      flow.stage === FlowStage.Complete && !recoloring
        ? ImmersiveTone.Success
        : ImmersiveTone.Plain,
  });

  // A submit that lands mid-close would complete the task behind a closed flow.
  const close = async (then?: () => void) => {
    if (closing.current || form.submitting) return;
    closing.current = true;
    const complete = flow.stage === FlowStage.Complete;
    if (complete) {
      setRecoloring(true);
      await afterMotion(flowMotion.recolor);
    }
    await collapse();
    if (complete) {
      // Completing re-renders the page behind, which would stall the nav's
      // width transition, so the stage and the held page wait for it.
      setShrunk(true);
      await afterMotion(flowMotion.nav, flowMotion.fade);
    }
    closing.current = false;
    setRecoloring(false);
    setShrunk(false);
    flow.close();
    then?.();
  };
  const finish = (then?: () => void) =>
    close(() => {
      completeAction();
      then?.();
    });

  const renderStage = () => {
    const blocked = formBlockedView(form);
    if (blocked !== null && flow.stage !== FlowStage.Complete) {
      return (
        <TaskFlowPage onClose={() => void close()}>
          <TaskFlowTitle>{action.name}</TaskFlowTitle>
          {blocked}
        </TaskFlowPage>
      );
    }
    switch (flow.stage) {
      case FlowStage.Closed:
        return null;
      case FlowStage.Background:
        return (
          <TaskFlowIntro
            action={action}
            form={form}
            background={flow.background}
            onClose={() => void close()}
            onWithdraw={
              onAbandonAction
                ? (withdrawal) => {
                    form.handleAbandon(withdrawal);
                    position.clear();
                    flow.close();
                  }
                : null
            }
            onNext={() => void flow.start()}
            isLast={flow.backgroundIsLast}
            error={submitError}
          />
        );
      case FlowStage.Screens:
        if (!flow.screen) return null;
        return (
          <TaskFlowScreen
            key={flow.screenIndex}
            form={form}
            screen={flow.screen}
            nextReady={flow.nextReady}
            isLast={flow.isLast}
            error={submitError}
            scrollRef={scrollRef}
            onClose={() => void close()}
            onBack={flow.back}
            onNext={() => void flow.next()}
          />
        );
      case FlowStage.Complete:
        return (
          <TaskFlowComplete
            schema={form.schema}
            answers={flow.submittedAnswers ?? {}}
            user={user}
            fading={recoloring}
            onClose={() => void finish()}
            onInvite={() => void finish(() => navigate("/invites"))}
          />
        );
      default:
        throw new Error(`unknown flow stage: ${flow.stage satisfies never}`);
    }
  };

  return (
    <div ref={anchorRef}>
      <FlowButton
        kind={FlowButtonKind.Primary}
        className={cn(
          "w-full",
          flow.stage === FlowStage.Complete && "invisible",
        )}
        onClick={flow.begin}
        disabled={!position.loaded}
      >
        {taskFlow.begin}
      </FlowButton>
      <Dialog.Root
        open={shown}
        modal={false}
        onOpenChange={(open, details) => {
          // The nav stays usable beside the flow, so only Escape dismisses it.
          if (
            open ||
            details.reason !== "escape-key" ||
            details.event.defaultPrevented
          ) {
            return;
          }
          void (flow.stage === FlowStage.Complete ? finish() : close());
        }}
      >
        <Dialog.Portal>
          <Dialog.Popup
            ref={panelRef}
            initialFocus={panel}
            className={cn(
              zIndex.drawer,
              "fixed inset-0 flex flex-col bg-white outline-none md:top-[var(--navbar-top-bar-height)] md:left-[var(--nav-width)]",
            )}
          >
            <StickyAccordionTitles.Provider value>
              {renderStage()}
            </StickyAccordionTitles.Provider>
            {flow.open ? (
              <div className={cn(FLOW_COLUMN, "pb-4")}>
                <ProgressBar
                  progress={flow.progress}
                  total={100}
                  fillTransition={PROGRESS_TRANSITION}
                />
              </div>
            ) : null}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
