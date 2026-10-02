import { ActionDto } from "@alliance/shared/client/types.gen";
import {
  ActionPageTaskPanelState,
  cardStylesForState,
  getActionPageTaskPanelState,
  shouldLoadCompletedTaskFormByState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import { useCompletedTaskForm } from "@alliance/shared/lib/actionTaskPanelCompleted";
import {
  clipboardCopy,
  taskHeaders,
  type TitledCopy,
} from "@alliance/shared/lib/copy";
import {
  buildActionShareUrl,
  buildShareText,
  getCompletedShareableTextTemplate,
} from "@alliance/shared/lib/shareText";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import { milliseconds } from "date-fns";
import { Link } from "expo-router";
import { ArrowRight, Link2 } from "lucide-react-native";
import { ReactNode, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { copyOrAlert } from "../lib/clipboard";
import { getBaseUrl } from "../lib/config";
import { colors } from "../lib/style/colors";
import ActionTaskPanel from "./ActionTaskPanel";
import CheckIcon from "./system/CheckIcon";
import StackedCard from "./system/StackedCard";
import Text, { FontWeight } from "./system/Text";

export interface ActionPageTaskPanelProps {
  action: ActionDto;
  onCompleteAction: () => void;
  onOptOutAction: () => void;
  onDeadlinePassed: () => void;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
}

const renderTitledHeader = (copy: TitledCopy, titleClassName?: string) => (
  <View className="gap-y-1">
    <Text className={titleClassName} weight={FontWeight.Medium}>
      {copy.title}
    </Text>
    <Text className="text-zinc-500">{copy.description}</Text>
  </View>
);

// Guest-completion states (GuestRef, GuestCompleted) are web-only; mobile
// pins hasRefCode/hasGuestResponse to false below so they're never reached.
const taskPanelTopByState: Record<ActionPageTaskPanelState, ReactNode> = {
  [ActionPageTaskPanelState.GuestRef]: null,
  [ActionPageTaskPanelState.GuestCompleted]: null,
  [ActionPageTaskPanelState.PublicOnlyAuthenticated]: (
    <Text>{taskHeaders.actionPage.externalOnly}</Text>
  ),
  [ActionPageTaskPanelState.PublicOnly]: null,
  [ActionPageTaskPanelState.NotAuthenticated]: (
    <View className="flex-row flex-wrap items-center">
      <Link href="/onboarding">
        <Text className="text-green">Log in</Text>
      </Link>
      <Text> to complete this task.</Text>
    </View>
  ),
  [ActionPageTaskPanelState.NotAssigned]: (
    <Text>{taskHeaders.actionPage.notAssigned}</Text>
  ),
  [ActionPageTaskPanelState.StaffPreview]: (
    <View className="gap-y-1">
      <Text weight={FontWeight.Medium}>{taskHeaders.staffPreview.title}</Text>
      <Text className="text-zinc-500">
        {taskHeaders.staffPreview.description}
      </Text>
    </View>
  ),
  [ActionPageTaskPanelState.Completed]: null,
  [ActionPageTaskPanelState.Declined]: (
    <Text>{taskHeaders.actionPage.withdrew}</Text>
  ),
  [ActionPageTaskPanelState.MemberActionClosed]: (
    <Text>{taskHeaders.actionPage.memberActionClosed}</Text>
  ),
  [ActionPageTaskPanelState.DeadlineMissed]: (
    <Text>{taskHeaders.actionPage.deadlinePassed.title}</Text>
  ),
  [ActionPageTaskPanelState.MissingDataOrNotActive]: null,
  [ActionPageTaskPanelState.ShowTaskWithMissedDeadline]: renderTitledHeader(
    taskHeaders.actionPage.deadlinePassed,
  ),
  [ActionPageTaskPanelState.OnboardingSignContractFirst]: (
    <View className="flex-row items-center justify-between gap-x-2">
      <Text className="flex-1">
        {taskHeaders.actionPage.onboardingSignContractFirst}
      </Text>
      <Link href="/actions" className="flex-row items-center gap-x-2">
        <Text className="text-green">Go back</Text>
        <ArrowRight size={16} color={colors.green} />
      </Link>
    </View>
  ),
  [ActionPageTaskPanelState.Optional]: renderTitledHeader(
    taskHeaders.actionPage.optional,
    "text-sky-500",
  ),
  [ActionPageTaskPanelState.OptionalForViewer]: renderTitledHeader(
    taskHeaders.actionPage.optionalForViewer,
    "text-sky-500",
  ),
  [ActionPageTaskPanelState.OptionalForContractGap]: renderTitledHeader(
    taskHeaders.actionPage.optionalForContractGap,
    "text-sky-500",
  ),
  [ActionPageTaskPanelState.ShowTask]: null,
};

const ActionPageTaskPanel = ({
  action,
  onCompleteAction,
  onOptOutAction,
  onDeadlinePassed,
  scrollPageTo,
  scrollToEnd,
}: ActionPageTaskPanelProps) => {
  const { user, isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const state = getActionPageTaskPanelState({
    action,
    contractSigned: user?.hasActiveContract ?? false,
    isAuthenticated,
    hasRefCode: false,
    hasGuestResponse: false,
  });
  const formResponse = useCompletedTaskForm(
    action,
    shouldLoadCompletedTaskFormByState[state],
  );
  const { data: taskForm } = useTaskForm(action.taskFormId, {
    enabled: state === ActionPageTaskPanelState.Completed,
  });
  const shareTemplate = getCompletedShareableTextTemplate({
    schemaSnapshot: formResponse?.schemaSnapshot as
      | Record<string, unknown>
      | undefined,
    currentSchema: taskForm?.schema as Record<string, unknown> | undefined,
  });

  const handleShareCopy = async () => {
    const url = await buildActionShareUrl({
      actionId: action.id,
      baseUrl: getBaseUrl(),
      isAuthenticated,
    });
    const text = buildShareText({
      template: shareTemplate,
      formResponse,
      userName: user?.name,
      url,
    });
    if (!(await copyOrAlert(text))) {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), milliseconds({ seconds: 2 }));
  };

  const completedHeader = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-x-3">
        <CheckIcon size={24} />
        <Text>{taskHeaders.actionPage.completed}</Text>
      </View>
      <TouchableOpacity
        onPress={handleShareCopy}
        className="flex-row items-center gap-x-1"
        activeOpacity={0.7}
      >
        <Link2 size={14} color={copied ? colors.green : "#71717a"} />
        <Text
          className={copied ? "text-green text-sm" : "text-zinc-500 text-sm"}
        >
          {copied ? clipboardCopy.copiedToClipboard : clipboardCopy.share}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const taskPanelHeader =
    state === ActionPageTaskPanelState.Completed
      ? completedHeader
      : taskPanelTopByState[state];
  const { header: headerStyle, body: bodyStyle } = cardStylesForState(state);

  const panelHandlers = {
    onCompleteAction,
    onOptOutAction,
    onDeadlinePassed,
  };

  switch (state) {
    case ActionPageTaskPanelState.Declined:
    case ActionPageTaskPanelState.Completed:
    case ActionPageTaskPanelState.PublicOnlyAuthenticated:
    case ActionPageTaskPanelState.NotAuthenticated:
    case ActionPageTaskPanelState.NotAssigned:
    case ActionPageTaskPanelState.MemberActionClosed:
    case ActionPageTaskPanelState.DeadlineMissed:
    case ActionPageTaskPanelState.OnboardingSignContractFirst:
    // Guest-completion states never occur on mobile (hasRefCode/hasGuestResponse
    // pinned false); fall through to the disabled rendering just in case.
    case ActionPageTaskPanelState.GuestRef:
    case ActionPageTaskPanelState.GuestCompleted:
      return (
        <StackedCard
          top={taskPanelHeader}
          topCardStyle={headerStyle}
          bottom={
            <ActionTaskPanel
              action={action}
              scrollPageTo={scrollPageTo}
              scrollToEnd={scrollToEnd}
              disabled
              formResponse={formResponse ?? undefined}
              {...panelHandlers}
            />
          }
          bottomCardStyle={bodyStyle}
        />
      );
    case ActionPageTaskPanelState.StaffPreview:
    case ActionPageTaskPanelState.PublicOnly:
    case ActionPageTaskPanelState.ShowTaskWithMissedDeadline:
    case ActionPageTaskPanelState.Optional:
    case ActionPageTaskPanelState.OptionalForViewer:
    case ActionPageTaskPanelState.OptionalForContractGap:
    case ActionPageTaskPanelState.ShowTask:
      return (
        <StackedCard
          top={taskPanelHeader}
          topCardStyle={headerStyle}
          bottom={
            <ActionTaskPanel
              action={action}
              scrollPageTo={scrollPageTo}
              scrollToEnd={scrollToEnd}
              {...panelHandlers}
            />
          }
          bottomCardStyle={bodyStyle}
        />
      );
    case ActionPageTaskPanelState.MissingDataOrNotActive:
      return null;
    default:
      throw new Error(
        `Unknown action page task panel state: ${state satisfies never}`,
      );
  }
};

export default ActionPageTaskPanel;
