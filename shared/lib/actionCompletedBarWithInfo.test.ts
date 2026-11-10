import { ActionActivityType } from "@alliance/common/actionActivity";
import { expect, test } from "bun:test";
import type { ActionActivityDto } from "../client";
import {
  getCompletedPercentage,
  selectCompletedFriends,
} from "./actionCompletedBarWithInfo";
import { makeAction, makeProfile } from "./testFixtures";

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
  combinedSplitId: null,
  comments: [],
  editableContent: { body: "", attachments: [] },
});

const loaded = (count: number) => ({ count, isError: false });

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

test("an onboarding action labels the count it is given, with a full bar", () => {
  const action = makeAction({
    onboarding: true,
    usersCompleted: 3,
    usersJoined: 0,
  });

  expect(getCompletedPercentage(action, loaded(1200))).toEqual({
    labelString: "1200 members",
    percentage: 100,
    hasDenominator: false,
  });
});

test("an onboarding action draws a full bar while its count loads", () => {
  const action = makeAction({ onboarding: true, usersJoined: 10 });

  expect(
    getCompletedPercentage(action, { count: undefined, isError: false }),
  ).toEqual({
    labelString: "... members",
    percentage: 100,
    hasDenominator: false,
  });
});

test("an onboarding action draws an empty bar when its count fails", () => {
  const action = makeAction({ onboarding: true, usersJoined: 10 });

  expect(
    getCompletedPercentage(action, { count: undefined, isError: true }),
  ).toEqual({
    labelString: "Member count unavailable",
    percentage: 0,
    hasDenominator: false,
  });
});

test("an onboarding action keeps its count when a refetch fails", () => {
  const action = makeAction({ onboarding: true });

  expect(
    getCompletedPercentage(action, { count: 1200, isError: true }).labelString,
  ).toBe("1200 members");
});

test("an action with nobody to count draws no bar", () => {
  const onboarding = makeAction({ onboarding: true });
  const regular = makeAction({ usersJoined: 0 });

  expect(getCompletedPercentage(onboarding, loaded(0)).percentage).toBeNull();
  expect(getCompletedPercentage(regular, loaded(0)).percentage).toBeNull();
});

test("a regular action keeps its completed-of-joined bar", () => {
  const action = makeAction({ usersCompleted: 3, usersJoined: 10 });

  expect(getCompletedPercentage(action, loaded(3))).toEqual({
    labelString: "3 / 10 members completed",
    percentage: 30,
    hasDenominator: true,
  });
});

test("an optional action counts completions with no denominator", () => {
  const action = makeAction({
    optional: true,
    usersCompleted: 3,
    usersJoined: 10,
  });

  expect(getCompletedPercentage(action, loaded(3))).toEqual({
    labelString: "3 members completed",
    percentage: 100,
    hasDenominator: false,
  });
});
