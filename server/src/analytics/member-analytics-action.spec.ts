import { countsTowardMemberAnalytics } from "./member-analytics-action";

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
