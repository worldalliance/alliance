/**
 * Single source of truth for the action-activity taxonomy: the canonical
 * `ActionActivityType` enum.
 */
export enum ActionActivityType {
  USER_COMPLETED = "user_completed",
  USER_WONT_COMPLETE = "user_wont_complete",
  /**
   * The user acknowledged the action's card and chose to hide it from their
   * home page (the dismiss button is offered on optional, away, and
   * past-deadline cards). Think "notification marked as read": it only
   * affects the user's own view — hides the card from their task list and
   * mutes their reminders for this action. Not a terminal activity: a later
   * completion or withdrawal supersedes it.
   */
  USER_DISMISSED = "user_dismissed",
  USER_SUBMITTED_FOLLOW_UP_FORM = "user_submitted_follow_up_form",
}

/** Which `ActionActivityType`s appear in feeds. */
const ACTION_ACTIVITY_FEED_VISIBLE = {
  user_completed: true,
  user_submitted_follow_up_form: true,
  user_wont_complete: false,
  user_dismissed: false,
} as const satisfies Record<ActionActivityType, boolean>;

export type FeedActionActivity = {
  [K in ActionActivityType]: (typeof ACTION_ACTIVITY_FEED_VISIBLE)[K] extends true
    ? K | `${K}`
    : never;
}[ActionActivityType];

export function actionActivityIsVisibleInFeed(
  type: ActionActivityType | keyof typeof ACTION_ACTIVITY_FEED_VISIBLE,
): type is FeedActionActivity {
  return ACTION_ACTIVITY_FEED_VISIBLE[type];
}

export const ACTION_ACTIVITY_FEED_VISIBLE_TYPES = Object.keys(
  ACTION_ACTIVITY_FEED_VISIBLE,
).filter(
  (key) => ACTION_ACTIVITY_FEED_VISIBLE[key as ActionActivityType],
) as FeedActionActivity[];

export const actionActivityTransitiveVerb = {
  user_completed: "completed",
  user_submitted_follow_up_form: "followed up on",
  user_wont_complete: "won't complete",
  user_dismissed: "dismissed",
} as const satisfies Record<ActionActivityType, string>;

export const actionActivityCommentable = {
  user_completed: true,
  user_submitted_follow_up_form: true,
  user_wont_complete: false,
  user_dismissed: false,
} as const satisfies Record<ActionActivityType, boolean>;

/**
 * Display labels for withdrawal options — shown in the withdrawal UI and in
 * the opt-out event log. Key order determines the display order of the options
 * in the withdrawal UI.
 */
export const WITHDRAWAL_OPTION_LABELS = {
  out_of_time: "Took more than 15 minutes",
  moral: "Moral objection",
  other: "Other reason",
} as const;

export type WithdrawalOption = keyof typeof WITHDRAWAL_OPTION_LABELS;

export const WITHDRAWAL_OPTIONS = Object.keys(
  WITHDRAWAL_OPTION_LABELS,
) as WithdrawalOption[];

/** Options that require the user to type a reason before withdrawing. */
const WITHDRAWAL_OPTION_REQUIRES_REASON = {
  out_of_time: false,
  moral: true,
  other: true,
} as const satisfies Record<WithdrawalOption, boolean>;

export function canSubmitWithdrawal(
  option: WithdrawalOption | null,
  reason: string,
): boolean {
  if (option === null) return false;
  return !WITHDRAWAL_OPTION_REQUIRES_REASON[option] || reason.trim().length > 0;
}

/** Decodes the wire encoding of a withdrawal option. */
export function withdrawalOptionFromFlags(flags: {
  outOfTime: boolean;
  isMoral: boolean;
}): WithdrawalOption {
  if (flags.outOfTime) return "out_of_time";
  if (flags.isMoral) return "moral";
  return "other";
}

const WITHDRAWAL_OPTION_FLAGS = {
  out_of_time: { outOfTime: true, isMoral: false },
  moral: { outOfTime: false, isMoral: true },
  other: { outOfTime: false, isMoral: false },
} as const satisfies Record<
  WithdrawalOption,
  { outOfTime: boolean; isMoral: boolean }
>;

/**
 * Encodes a withdrawal option as its wire flags — the inverse of
 * `withdrawalOptionFromFlags`.
 */
export function withdrawalFlagsFromOption(option: WithdrawalOption): {
  outOfTime: boolean;
  isMoral: boolean;
} {
  return WITHDRAWAL_OPTION_FLAGS[option];
}

/**
 * Server-side counterpart of `canSubmitWithdrawal`, keyed on the wire flags
 * instead of the UI option.
 */
export function withdrawalHasRequiredReason(withdrawal: {
  outOfTime: boolean;
  isMoral: boolean;
  reason: string;
}): boolean {
  return canSubmitWithdrawal(
    withdrawalOptionFromFlags(withdrawal),
    withdrawal.reason,
  );
}
