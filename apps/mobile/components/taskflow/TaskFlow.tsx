import { type FormSchema } from "@alliance/common/forms/form-schema";
import { type ActionDto, type SubmitFormDto } from "@alliance/shared/client";
import { FlowButtonKind, flowMotion } from "@alliance/shared/forms/flowStyle";
import { useFlowPosition } from "@alliance/shared/forms/useFlowPosition";
import { FlowStage, useTaskFlow } from "@alliance/shared/forms/useTaskFlow";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow } from "@alliance/shared/lib/copy";
import {
  useReopenLeftTask,
  useTaskFlowReturn,
} from "@alliance/shared/lib/TaskFlowReturnContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import FlowButton from "./FlowButton";
import { animateTo, timingFor } from "./flowMotion";
import TaskFlowComplete from "./TaskFlowComplete";
import TaskFlowIntro from "./TaskFlowIntro";
import TaskFlowScreen, { TaskFlowPage, TaskFlowTitle } from "./TaskFlowScreen";

const PROGRESS_TIMING = timingFor(flowMotion.progress);

type TaskFlowProps = {
  action: ActionDto;
  schema: FormSchema;
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
 * `onCompleteAction` runs only once the member leaves the completion screen,
 * since completing the action unmounts this panel.
 */
export default function TaskFlow({
  action,
  schema,
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
  const form = useMobileFormState({
    form: schema,
    id: taskFormId,
    formSnapshotId,
    actionId: action.id,
    persistKey: String(taskFormId),
    reloadSourceHistories,
    userId: user?.id,
    user,
    userLoading,
    loadCurrentUserLocation: !!user && isAuthenticated,
    syncDraftToServer: isAuthenticated,
    onFormStarted,
    onAbandonAction,
    onSubmit: submitTaskForm,
  });
  const insets = useSafeAreaInsets();
  const position = useFlowPosition({
    taskFormId,
    formSnapshotId,
    storage: AsyncStorage,
  });
  const flow = useTaskFlow({
    actionId: action.id,
    form,
    position,
    onExit: () => void close(),
  });
  const isFocused = useIsFocused();
  const { id: pageActionId } = useLocalSearchParams<{ id?: string }>();
  const onTaskPage = pageActionId === String(action.id);
  const { leaveTask } = useTaskFlowReturn();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

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
      onCompleteAction();
      then?.();
    });

  // A submit in flight lands on the completion screen, so leaving waits for it.
  const { stage, close: closeFlow } = flow;
  useEffect(() => {
    if (isFocused || stage === FlowStage.Closed) return;
    if (form.submitting || closing.current) return;
    closeFlow();
    if (stage === FlowStage.Complete) onCompleteAction();
    else if (onTaskPage) leaveTask(action.id);
  }, [
    isFocused,
    stage,
    form.submitting,
    closeFlow,
    onCompleteAction,
    onTaskPage,
    action.id,
    leaveTask,
  ]);

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
            onWithdraw={onAbandonAction ? () => setWithdrawOpen(true) : null}
            onNext={() => void flow.start()}
            isLast={flow.backgroundIsLast}
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
            isLast={flow.isLast}
            error={error}
            onClose={() => void close()}
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
              onClose={() => void finish()}
              onInvite={() => void finish(() => router.push("/invites"))}
            />
          </Animated.View>
        );
      default:
        throw new Error(`unknown flow stage: ${flow.stage satisfies never}`);
    }
  };

  return (
    <View>
      <FlowButton
        kind={FlowButtonKind.Primary}
        onPress={flow.begin}
        loading={!position.loaded}
        title={taskFlow.begin}
      />
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
            <View className="flex-1">{renderStage()}</View>
            {flow.open ? (
              <View
                className="px-4"
                style={{ paddingBottom: insets.bottom + 8 }}
              >
                <ProgressBar
                  percentage={flow.progress}
                  fillTiming={PROGRESS_TIMING}
                />
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </Animated.View>
        {onAbandonAction ? (
          <WithdrawalModal
            visible={withdrawOpen}
            onClose={() => setWithdrawOpen(false)}
            disabled={form.submitting}
            onWithdraw={(withdrawal) => {
              form.handleAbandon(withdrawal);
              position.clear();
              setWithdrawOpen(false);
              flow.close();
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}
