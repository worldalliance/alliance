/** What a message says a result can be unknown without, as "`count`" or "an item of `marks`"; "" for a literal `null`. */
export type Culprit = string;

/** `tsc` calls the left of `??` never nullish. */
export const UNREACHABLE_FALLBACK = 2869;
/** `tsc` calls the right of a `??` inside another `??` never nullish. */
export const NEVER_NULLISH = 2881;
/** `tsc` rejects `null` as an operand of `<`, `>`, `<=` and `>=`. */
export const NULL_OPERAND = 18050;
/** `tsc` rejects an operator's operand types, as for `1 < true`. */
export const OPERATOR_TYPES = 2365;
/** `tsc` calls an operand possibly `null` or `undefined`. */
export const POSSIBLY_MISSING = [2531, 2532, 2533, 18047, 18048, 18049];
/** `tsc` rejects an argument its parameter's type doesn't allow. */
export const ARGUMENT_TYPE = 2345;
/** `tsc` says a value isn't assignable to the type it is given. */
export const NOT_ASSIGNABLE = 2322;
/** `tsc` calls a comparison between types that don't overlap unintentional. */
export const NO_OVERLAP = 2367;
/** `tsc` says a comparison with a list or record literal always gives the same answer. */
export const BY_REFERENCE = 2839;
/** `tsc` calls a text, list or record literal always truthy. */
export const ALWAYS_TRUTHY = 2872;
/** `tsc` calls an empty text literal always falsy. */
export const ALWAYS_FALSY = 2873;

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

/** The partition editor's names for a part's fallbacks, which its error messages point to. */
export const PUT_HERE_LABEL = "Put them here";
export const CONTINUE_LABEL = "Continue to the next part";

export const partFallbackMessage = ({ culprit }: { culprit: Culprit }) => {
  const advice = `Pick what happens to those members: "${PUT_HERE_LABEL}" or "${CONTINUE_LABEL}".`;
  if (culprit === "")
    return `This can be undecided for some members. ${advice}`;
  return `This is undecided for members when ${culprit} has no value. ${advice}`;
};

export const NEEDLESS_FALLBACK =
  "This fallback can't change the result: the value before `??` always has one. Remove the `?? …`.";

export const GUARDED_FALLBACK =
  "This fallback isn't needed: an `isMissing(…)` check already decides the result when the value is missing. Remove the `?? …`.";

export const NEEDS_YES_NO = "This needs a yes/no value.";

export const textMessage = (culprit: Culprit) => {
  const advice = 'Add `?? "…"` to choose what they see instead.';
  if (culprit === "") return `Members would see no text here. ${advice}`;
  return `Members without a value for ${culprit} would see no text here. ${advice}`;
};

export const unstoppedMessage = (read: string) =>
  `This function can't take a missing value here, and gets one when \`${read}\` has none: \`&&\` and \`||\` run both sides, so a check beside one doesn't stop it. Add \`?? …\` to \`${read}\`, or check it with a ternary, which runs only the branch it takes, as in \`isMissing(${read}) ? … : …\`.`;
