import {
  BackgroundNotificationTaskResult,
  type NotificationTaskPayload,
  registerTaskAsync,
} from "expo-notifications";
import { defineTask } from "expo-task-manager";
import { AppState, Platform } from "react-native";
import { refetchActions } from "./queryClient";
import { getRefreshToken } from "./SecureStorage";
import { setAppIconBadge } from "./taskBadge";
import { applyTaskBadgePush } from "./taskBadgePush";

const TASK_BADGE_TASK = "task-badge-update";

// Android's data-only badge pushes land here in every app state, and never
// reach the foreground notification handler; iOS applies the push's `badge`
// itself, so the task is registered only on Android.
defineTask<NotificationTaskPayload>(TASK_BADGE_TASK, async ({ data }) => {
  await applyTaskBadgePush({
    payload: data,
    appActive: AppState.currentState === "active",
    signedIn: async () => (await getRefreshToken()) !== null,
    setBadge: setAppIconBadge,
    refetch: refetchActions,
  });
  return BackgroundNotificationTaskResult.NoData;
});

if (Platform.OS === "android") {
  registerTaskAsync(TASK_BADGE_TASK).catch((error: unknown) =>
    console.error("failed to register the task badge task", error),
  );
}
