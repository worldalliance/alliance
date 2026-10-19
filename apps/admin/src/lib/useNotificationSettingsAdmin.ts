import { notificationSettingsGetAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useNotificationSettingsAdmin(userId: number) {
  return useQuery({
    queryKey: queryKeys.userNotificationSettingsAdmin(userId),
    queryFn: () =>
      notificationSettingsGetAdmin({
        path: { id: userId },
        throwOnError: true,
      }).then((r) => r.data),
  });
}
