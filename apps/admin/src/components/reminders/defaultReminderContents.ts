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

export const defaultMissedDeadlineEmailSubject = "You missed an Alliance task";

export const defaultMissedDeadlineEmailContents = `Hi #{firstname},

The deadline for the current task has passed and you have not completed it. If you did complete it, please contact us — we may have made a mistake.

The Alliance counts on every member. We plan precise actions based on the number of people we expect to participate.

To learn more about our model, you can watch <a href="https://www.youtube.com/watch?v=VS6aFXXxtmY&t=125s">this video</a>.

Please know that if you miss several actions in a row, we will suspend your contract and no longer assign you tasks.

Best,
The Alliance Team`;

export const defaultMissedDeadlineTextMessage = `The deadline for the current task has passed and you have not completed it. If you did complete it, please contact us — we may have made a mistake. 

We plan precise actions based on the number of people we expect to participate. If you miss several actions in a row, we will suspend your contract and no longer assign you tasks.`;

// group leads reminder

export const defaultGroupLeadsEmailSubject = `#{nmembers} of your Alliance group members have not yet completed their upcoming task`;

export const defaultGroupLeadsEmailContents = `Hi #{firstname},

#{nmembers} of your Alliance group members have not yet completed their upcoming task. You are responsible for ensuring that they do so over the next #{days}. Please consider sending them a reminder.

See the full list of members here: #{grouplink}
`;

export const defaultGroupLeadsTextMessage = `#{nmembers} of your Alliance group members have #{timeremaining} left to complete their upcoming task. See here: #{grouplink}`;
