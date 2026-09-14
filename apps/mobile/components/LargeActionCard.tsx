import type { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";

import { taskHeaders } from "@alliance/shared/lib/copy";
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
import { ActionCompletedBarWithInfo } from "./ActionCompletedBarWithInfo";
import ActionTaskPanel from "./ActionTaskPanel";
import Button, { ButtonColor } from "./system/Button";
import Card from "./system/Card";
import Text, { FontFamily, FontWeight } from "./system/Text";
import TaskTimeInfo from "./TaskTimeInfo";

export interface LargeActionCardProps extends LargeActionCardPropsShared {
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  onSubmitSuccess: () => void;
  onCompleteAction?: () => void;
}

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
    <Text className="text-sky-800" weight={FontWeight.Semibold}>
      {header}
    </Text>
  );
  return (
    <View className="-mx-4 -mt-4 mb-3 bg-sky-100 border-b border-sky-300 px-4 py-3">
      {icon ? (
        <View className="flex-row items-center gap-x-2">
          {icon}
          {headerText}
        </View>
      ) : (
        headerText
      )}
      <Text className={cn("text-sky-700 mt-1", children && "mb-3")}>
        {message}
      </Text>
      {children}
    </View>
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
  scrollPageTo,
  scrollToEnd,
  onSubmitSuccess,
  onCompleteAction = onUpdateActionState,
}: LargeActionCardProps) {
  const nextEvent = getNextEvent(action);
  const { activities: friendActivities } = useActivities({
    list: ActivityList.FriendsForAction,
    objectId: action.id,
    comments: false,
    limit: 8,
  });
  return (
    <Card className="p-4!">
      <View>
        {action.viewer?.staffPreview && (
          <Banner
            icon={<Eye size={16} color="#075985" />}
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
        <View className="flex flex-row items-center justify-between mb-4">
          <TaskTimeInfo
            action={action}
            nextEvent={nextEvent}
            className="flex-row items-center gap-x-1"
            filled={true}
          />
          <TouchableOpacity
            onPress={() => {
              router.push(`/actions/${action.id}`);
            }}
            className="mr-2 flex flex-row items-center gap-x-1"
          >
            <ArrowRight size={20} />
          </TouchableOpacity>
        </View>
        <Text
          className="text-xl mb-2"
          family={FontFamily.Serif}
          weight={FontWeight.Bold}
        >
          {action.name}
        </Text>
      </View>
      <Text className="text-base mb-4">{action.shortDescription}</Text>
      <ActionCompletedBarWithInfo
        action={action}
        friendActivities={friendActivities}
      />
      <View className="mt-6 border-t border-zinc-200 pt-6">
        <ActionTaskPanel
          action={action}
          onCompleteAction={onCompleteAction}
          onOptOutAction={onUpdateActionState}
          scrollPageTo={scrollPageTo}
          scrollToEnd={scrollToEnd}
          onSubmitSuccess={onSubmitSuccess}
        />
      </View>
    </Card>
  );
}
