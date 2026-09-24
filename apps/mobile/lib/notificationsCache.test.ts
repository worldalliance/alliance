import { NotificationDto } from "@alliance/shared/client";
import { QueryClient } from "@tanstack/react-query";
import { markCachedNotificationsReadByContent } from "./notificationsCache";

const SENT = "2026-09-23T12:00:00.000Z";

const notification = (
  overrides: Pick<NotificationDto, "id"> & Partial<NotificationDto>,
): NotificationDto => ({
  category: "forum_reply",
  message: "A reply",
  priority: "low",
  webAppLocation: "/",
  mobileAppLocation: null,
  readAt: null,
  createdAt: SENT,
  updatedAt: SENT,
  sendTime: SENT,
  associatedUsers: [],
  sourceType: "unread_content",
  contentType: "forum_reply",
  ...overrides,
});

it("marks the cached notifications for the read content, and only those", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData<NotificationDto[]>(
    ["notifications"],
    [
      notification({ id: 1, contentId: 10 }),
      notification({ id: 2, contentId: 11 }),
      notification({ id: 3, contentId: 10, contentType: "action_update" }),
    ],
  );

  markCachedNotificationsReadByContent({
    queryClient,
    contentType: "forum_reply",
    contentIds: [10],
  });

  const cached = queryClient.getQueryData<NotificationDto[]>(["notifications"]);
  expect(cached?.map((n) => n.readAt !== null)).toEqual([true, false, false]);
});

it("leaves an unloaded list unloaded", () => {
  const queryClient = new QueryClient();
  markCachedNotificationsReadByContent({
    queryClient,
    contentType: "forum_reply",
    contentIds: [10],
  });
  expect(queryClient.getQueryData(["notifications"])).toBeUndefined();
});
