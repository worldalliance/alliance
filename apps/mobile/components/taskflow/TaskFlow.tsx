import { type FormSchema } from "@alliance/common/forms/form-schema";
import {
  type ActionDto,
  type FormResponseDto,
  type SubmitFormDto,
} from "@alliance/shared/client";
import { FlowButtonKind, flowMotion } from "@alliance/shared/forms/flowStyle";
import { useFlowPosition } from "@alliance/shared/forms/useFlowPosition";
import {
  FlowStage,
  TASK_FLOW_MODE_RULES,
  type TaskFlowMode,
  useTaskFlow,
} from "@alliance/shared/forms/useTaskFlow";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import {
  useReopenLeftTask,
  useTaskFlowReturn,
} from "@alliance/shared/lib/TaskFlowReturnContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  usePathname,
} from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Modal, useWindowDimensions, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import { formBlockedView } from "../forms/FormElements";
import { useMobileFormState } from "../forms/useMobileFormState";
import WithdrawalModal from "../forms/WithdrawalModal";
import ProgressBar from "../system/ProgressBar";
import { CardWithdrawContext } from "./CardWithdrawContext";
import FlowButton from "./FlowButton";
import { animateTo, timingFor } from "./flowMotion";
import TaskFlowComplete from "./TaskFlowComplete";
import TaskFlowHeader, { TaskFlowWithdrawButton } from "./TaskFlowHeader";
import TaskFlowIntro from "./TaskFlowIntro";
import TaskFlowScreen, { TaskFlowPage, TaskFlowTitle } from "./TaskFlowScreen";

const PROGRESS_TIMING = timingFor(flowMotion.progress);

type TaskFlowProps = {
  action: ActionDto;
  mode: TaskFlowMode;
  /** The submission a read-only flow shows. */
  completedFormResponse?: FormResponseDto;
  schema: FormSchema;
  formId: number;
  taskFormId: number;
  formSnapshotId: number;
  submitTaskForm: (data: SubmitFormDto) => Promise<boolean>;
  submitError: string | null;
  reloadSourceHistories: number;
  onCompleteAction: () => void;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
};

/**
 * `onCompleteAction` runs only once the member leaves the completion screen
 * of a live flow, since completing the action unmounts this panel.
 */
