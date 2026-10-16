import { ReminderCohortType } from "src/actions/entities/reminder-group.entity";
import { assertExcludePreviouslyNotifiedAllowed } from "./reminder-group.service";

describe("assertExcludePreviouslyNotifiedAllowed", () => {
  it("rejects excludePreviouslyNotified on a group-leads cohort", () => {
    expect(() =>
      assertExcludePreviouslyNotifiedAllowed({
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
        excludePreviouslyNotified: true,
      }),
    ).toThrow(
      "excludePreviouslyNotified is not supported for group-leads cohorts",
    );
  });

  it("allows a group-leads cohort without the flag", () => {
    expect(() =>
      assertExcludePreviouslyNotifiedAllowed({
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
        excludePreviouslyNotified: false,
      }),
    ).not.toThrow();
  });

  it.each([
    ReminderCohortType.AllUncompleted,
    ReminderCohortType.Tag,
    ReminderCohortType.Custom,
  ])("allows the flag on the personally-notifying %s cohort", (cohortType) => {
    expect(() =>
      assertExcludePreviouslyNotifiedAllowed({
        cohortType,
        excludePreviouslyNotified: true,
      }),
    ).not.toThrow();
  });
});
