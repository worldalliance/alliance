export type MobileScreenshotTarget = {
  name: string;
  deepLink: string;
  readyTestId: string;
  settleMs?: number;
};

export const mobileScreenshotTargets: MobileScreenshotTarget[] = [
  { name: "home", deepLink: "alliance://", readyTestId: "vr-home-ready" },
  { name: "tasks", deepLink: "alliance://", readyTestId: "vr-home-ready" },
  {
    name: "actions",
    deepLink: "alliance://actions",
    readyTestId: "vr-actions-ready",
  },
  {
    name: "action",
    deepLink: "alliance://actions/74",
    readyTestId: "vr-action-detail-ready",
  },
  { name: "feed", deepLink: "alliance://feed", readyTestId: "vr-feed-ready" },
  {
    name: "forum",
    deepLink: "alliance://forum",
    readyTestId: "vr-forum-ready",
  },
  {
    name: "post",
    deepLink: "alliance://forum/post/5",
    readyTestId: "vr-forum-post-ready",
  },
  {
    name: "messages",
    deepLink: "alliance://messages",
    readyTestId: "vr-messages-ready",
  },
  {
    name: "notifications",
    deepLink: "alliance://notifications",
    readyTestId: "vr-notifications-ready",
  },
  {
    name: "contract",
    deepLink: "alliance://membership",
    readyTestId: "vr-membership-ready",
  },
  {
    name: "settings",
    deepLink: "alliance://settings",
    readyTestId: "vr-settings-ready",
  },
];
