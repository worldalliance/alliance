import { ActionActivityType } from "@alliance/common/actionActivity";
import { expect, test } from "bun:test";
import type { ActionActivityDto } from "../client";
import { selectCompletedFriends } from "./actionCompletedBarWithInfo";
import { makeProfile } from "./testFixtures";

const activity = (
  id: number,
  type: ActionActivityDto["type"],
): ActionActivityDto => ({
  id,
  type,
  actionId: 1,
  createdAt: "2026-06-15T12:00:00Z",
  likesCount: 0,
  user: makeProfile(id),
  actionName: "Call your representative",
  comments: [],
  editableContent: { body: "", attachments: [] },
});

test("selectCompletedFriends keeps only the friends who completed", () => {
  expect(
    selectCompletedFriends([
      activity(1, ActionActivityType.USER_COMPLETED),
      activity(2, ActionActivityType.USER_WONT_COMPLETE),
      activity(3, ActionActivityType.USER_DISMISSED),
      activity(4, ActionActivityType.USER_COMPLETED),
    ]).map((friend) => friend.id),
  ).toEqual([1, 4]);
});

test("selectCompletedFriends treats unloaded activity as none", () => {
  expect(selectCompletedFriends(null)).toEqual([]);
});
