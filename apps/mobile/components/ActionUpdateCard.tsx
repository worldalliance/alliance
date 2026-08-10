import { readDisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { ActionUpdateDto, NotificationDto } from "@alliance/shared/client";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import { useMemo } from "react";
import { View } from "react-native";
import DisplayOnlyRenderer from "./DisplayOnlyRenderer";
import Text, { FontWeight } from "./system/Text";

export interface ActionUpdateCardProps {
  update: ActionUpdateDto;
}

export default function ActionUpdateCard({ update }: ActionUpdateCardProps) {
  const queryClient = useQueryClient();

  useMarkUnreadContentRead({
    contentType: "action_update",
    contentIds: [update.id],
    onMarked: (contentType, contentIds) => {
      const ids = new Set(contentIds);
      const readAt = new Date().toISOString();
      queryClient.setQueryData(
        ["notifications"],
        (
          oldData:
            | {
                data?: NotificationDto[];
              }
            | undefined,
        ) => {
          if (!oldData?.data) {
            return oldData;
          }

          return {
            ...oldData,
            data: oldData.data.map((notification) => {
              if (
                notification.readAt ||
                notification.contentType !== contentType ||
                typeof notification.contentId !== "number" ||
                !ids.has(notification.contentId)
              ) {
                return notification;
              }

              return { ...notification, readAt };
            }),
          };
        },
      );
    },
  });

  const schema = useMemo(
    () => readDisplayOnlySchema(update.schema),
    [update.schema],
  );

  return (
    <View className="flex flex-col border border-zinc-200 rounded-sm overflow-hidden">
      <View className="p-3 bg-zinc-50 border-b border-zinc-200">
        <View className="flex flex-col">
          <View className="flex flex-row flex-wrap items-center gap-x-2">
            <Text>
              <Text className="text-green" weight={FontWeight.Medium}>
                {"Update: "}
              </Text>
              <Text weight={FontWeight.Medium}>{update.title}</Text>
            </Text>
            <Text className="text-zinc-500">
              {formatDistance(new Date(update.date), new Date(), {
                addSuffix: true,
              })}
            </Text>
          </View>
        </View>
      </View>
      {schema?.blocks.length !== 0 && (
        <View className="p-3 bg-white">
          <DisplayOnlyRenderer schema={schema} />
        </View>
      )}
    </View>
  );
}
