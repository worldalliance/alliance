import { ActionActivityType } from "@alliance/common/actionActivity";
import { CachedFilter } from "../utils/cached-filter";
import { resolveUserActionRelation } from "./action-activity-status";
import { UserActionRelation } from "./dto/action.dto";

const USER_ID = 123;
const ACTION_ID = 456;

type Activity = {
  type: ActionActivityType;
  createdAt: Date;
  userId: number;
  actionId: number;
};

function at(type: ActionActivityType, iso: string): Activity {
  return {
    type,
    createdAt: new Date(iso),
    userId: USER_ID,
    actionId: ACTION_ID,
  };
}

function resolve(activities: Activity[]): UserActionRelation {
  return resolveUserActionRelation({
    activities: new CachedFilter(activities),
    userId: USER_ID,
    actionId: ACTION_ID,
  });
}

describe("resolveUserActionRelation", () => {
  it("is None with no activities", () => {
    expect(resolve([])).toBe(UserActionRelation.None);
  });

  it("is Completed for a sole completion", () => {
    expect(resolve([at(ActionActivityType.USER_COMPLETED, "2026-01-01")])).toBe(
      UserActionRelation.Completed,
    );
  });

  it("is Declined for a sole withdrawal", () => {
    expect(
      resolve([at(ActionActivityType.USER_WONT_COMPLETE, "2026-01-01")]),
    ).toBe(UserActionRelation.Declined);
  });

  it("is Dismissed for a bare dismissal (no terminal activity)", () => {
    expect(resolve([at(ActionActivityType.USER_DISMISSED, "2026-01-01")])).toBe(
      UserActionRelation.Dismissed,
    );
  });

  it("ignores follow-up form submissions", () => {
    expect(
      resolve([
        at(ActionActivityType.USER_COMPLETED, "2026-01-01"),
        at(ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM, "2026-01-02"),
      ]),
    ).toBe(UserActionRelation.Completed);
  });

  it("only considers activities for the requested user and action", () => {
    const completed = (userId: number, actionId: number): Activity => ({
      type: ActionActivityType.USER_COMPLETED,
      createdAt: new Date("2026-01-01"),
      userId,
      actionId,
    });
    expect(
      resolveUserActionRelation({
        activities: new CachedFilter([
          completed(USER_ID + 1, ACTION_ID), // another user
          completed(USER_ID, ACTION_ID + 1), // another action
        ]),
        userId: USER_ID,
        actionId: ACTION_ID,
      }),
    ).toBe(UserActionRelation.None);
  });

  describe("a terminal activity is never masked by a dismissal", () => {
    it("stays Completed when dismissed before completing", () => {
      expect(
        resolve([
          at(ActionActivityType.USER_DISMISSED, "2026-01-01"),
          at(ActionActivityType.USER_COMPLETED, "2026-01-02"),
        ]),
      ).toBe(UserActionRelation.Completed);
    });

    it("stays Completed when dismissed after completing", () => {
      expect(
        resolve([
          at(ActionActivityType.USER_COMPLETED, "2026-01-01"),
          at(ActionActivityType.USER_DISMISSED, "2026-01-02"),
        ]),
      ).toBe(UserActionRelation.Completed);
    });
  });

  describe("the most recent terminal activity wins (chronological)", () => {
    it("completing after declining reads as Completed", () => {
      expect(
        resolve([
          at(ActionActivityType.USER_WONT_COMPLETE, "2026-01-01"),
          at(ActionActivityType.USER_COMPLETED, "2026-01-02"),
        ]),
      ).toBe(UserActionRelation.Completed);
    });

    it("declining after completing reads as Declined", () => {
      expect(
        resolve([
          at(ActionActivityType.USER_COMPLETED, "2026-01-01"),
          at(ActionActivityType.USER_WONT_COMPLETE, "2026-01-02"),
        ]),
      ).toBe(UserActionRelation.Declined);
    });
  });
});
