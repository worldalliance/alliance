import { NotificationChannel } from "src/notifs/notif-utils";
import {
  CATEGORY_KIND,
  KIND_POLICY,
  UNREAD_CONTENT_KIND,
} from "./notification-kind";

describe("kinds of inbox entries", () => {
  it.each([
    ...Object.entries(CATEGORY_KIND),
    ...Object.entries(UNREAD_CONTENT_KIND),
  ])("offers in-app for %s", (_, kind) => {
    expect(KIND_POLICY[kind].channels).toContain(NotificationChannel.InApp);
  });
});
