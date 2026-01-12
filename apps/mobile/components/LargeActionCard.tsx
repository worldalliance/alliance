import { View } from "react-native";

import {
  getLastAndNextEvent,
  LargeActionCardPropsShared,
} from "@alliance/shared/lib/largeActionCard";
import { ActionCompletedBarWithInfo } from "./ActionCompletedBarWithInfo";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Card from "./system/Card";
import Text from "./system/Text";
import TaskTimeInfo from "./TaskTimeInfo";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import ActionTaskPanel from "./ActionTaskPanel";

export interface LargeActionCardProps extends LargeActionCardPropsShared {
  scrollPageTo: (y: number) => void;
}

export default function LargeActionCard({
  action,
  userRelation,
  friendActivities,
  onUpdateActionState,
  scrollPageTo,
}: LargeActionCardProps) {
  const { nextEvent, lastEvent } = getLastAndNextEvent(action);
  return (
    <Card>
      <View>
        <Text className="font-semibold text-2xl font-serif">{action.name}</Text>
        <View className="flex flex-row items-center justify-between mt-2">
          <TaskTimeInfo
            action={action}
            nextEvent={nextEvent}
            lastEvent={lastEvent}
          />
          <Button
            color={ButtonColor.White}
            size={ButtonSize.Small}
            onPress={() => {
              router.push(`/actions/${action.id}`);
            }}
            className="mr-2 flex flex-row items-center gap-x-1"
          >
            <Text className="text-sm">Details</Text>
            <ChevronRight size={15} color="black" />
          </Button>
        </View>
      </View>
      <Text className="text-base mt-2">{action.shortDescription}</Text>
      <ActionCompletedBarWithInfo
        action={action}
        friendActivities={friendActivities}
      />
      <View className="mt-6 border-t border-zinc-200 pt-6 pb-[300px]">
        <ActionTaskPanel
          action={action}
          userRelation={userRelation}
          onCompleteAction={onUpdateActionState}
          onJoinAction={onUpdateActionState}
          onDeclineAction={onUpdateActionState}
          onOptOutAction={onUpdateActionState}
          scrollPageTo={scrollPageTo}
        />
      </View>
    </Card>
  );
}
