import { parseTaskBadgePush } from "@alliance/common/taskBadge";
import type { NotificationBehavior } from "expo-notifications";

const QUIET_NOTIFICATION_BEHAVIOR: NotificationBehavior = {
  shouldPlaySound: false,
  shouldSetBadge: false,
  shouldShowBanner: false,
  shouldShowList: false,
};

const SHOWN_NOTIFICATION_BEHAVIOR: NotificationBehavior = {
  shouldPlaySound: true,
  shouldSetBadge: true,
  shouldShowBanner: true,
  shouldShowList: true,
};

/**
 * How the running app presents a push. A badge push shows nothing and calls
 * `onTaskBadgePush`, which refetches rather than applying the pushed count:
 * the push may predate the app's own latest one. Android never passes the
 * data-only badge push here, so this refetch happens only on iOS. Any other
 * push calls `onShownPush`.
 */
export function notificationBehavior(params: {
  data: unknown;
  onTaskBadgePush: () => void;
  onShownPush: () => void;
}): NotificationBehavior {
  if (!parseTaskBadgePush(params.data).ok) {
    params.onShownPush();
    return SHOWN_NOTIFICATION_BEHAVIOR;
  }
  params.onTaskBadgePush();
  return QUIET_NOTIFICATION_BEHAVIOR;
}
