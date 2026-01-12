// announcement

export const defaultAnnouncementEmailSubject =
  "new Alliance task#{s} need#{s|} completion within #{days}";

export const defaultAnnouncementEmailContents = `Hi #{firstname},

#{n} new Alliance task#{s} #{is|are} ready for you to complete:

1. ACTION1
2. ACTION2
3. ...

Please complete the task#{s} at this link: #{link}`;

export const defaultAnnouncementTextMessage = `#{n} new Alliance task#{s} need#{s|} completion within #{days} (#{link}):
      1. ACTION1
      2. ACTION2
      3. ...`;

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

export const defaultMissedDeadlineEmailSubject =
  "Failed to complete Alliance task by deadline";

export const defaultMissedDeadlineEmailContents = `Hi #{firstname},

The deadline for the current task has passed and you have not completed it. If you have completed it, please contact us — we may have made a mistake.

The Alliance relies on the dependability of all members. If you are no longer interested in being a member of the Alliance, please suspend your contract.

If you do not complete the next action, we will suspend your contract on your behalf.`;

export const defaultMissedDeadlineTextMessage = `You failed to complete the current Alliance task. The deadline has now passed. If you have completed it, please contact us — we may have made a mistake. 
  
  If you are no longer interested in being a member of the Alliance, please suspend your contract. If you do not complete the next task, we will suspend your contract on your behalf.`;