export default function TaskFlow({
  action,
  mode,
  completedFormResponse,
  schema,
  formId,
  taskFormId,
  formSnapshotId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  submitTaskForm,
  submitError: error,
  reloadSourceHistories,
}: TaskFlowProps) {
  const { user, isAuthenticated, isLoading: userLoading } = useAuth();
  const { records, readOnly, withdraws } = TASK_FLOW_MODE_RULES[mode];
  const withdraw = withdraws ? onAbandonAction : undefined;
  const form = useMobileFormState({
    form: schema,
    id: formId,
    formSnapshotId,
    actionId: action.id,
    persistKey: records ? String(taskFormId) : null,
    reloadSourceHistories,
    userId: user?.id,
    user,
    userLoading,
    loadCurrentUserLocation: !!user && isAuthenticated,
    syncDraftToServer: records && isAuthenticated,
    renderFormAsCompleted: readOnly,
    completedFormResponse,
    onFormStarted,
    onAbandonAction: withdraw,
    onSubmit: records ? submitTaskForm : null,
  });
  const insets = useSafeAreaInsets();
  const position = useFlowPosition({
    taskFormId,
    formSnapshotId,
    storage: AsyncStorage,
  });
  const flow = useTaskFlow({
    actionId: action.id,
    mode,
    form,
    position,
    onExit: () => void close(),
  });
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const { id: pageActionId } = useLocalSearchParams<{ id?: string }>();
  const onTaskPage = pageActionId === String(action.id);
  const { leaveTask } = useTaskFlowReturn();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const placeWithdraw = useContext(CardWithdrawContext);
  const openWithdraw = useCallback(() => setWithdrawOpen(true), []);
  // Only while the flow is closed, so one withdraw control shows at a time.
  const cardCanWithdraw =
    withdraw !== undefined && flow.stage === FlowStage.Closed;
  useEffect(() => {
    if (!placeWithdraw) return;
    placeWithdraw(cardCanWithdraw ? openWithdraw : null);
    return () => placeWithdraw(null);
  }, [placeWithdraw, cardCanWithdraw, openWithdraw]);

  useReopenLeftTask({
    actionId: action.id,
    onTaskPage: isFocused && onTaskPage,
    ready: position.loaded && form.visibilitySettled,
    begin: flow.begin,
  });

  const { height } = useWindowDimensions();
  const offset = useSharedValue(1);
  const opacity = useSharedValue(1);
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value * height }],
  }));
  const completeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const shown = flow.stage !== FlowStage.Closed;
  const entered = useRef(false);
  useEffect(() => {
    if (shown) return;
    setWithdrawOpen(false);
    entered.current = false;
    offset.value = 1;
    opacity.value = 1;
  }, [shown, offset, opacity]);
  // Starts on the panel's first layout: the modal shows its content a few
  // frames after opening, which would hide the curve's fastest frames.
  const enter = () => {
    if (entered.current) return;
    entered.current = true;
    void animateTo({ value: offset, to: 0, motion: flowMotion.expand });
  };

  const closing = useRef(false);
  // A submit that lands mid-close would complete the task behind a closed flow.
  const close = async (then?: () => void) => {
    if (closing.current || form.submitting) return;
    closing.current = true;
    if (flow.stage === FlowStage.Complete) {
      await animateTo({ value: opacity, to: 0, motion: flowMotion.recolor });
    }
    await animateTo({ value: offset, to: 1, motion: flowMotion.collapse });
    closing.current = false;
    flow.close();
    then?.();
  };
  const finish = (then?: () => void) =>
    close(() => {
      if (records) onCompleteAction();
      then?.();
    });

  // A submit in flight lands on the completion screen, so leaving waits for it.
  const { stage, close: closeFlow } = flow;
  useEffect(() => {
    if (isFocused || stage === FlowStage.Closed) return;
    if (form.submitting || closing.current) return;
    closeFlow();
    if (stage !== FlowStage.Complete) {
      if (onTaskPage) leaveTask(action.id);
    } else if (records) onCompleteAction();
  }, [
    isFocused,
    stage,
    form.submitting,
    closeFlow,
    records,
    onCompleteAction,
    onTaskPage,
    action.id,
    leaveTask,
  ]);

  const blocked = formBlockedView(form);
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
      case FlowStage.Background:
        return (
          <TaskFlowIntro
            action={action}
            form={form}
            background={flow.background}
            onNext={() => void flow.start()}
            nextLabel={flow.startLabel}
            nextIsLast={flow.startIsLast}
            error={error}
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
            nextLabel={flow.nextLabel}
            nextIsLast={flow.nextIsLast}
            error={error}
            onBack={flow.back}
            onNext={() => void flow.next()}
          />
        );
      case FlowStage.Complete:
        return (
          <Animated.View className="flex-1" style={completeStyle}>
            <TaskFlowComplete
              schema={form.schema}
              answers={flow.submittedAnswers ?? {}}
              user={user}
              onClose={() =>
                void finish(
                  pathname === "/" ? undefined : () => router.navigate("/"),
                )
              }
              onInvite={() => router.push("/invites")}
            />
          </Animated.View>
        );
      default:
        throw new Error(`unknown flow stage: ${flow.stage satisfies never}`);
    }
  };

  const withdrawalModal = (visible: boolean) =>
    withdraw ? (
      <WithdrawalModal
        visible={visible}
        onClose={() => setWithdrawOpen(false)}
        disabled={form.submitting}
        onWithdraw={(withdrawal) => {
          form.handleAbandon(withdrawal);
          position.clear();
          setWithdrawOpen(false);
          flow.close();
        }}
      />
    ) : null;

  return (
    <View>
      <View className="flex-row items-center gap-x-3">
        <FlowButton
          kind={readOnly ? FlowButtonKind.Secondary : FlowButtonKind.Primary}
          onPress={flow.begin}
          loading={!position.loaded}
          title={flow.beginLabel}
          iconRight={ArrowRight}
          className="flex-1"
        />
        {withdraw && !placeWithdraw ? (
          <TaskFlowWithdrawButton onPress={openWithdraw} />
        ) : null}
      </View>
      {withdrawalModal(withdrawOpen && !shown)}
      <Modal
        visible={shown}
        transparent
        animationType="none"
        onRequestClose={() =>
          void (flow.stage === FlowStage.Complete ? finish() : close())
        }
      >
        <Animated.View
          className="flex-1 bg-white"
          style={panelStyle}
          onLayout={enter}
        >
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            {flow.open ? (
              <>
                <View className="px-4" style={{ paddingTop: insets.top + 8 }}>
                  <ProgressBar
                    percentage={flow.progress}
                    fillTiming={PROGRESS_TIMING}
                  />
                </View>
                <TaskFlowHeader
                  onClose={() => void close()}
                  disabled={form.submitting}
                  progressSaved={
                    blocked === null && !form.saveFailed && flow.progressSaved
                  }
                  onWithdraw={
                    withdraw && blocked === null ? openWithdraw : null
                  }
                />
              </>
            ) : null}
            <View className="flex-1">{renderStage()}</View>
          </KeyboardAvoidingView>
        </Animated.View>
        {withdrawalModal(withdrawOpen && shown)}
      </Modal>
    </View>
  );
}
