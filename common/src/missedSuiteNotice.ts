export type MissedSuiteNoticeTemplates = {
  pushMessage: string;
  textMessage: string;
  emailSubject: string;
  emailMessage: string;
};

/** Reminder groups that announce a missed suite, recognized by their keywords. */
export function isMissedSuiteReminderGroup(group: {
  emailSubject: string;
  emailMessage: string;
}): boolean {
  return [group.emailSubject, group.emailMessage].some(
    (message) =>
      message.includes("#{missedactioncontext}") ||
      message.includes("#{secondmisswarning}"),
  );
}

/** A first miss in the MissedSuiteFirstNotice experiment's variant arm. */
export const FIRST_MISS_REPORT_TEMPLATES: MissedSuiteNoticeTemplates = {
  pushMessage: "The deadline for #{tasknames} passed without your completion.",
  textMessage:
    "The deadline for #{tasknames} passed without your completion. If you did complete #{it|them}, contact us. #{link}",
  emailSubject: "The deadline for #{tasknames} passed without your completion.",
  emailMessage: [
    "Hi #{firstname},",
    "The deadline for #{tasknames} passed and we have no completion recorded for you. If you did complete #{it|them}, contact us; we may have made a mistake.",
    "Each action is planned around the number of members expected to participate.",
    "#{link}",
  ].join("\n"),
};

export const SECOND_MISS_REPORT_TEMPLATES: MissedSuiteNoticeTemplates = {
  pushMessage:
    "You have missed two consecutive weeks. One more pauses your agreement automatically.",
  textMessage:
    "You have missed two consecutive weeks of tasks. If any non-optional tasks are missed again next week, your agreement will be paused automatically. #{link}",
  emailSubject: "You have missed two consecutive weeks of tasks.",
  emailMessage: [
    "Hi #{firstname},",
    "You have missed two consecutive weeks of tasks. If any non-optional tasks are missed again next week, your agreement will be paused automatically.",
    "Completing this week's tasks resets the count.",
    "If something has changed on your end or isn’t functioning in the platform, contact us.",
    "#{link}",
  ].join("\n"),
};
