import { userDeviceSendPushNotificationAdmin } from "@alliance/shared/client";
import type { TestPushNotificationDto } from "@alliance/shared/client/types.gen";
import { useMutation } from "@tanstack/react-query";

/** Sends a push notification to one device of one member and gives the push the server recorded. */
export function useSendTestPush() {
  return useMutation({
    mutationFn: async (body: TestPushNotificationDto) => {
      const { data } = await userDeviceSendPushNotificationAdmin({
        body,
        throwOnError: true,
      });
      return data;
    },
    onError: (error) => console.error("Failed to send test push", error),
  });
}
