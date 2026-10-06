import { ReminderCohortType } from "src/actions/entities/reminder-group.entity";
import { StreakRecognitionCopy } from "./entities/action-event-notif.entity";
import {
  assertStreakRecognitionAllowed,
  isStreakMilestone,
  streakRecognitionTemplates,
} from "./streak-recognition";

const group = {
  pushMessage:
    "You have #{timeremaining} left to complete #{n} Alliance task#{s}",
  textMessage:
    "You have #{timeremaining} left to complete #{n} Alliance task#{s} (#{link})",
  emailSubject: "#{timeremaining} left to complete #{n} Alliance task#{s}",
  emailMessage: "Hi #{firstname},\n\nBody #{link}",
};

describe("isStreakMilestone", () => {
  it.each([2, 3, 5, 10, 15, 100])("recognizes %i", (count) => {
    expect(isStreakMilestone(count)).toBe(true);
  });

  it.each([0, 1, 4, 6, 7, 11])("passes over %i", (count) => {
    expect(isStreakMilestone(count)).toBe(false);
  });
});

describe("streakRecognitionTemplates", () => {
  it("prefixes push and SMS, replaces the subject, and keeps the email body", () => {
    expect(
      streakRecognitionTemplates({
        copy: StreakRecognitionCopy.RecognitionV1,
        group,
        streakCount: 5,
      }),
    ).toEqual({
      pushMessage: `You have completed 5 weeks of tasks in a row! ${group.pushMessage}`,
      textMessage: `You have completed 5 weeks of tasks in a row! ${group.textMessage}`,
      emailSubject: "You have completed 5 weeks of tasks in a row!",
      emailMessage: group.emailMessage,
    });
  });

  it("sends the control arm the group's own copy", () => {
    expect(
      streakRecognitionTemplates({
        copy: StreakRecognitionCopy.Control,
        group,
        streakCount: 5,
      }),
    ).toEqual(group);
  });
});

describe("assertStreakRecognitionAllowed", () => {
  const reminder = {
    ...group,
    cohortType: ReminderCohortType.AllUncompleted,
    streakRecognition: true,
  };

  it("allows the flag on an ordinary personally-notifying reminder", () => {
    expect(() => assertStreakRecognitionAllowed(reminder)).not.toThrow();
  });

  it("rejects the flag on a group-leads cohort", () => {
    expect(() =>
      assertStreakRecognitionAllowed({
        ...reminder,
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
      }),
    ).toThrow("streakRecognition is not supported for group-leads cohorts");
  });

  it("rejects the flag on a missed-suite reminder", () => {
    expect(() =>
      assertStreakRecognitionAllowed({
        ...reminder,
        emailMessage: "Hi #{firstname}, #{missedactioncontext}",
      }),
    ).toThrow("streakRecognition is not supported for missed-suite reminders");
  });

  it("allows either kind of group without the flag", () => {
    expect(() =>
      assertStreakRecognitionAllowed({
        ...reminder,
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
        emailMessage: "#{secondmisswarning}",
        streakRecognition: false,
      }),
    ).not.toThrow();
  });
});
