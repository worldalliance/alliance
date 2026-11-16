/** What a message says a result can be unknown without, as "`count`" or "an item of `marks`"; "" for a literal `null`. */
export type Culprit = string;

/** `tsc` calls the left of `??` never nullish. */
export const UNREACHABLE_FALLBACK = 2869;
/** `tsc` calls the right of a `??` inside another `??` never nullish. */
export const NEVER_NULLISH = 2881;

export const undecidedMessage = ({
  culprit,
  yesNo,
}: {
  culprit: Culprit;
  yesNo: boolean;
}) => {
  const advice = yesNo
    ? "Add `?? false` or `?? true` to decide it then."
    : "Add `?? …` to choose a value then.";
  if (culprit === "") return `This can be undecided. ${advice}`;
  return `This is undecided when ${culprit} has no value. ${advice}`;
};

export const textMessage = (culprit: Culprit) => {
  const advice = 'Add `?? "…"` to choose what they see instead.';
  if (culprit === "") return `Members would see no text here. ${advice}`;
  return `Members without a value for ${culprit} would see no text here. ${advice}`;
};
