import { R } from "@alliance/common/result";
import { expect, it } from "bun:test";
import { taskPayloadData } from "./taskPayloadData";

it("parses a remote message's data string", () => {
  expect(
    taskPayloadData({
      notification: null,
      data: { dataString: '{"taskBadgeCount":2}', scopeKey: "@alliance/app" },
    }),
  ).toEqual(R.success({ taskBadgeCount: 2 }));
});

it("reads no data from a message without a data string", () => {
  expect(
    taskPayloadData({ notification: null, data: { taskBadgeCount: "2" } }),
  ).toEqual(R.success(null));
});

it("reads no data from a tapped notification", () => {
  expect(
    taskPayloadData({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        date: 0,
        request: {
          identifier: "push",
          content: {
            title: null,
            subtitle: null,
            body: null,
            data: { taskBadgeCount: 2 },
            categoryIdentifier: null,
            sound: null,
          },
          trigger: null,
        },
      },
    }),
  ).toEqual(R.success(null));
});

it("fails on a data string that isn't JSON", () => {
  expect(
    taskPayloadData({ notification: null, data: { dataString: "{" } }).ok,
  ).toBe(false);
});
