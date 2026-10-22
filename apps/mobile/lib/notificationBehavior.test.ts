import { expect, it, mock } from "bun:test";
import { notificationBehavior } from "./notificationBehavior";

it("silences a badge push and asks for a refetch", () => {
  const onTaskBadgePush = mock(() => {});

  expect(
    notificationBehavior({ data: { taskBadgeCount: 2 }, onTaskBadgePush }),
  ).toEqual({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  });
  expect(onTaskBadgePush).toHaveBeenCalledTimes(1);
});

it("shows any other push without a refetch", () => {
  const onTaskBadgePush = mock(() => {});

  expect(
    notificationBehavior({
      data: { cid: 1, screen: "/messages" },
      onTaskBadgePush,
    }),
  ).toMatchObject({ shouldShowBanner: true, shouldPlaySound: true });
  expect(onTaskBadgePush).not.toHaveBeenCalled();
});
