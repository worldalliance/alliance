// announcement

export const defaultAnnouncementEmailSubject =
  "#{n} new Alliance task#{s} need#{s|} completion within #{days}";

export const defaultAnnouncementEmailContents = `Hi #{firstname},

#{n} new Alliance task#{s} #{is|are} ready for you to complete:#{ |\\n\\n}#{formattedtasklist}

Please complete within #{days} at this link: #{link}`;

export const defaultAnnouncementTextMessage = `New Alliance task#{s}: #{tasknames}. Complete within #{days} (#{link})`;

export const defaultAnnouncementPushMessage = `New task#{s}: #{tasknames}`;

// generic reminder

export const defaultEmailSubject =
  "#{timeremaining} left to complete #{n} Alliance task#{s}";

export const defaultEmailContents = `Hi #{firstname},

#{n} Alliance task#{s} need#{s|} your completion.

You have #{timeremaining} left to complete the task#{s}. Please do so at this link: #{link}`;

export const defaultTextMessage =
  "You have #{timeremaining} left to complete #{n} Alliance task#{s} (#{link})";

export const defaultPushMessage =
  "You have #{timeremaining} left to complete #{n} Alliance task#{s}";

// missed deadline

export const defaultMissedDeadlineEmailSubject = "#{missedactionsubject}";

export const defaultMissedDeadlineEmailContents = `Hi #{firstname},

The deadline for the current task has passed and you have not completed it. If you did complete it, please contact us. We may have made a mistake.

#{firstactionreliability}

#{secondmisswarning}

Best,
The Alliance Team`;

export const defaultMissedDeadlineTextMessage = `The deadline for the current task has passed and you have not completed it. If you did complete it, please contact us. We may have made a mistake.

If you miss all of your assigned non-optional actions for three weeks in a row, your contract will be suspended automatically.`;

// group leads reminder

export const defaultGroupLeadsEmailSubject = `#{nmembers} of your Alliance group members have not yet completed their upcoming task`;

export const defaultGroupLeadsEmailContents = `Hi #{firstname},

#{nmembers} of your Alliance group members have not yet completed their upcoming task. You are responsible for ensuring that they do so over the next #{days}. Please consider sending them a reminder.

See the full list of members here: #{grouplink}
`;

export const defaultGroupLeadsTextMessage = `#{nmembers} of your Alliance group members have #{timeremaining} left to complete their upcoming task. See here: #{grouplink}`;
