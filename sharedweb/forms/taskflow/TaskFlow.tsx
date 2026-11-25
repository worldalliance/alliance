import { type FormSchema } from "@alliance/common/forms/form-schema";
import {
  type ActionDto,
  type FormResponseDto,
  type SubmitFormDto,
} from "@alliance/shared/client";
import { type DraftFetchState } from "@alliance/shared/forms/draftFetchState";
import {
  useFlowPosition,
  type FlowPositionStorage,
} from "@alliance/shared/forms/useFlowPosition";
import {
  FlowStage,
  TASK_FLOW_MODE_RULES,
  useTaskFlow,
  type TaskFlowMode,
} from "@alliance/shared/forms/useTaskFlow";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { StickyAccordionTitles } from "@alliance/sharedweb/forms/accordionStyles";
import { formBlockedView } from "@alliance/sharedweb/forms/FormElements";
import { PhoneConfirmSlot } from "@alliance/sharedweb/forms/phoneConfirmSlot";
import { useWebFormState } from "@alliance/sharedweb/forms/useWebFormState";
import ProgressBar from "@alliance/sharedweb/ui/ProgressBar";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight } from "lucide-react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardMenuSlotContext } from "./CardMenuSlot";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { afterMotion, flowMotion, transition } from "./flowMotion";
import {
  ImmersiveTone,
  type FinishFlow,
  type TaskFlowHost,
  type TaskFlowViewer,
} from "./host";
import TaskAnswersCard from "./TaskAnswersCard";
import TaskFlowComplete, {
  COMPLETION_TONE,
  useCompletionPhase,
} from "./TaskFlowComplete";
import TaskFlowHeader, {
  TaskFlowWithdrawMenu,
  type FlowWithdrawHandler,
} from "./TaskFlowHeader";
import TaskFlowScreen, {
  FLOW_COLUMN,
  TaskFlowPage,
  TaskFlowTitle,
} from "./TaskFlowScreen";
import TaskOutline from "./TaskOutline";
import { useExpandingPanel } from "./useExpandingPanel";

const PROGRESS_TRANSITION = transition(flowMotion.progress, "width");

const localFlowStorage: FlowPositionStorage = {
  getItem: async (key) => window.localStorage.getItem(key),
  setItem: async (key, value) => window.localStorage.setItem(key, value),
  removeItem: async (key) => window.localStorage.removeItem(key),
};

type TaskFlowProps = {
  host: TaskFlowHost;
  viewer: TaskFlowViewer;
  action: Pick<ActionDto, "id" | "name">;
  mode: TaskFlowMode;
  /** The submission a read-only flow shows. */
  completedFormResponse?: FormResponseDto;
  publicAction?: boolean;
  schema: FormSchema;
  formId: number;
  taskFormId: number;
  /** Null for a schema that isn't saved yet. */
  formSnapshotId: number | null;
  draftFormResponse: FormResponseDto | null | undefined;
  guestDraftFetch?: DraftFetchState;
  phDistinctId: string;
  sessionReplayUrl: string | undefined;
  submitTaskForm: (data: SubmitFormDto) => Promise<boolean>;
  submitError: string | null;
  onCompleteAction: () => void;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  /** Where a guest's completion screen offers to sign up. */
  signupHref?: string;
};

/**
 * `onCompleteAction` runs only once the member leaves the completion screen
 * of a live flow, since completing the action unmounts this panel.
 */
