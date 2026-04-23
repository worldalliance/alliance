import {
  ActionDto,
  UserActionRelation,
} from "@alliance/shared/client/types.gen";
import {
  ActionPageTaskPanelState,
  cardStylesForState,
  getActionPageTaskPanelState,
  shouldLoadCompletedTaskFormByState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import {
  useCompletedTaskForm,
  useTaskForm,
} from "@alliance/shared/lib/actionTaskPanelCompleted";
import { clipboardCopy, taskHeaders } from "@alliance/shared/lib/copy";
import { ArrowRight, Link2 } from "lucide-react-native";
import { Link } from "expo-router";
import { ReactNode, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import { getBaseUrl } from "../lib/config";
import CheckIcon from "./system/CheckIcon";
import StackedCard from "./system/StackedCard";
import Text, { FontWeight } from "./system/Text";
import ActionTaskPanel from "./ActionTaskPanel";
import { useAuth } from "../lib/AuthContext";
import * as Clipboard from "expo-clipboard";
import {
  buildActionShareUrl,
  buildShareText,
  getCompletedShareableTextTemplate,
} from "@alliance/shared/lib/shareText";

export interface ActionPageTaskPanelProps {
  action: ActionDto;
  userRelation: UserActionRelation | null;
  onCompleteAction: () => void;
  onOptOutAction: () => void;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
}

// Guest-completion states (GuestRef, GuestCompleted) are web-only; mobile
// pins hasRefCode/hasGuestResponse to false below so they're never reached.
const taskPanelTopByState: Partial<
  Record<ActionPageTaskPanelState, ReactNode>
> = {
  [ActionPageTaskPanelState.PublicOnlyAuthenticated]: (
    <Text>{taskHeaders.actionPage.externalOnly}</Text>
  ),
  [ActionPageTaskPanelState.PublicOnly]: null,
  [ActionPageTaskPanelState.NotAuthenticated]: (
    <View className="flex-row flex-wrap items-center">
      <Link href="/auth/login">
        <Text className="text-green">Log in</Text>
      </Link>
      <Text> to complete this task.</Text>
    </View>
  ),
  [ActionPageTaskPanelState.NotAssigned]: (
    <Text>{taskHeaders.actionPage.notAssigned}</Text>
  ),
  [ActionPageTaskPanelState.Completed]: null,
  [ActionPageTaskPanelState.Declined]: (
    <Text>{taskHeaders.actionPage.withdrew}</Text>
  ),
  [ActionPageTaskPanelState.MemberActionClosed]: (
    <Text>{taskHeaders.actionPage.memberActionClosed}</Text>
  ),
  [ActionPageTaskPanelState.MissingDataOrNotActive]: null,
  [ActionPageTaskPanelState.ShowTaskWithMissedDeadline]: (
    <View className="gap-y-1">
      <Text weight={FontWeight.Medium}>
        {taskHeaders.actionPage.deadlinePassed.title}
      </Text>
      <Text className="text-zinc-500">
        {taskHeaders.actionPage.deadlinePassed.description}
      </Text>
    </View>
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
  [ActionPageTaskPanelState.Optional]: (
    <View className="gap-y-1">
      <Text className="text-sky-500" weight={FontWeight.Medium}>
        {taskHeaders.actionPage.optional.title}
      </Text>
      <Text className="text-zinc-500">
        {taskHeaders.actionPage.optional.description}
      </Text>
    </View>
  ),
  [ActionPageTaskPanelState.ShowTask]: null,
};

const ActionPageTaskPanel = ({
  action,
  userRelation,
  onCompleteAction,
  onOptOutAction,
  scrollPageTo,
  scrollToEnd,
}: ActionPageTaskPanelProps) => {
  const { user, isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const state = getActionPageTaskPanelState({
    action,
    userRelation,
    contractSigned: user?.hasActiveContract ?? false,
    isAuthenticated,
    hasRefCode: false,
    hasGuestResponse: false,
  });
  const formResponse = useCompletedTaskForm(
    action,
    shouldLoadCompletedTaskFormByState[state],
  );
  const taskForm = useTaskForm(
    action,
    state === ActionPageTaskPanelState.Completed,
  );
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
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
  };

  switch (state) {
    case ActionPageTaskPanelState.Declined:
    case ActionPageTaskPanelState.Completed:
    case ActionPageTaskPanelState.PublicOnlyAuthenticated:
    case ActionPageTaskPanelState.NotAuthenticated:
    case ActionPageTaskPanelState.NotAssigned:
    case ActionPageTaskPanelState.MemberActionClosed:
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
    case ActionPageTaskPanelState.PublicOnly:
    case ActionPageTaskPanelState.ShowTaskWithMissedDeadline:
    case ActionPageTaskPanelState.Optional:
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
