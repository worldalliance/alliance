import { useCallback, useState, type ReactNode } from "react";
import { View } from "react-native";

import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { taskFlow, taskHeaders } from "@alliance/shared/lib/copy";
import {
  getNextEvent,
  LargeActionCardPropsShared,
} from "@alliance/shared/lib/largeActionCard";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import { ArrowRight, Eye } from "lucide-react-native";
import { colors } from "../lib/style/colors";
import { ActionCompletedBarWithInfo } from "./ActionCompletedBarWithInfo";
import ActionTaskPanel from "./ActionTaskPanel";
import Button, { ButtonColor } from "./system/Button";
import Card, { CardStyle } from "./system/Card";
import Text, { FontFamily, FontWeight } from "./system/Text";
import { CardWithdrawContext } from "./taskflow/CardWithdrawContext";
import FlowButton from "./taskflow/FlowButton";
import { TaskFlowWithdrawButton } from "./taskflow/TaskFlowHeader";
import TaskTimeInfo from "./TaskTimeInfo";

export interface LargeActionCardProps extends LargeActionCardPropsShared {
  onCompleteAction?: () => void;
  onAlreadySubmitted: () => void;
}

// text-zinc-900, which the banner's heading uses; the icon has to take a value.
const ZINC_900 = "#18181b";

function Banner({
  icon,
  header,
  message,
  children,
}: {
  icon?: ReactNode;
  header: string;
  message: string;
  children?: ReactNode;
}) {
  const headerText = (
    <Text className="text-zinc-900" weight={FontWeight.Semibold}>
      {header}
    </Text>
  );
  return (
    <Card cardStyle={CardStyle.Alert} className="mb-3 rounded-md px-4 py-3">
      {icon ? (
        <View className="flex-row items-center gap-x-2">
          {icon}
          {headerText}
        </View>
      ) : (
        headerText
      )}
      <Text className={cn("text-zinc-900 mt-1", children && "mb-3")}>
        {message}
      </Text>
      {children}
    </Card>
  );
}

function DismissBanner({
  header,
  message,
  onDismiss,
}: {
  header: string;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <Banner header={header} message={message}>
      <Button
        color={ButtonColor.White}
        onPress={onDismiss}
        className="w-full"
        title="Dismiss"
      />
    </Banner>
  );
}

export default function LargeActionCard({
  action,
  dismissProps,
  onUpdateActionState,
  onDeadlinePassed,
  onAlreadySubmitted,
  onCompleteAction = onUpdateActionState,
}: LargeActionCardProps) {
  const nextEvent = getNextEvent(action);
  const [openWithdraw, setOpenWithdraw] = useState<(() => void) | null>(null);
  const placeWithdraw = useCallback(
    (open: (() => void) | null) => setOpenWithdraw(() => open),
    [],
  );
  const { activities: friendActivities } = useActivities({
    list: ActivityList.FriendsForAction,
    objectId: action.id,
    comments: false,
    limit: 8,
  });
  return (
    <Card className="p-4!">
      {action.viewer?.staffPreview && (
        <Banner
          icon={<Eye size={16} color={ZINC_900} />}
          header={taskHeaders.staffPreview.title}
          message={taskHeaders.staffPreview.description}
        />
      )}
      {dismissProps && (
        <DismissBanner
          header={dismissProps.header}
          message={dismissProps.message}
          onDismiss={dismissProps.onDismiss}
        />
      )}
      <View className="flex-row items-center justify-between gap-x-4">
        <TaskTimeInfo
          action={action}
          nextEvent={nextEvent}
          className="flex-1 flex-row flex-wrap gap-x-4"
        />
        <View className="flex-row items-center gap-x-2">
          {openWithdraw ? (
            <TaskFlowWithdrawButton onPress={openWithdraw} />
          ) : null}
          <FlowButton
            kind={FlowButtonKind.Icon}
            onPress={() => router.push(`/actions/${action.id}`)}
            accessibilityLabel={taskFlow.taskDetails}
            hitSlop={8}
          >
            <ArrowRight size={20} color={colors.text.icon} />
          </FlowButton>
        </View>
      </View>
      <Text
        className="text-xl mt-2"
        family={FontFamily.Serif}
        weight={FontWeight.Semibold}
      >
        {action.name}
      </Text>
      <Text className="text-base text-zinc-900 my-4">
        {action.shortDescription}
      </Text>
      <ActionCompletedBarWithInfo
        action={action}
        friendActivities={friendActivities}
      />
      <View className="mt-6">
        <CardWithdrawContext.Provider value={placeWithdraw}>
          <ActionTaskPanel
            key={action.id}
            action={action}
            onCompleteAction={onCompleteAction}
            onOptOutAction={onUpdateActionState}
            onDeadlinePassed={onDeadlinePassed}
            onAlreadySubmitted={onAlreadySubmitted}
          />
        </CardWithdrawContext.Provider>
      </View>
    </Card>
  );
}