export default function TaskFlow({
  host,
  viewer,
  action,
  mode,
  completedFormResponse,
  publicAction = false,
  schema,
  formId,
  taskFormId,
  formSnapshotId,
  draftFormResponse,
  guestDraftFetch,
  phDistinctId,
  sessionReplayUrl,
  submitTaskForm,
  submitError,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  signupHref,
}: TaskFlowProps) {
  const { user, isAuthenticated, isImpersonation, userLoading, previewUserId } =
    viewer;
  const signedInAsUser = previewUserId === undefined;
  const menuSlot = useContext(CardMenuSlotContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { records, readOnly, withdraws } = TASK_FLOW_MODE_RULES[mode];
  if (records && (!signedInAsUser || formSnapshotId === null)) {
    throw new Error(
      "A staff preview or an unsaved form runs only in a mode that records nothing",
    );
  }
  const withdraw = withdraws && !publicAction ? onAbandonAction : undefined;
  const { useResume, useChrome, useCompletionExits } = host;

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
    persistKey: records ? String(taskFormId) : null,
    userId: previewUserId ?? user?.id,
    adminPreviewUserId: previewUserId,
    user,
    userLoading,
    loadCurrentUserLocation: !!user && isAuthenticated && signedInAsUser,
    syncDraftToServer: records && isAuthenticated && !publicAction,
    draftFormResponse: records ? draftFormResponse : undefined,
    guestDraftFetch: records ? guestDraftFetch : undefined,
    renderFormAsCompleted: readOnly,
    completedFormResponse,
    phDistinctId,
    sessionReplayUrl,
    onFormStarted,
    onAbandonAction: withdraw,
    onSubmit: records ? submit : null,
    scrollContainerRef: scrollRef,
  });
  const position = useFlowPosition({
    taskFormId,
    formSnapshotId: formSnapshotId ?? 0,
    storage: localFlowStorage,
  });
  const flow = useTaskFlow({
    actionId: action.id,
    mode,
    form,
    position,
    onExit: () => void close(),
  });
  useResume({
    actionId: action.id,
    open: flow.open,
    submitInFlight,
    ready: position.loaded && form.visibilitySettled,
    begin: flow.begin,
  });
  const {
    leavesToTasks,
    close: closeExit,
    invite,
    signUp,
  } = useCompletionExits({ isAuthenticated, signupHref });

  const anchorRef = useRef<HTMLDivElement>(null);
  const { panel, panelRef, collapse } = useExpandingPanel(anchorRef);
  const closing = useRef(false);
  const [recoloring, setRecoloring] = useState(false);
  const [navReleased, setNavReleased] = useState(false);
  const shown = flow.stage !== FlowStage.Closed;
  const complete = flow.stage === FlowStage.Complete;
  const completionPhase = useCompletionPhase(complete);
  const tone =
    complete && !recoloring
      ? COMPLETION_TONE[completionPhase]
      : ImmersiveTone.Plain;
  useChrome({
    immersive: shown && !navReleased,
    panelUp: shown,
    tone,
  });

  // A submit that lands mid-close would complete the task behind a closed flow.
  const close = async (then?: () => void) => {
    if (closing.current || form.submitting) return;
    closing.current = true;
    if (complete) {
      setRecoloring(true);
      await afterMotion(flowMotion.recolor);
    }
    // The nav widens before the panel shrinks, so the panel shrinks into the
    // card where it will rest, and completing the task, which re-renders the
    // page behind, can't stall the nav's width transition.
    setNavReleased(true);
    await afterMotion(flowMotion.nav, flowMotion.fade);
    await collapse();
    closing.current = false;
    setRecoloring(false);
    setNavReleased(false);
    flow.close();
    then?.();
  };
  const finish = (then?: () => void) =>
    close(() => {
      completeAction();
      then?.();
    });
  const finishFlow: FinishFlow = (then) => void finish(then);

  const onWithdraw: FlowWithdrawHandler | null = withdraw
    ? (withdrawal) => {
        form.handleAbandon(withdrawal);
        position.clear();
        flow.close();
      }
    : null;

  const blocked = formBlockedView(form, {
    showDetail: !signedInAsUser,
    draft: formSnapshotId === null,
  });
  const renderStage = () => {
    if (blocked !== null && flow.stage !== FlowStage.Complete) {
      return (
        <TaskFlowPage>
          <TaskFlowTitle>{action.name}</TaskFlowTitle>
          {blocked}
        </TaskFlowPage>
      );
    }
    switch (flow.stage) {
      case FlowStage.Closed:
        return null;
      case FlowStage.Screens:
        if (!flow.screen) return null;
        return (
          <TaskFlowScreen
            key={flow.screenIndex}
            form={form}
            screen={flow.screen}
            nextReady={flow.nextReady}
            nextLabel={flow.nextLabel}
            nextIsLast={flow.nextIsLast}
            error={submitError}
            scrollRef={scrollRef}
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
            showsOwnLocation={signedInAsUser}
            phase={completionPhase}
            fading={recoloring}
            leavesToTasks={leavesToTasks}
            onClose={() => closeExit(finishFlow)}
            onInvite={invite && (() => invite(finishFlow))}
            onSignUp={signUp && (() => signUp(finishFlow))}
          />
        );
      default:
        throw new Error(`unknown flow stage: ${flow.stage satisfies never}`);
    }
  };

  const withdrawMenu =
    onWithdraw && flow.stage === FlowStage.Closed ? (
      <TaskFlowWithdrawMenu
        disabled={form.submitting}
        onWithdraw={onWithdraw}
      />
    ) : null;

  return (
    <div ref={anchorRef}>
      {flow.outline === null ? (
        <div className="flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {flow.outline.length > 0 ? (
            <TaskOutline
              steps={flow.outline}
              className={cn("mb-6", complete && "invisible")}
            />
          ) : null}
          <div className={cn("flex gap-x-3", complete && "invisible")}>
            <FlowButton
              kind={
                readOnly ? FlowButtonKind.Secondary : FlowButtonKind.Primary
              }
              className="flex-1"
              onClick={flow.begin}
              disabled={!position.loaded}
              iconRight={ArrowRight}
            >
              {flow.beginLabel}
            </FlowButton>
            {menuSlot === undefined ? withdrawMenu : null}
          </div>
        </>
      )}
      {menuSlot && withdrawMenu && createPortal(withdrawMenu, menuSlot)}
      {completedFormResponse ? (
        <TaskAnswersCard
          className="mt-4 border border-zinc-200"
          output={{
            schema,
            submission: completedFormResponse,
            submitterId: user?.id,
          }}
          user={user}
          showsOwnLocation={signedInAsUser}
        />
      ) : null}
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
        <Dialog.Portal container={host.panelContainer}>
          <Dialog.Popup
            ref={panelRef}
            initialFocus={panel}
            className={cn(
              zIndex.drawer,
              "flex flex-col bg-white outline-none",
              host.panelClassName,
            )}
          >
            {flow.open ? (
              <>
                <div className={cn(FLOW_COLUMN, "pt-8")}>
                  <ProgressBar
                    progress={flow.progress}
                    total={100}
                    label={taskFlow.progress}
                    fillTransition={PROGRESS_TRANSITION}
                  />
                </div>
                <TaskFlowHeader
                  onClose={() => void close()}
                  disabled={form.submitting}
                  progressSaved={
                    blocked === null && !form.saveFailed && flow.progressSaved
                  }
                  onWithdraw={blocked === null ? onWithdraw : null}
                />
              </>
            ) : null}
            <StickyAccordionTitles.Provider value>
              <PhoneConfirmSlot.Provider
                value={
                  records && isAuthenticated && !isImpersonation
                    ? (host.confirmPhone ?? null)
                    : null
                }
              >
                {renderStage()}
              </PhoneConfirmSlot.Provider>
            </StickyAccordionTitles.Provider>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
