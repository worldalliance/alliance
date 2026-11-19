import { expect, it, mock } from "bun:test";
import { notificationBehavior } from "./notificationBehavior";

it("silences a badge push and asks for a refetch", () => {
  const onTaskBadgePush = mock(() => {});
  const onShownPush = mock(() => {});

  expect(
    notificationBehavior({
      data: { taskBadgeCount: 2 },
      onTaskBadgePush,
      onShownPush,
    }),
  ).toEqual({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  });
  expect(onTaskBadgePush).toHaveBeenCalledTimes(1);
  expect(onShownPush).not.toHaveBeenCalled();
});

it("shows any other push and reports it shown, without a refetch", () => {
  const onTaskBadgePush = mock(() => {});
  const onShownPush = mock(() => {});

  expect(
    notificationBehavior({
      data: { cid: 1, screen: "/messages" },
      onTaskBadgePush,
      onShownPush,
    }),
  ).toMatchObject({ shouldShowBanner: true, shouldPlaySound: true });
  expect(onTaskBadgePush).not.toHaveBeenCalled();
  expect(onShownPush).toHaveBeenCalledTimes(1);
});
