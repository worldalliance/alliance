const MISSED_SUITE_KEYWORDS = [
  "#{missedactioncontext}",
  "#{secondmisswarning}",
];

/** Reminder email copy using a missed-suite keyword, which dispatch sends as a missed-suite notice. */
export const usesMissedSuiteKeyword = (copy: {
  emailSubject: string;
  emailMessage: string;
}): boolean =>
  [copy.emailSubject, copy.emailMessage].some((message) =>
    MISSED_SUITE_KEYWORDS.some((keyword) => message.includes(keyword)),
  );
