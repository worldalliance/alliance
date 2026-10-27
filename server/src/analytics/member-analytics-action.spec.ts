import {
  countsTowardCompletionRate,
  countsTowardMemberAnalytics,
} from "./member-analytics-action";

describe("countsTowardMemberAnalytics", () => {
  it.each([
    { publicOnly: false, onboarding: false, expected: true },
    { publicOnly: true, onboarding: false, expected: false },
    { publicOnly: false, onboarding: true, expected: false },
    { publicOnly: true, onboarding: true, expected: false },
  ])(
    "publicOnly=$publicOnly onboarding=$onboarding → $expected",
    ({ publicOnly, onboarding, expected }) => {
      expect(countsTowardMemberAnalytics({ publicOnly, onboarding })).toBe(
        expected,
      );
    },
  );
});

describe("countsTowardCompletionRate", () => {
  it.each([
    {
      completed: false,
      onOptionalBranch: false,
      withdrewDoesntApply: false,
      expected: true,
    },
    {
      completed: false,
      onOptionalBranch: true,
      withdrewDoesntApply: false,
      expected: false,
    },
    {
      completed: false,
      onOptionalBranch: false,
      withdrewDoesntApply: true,
      expected: false,
    },
    {
      completed: true,
      onOptionalBranch: true,
      withdrewDoesntApply: false,
      expected: true,
    },
  ])(
    "completed=$completed optionalBranch=$onOptionalBranch doesntApply=$withdrewDoesntApply → $expected",
    ({ expected, ...params }) => {
      expect(countsTowardCompletionRate(params)).toBe(expected);
    },
  );
});
