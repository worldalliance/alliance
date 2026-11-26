import { urlMatchesDomain } from "@alliance/common/url";
import type {
  ActionReviewerDto,
  ActionReviewerIcon,
} from "@alliance/shared/client";

/** Reviewer row being edited; `key` is a client-only React key, never sent to the server. */
export type ReviewerRow = ActionReviewerDto & { key: string };

/**
 * Infers the reviewer icon from the link. The server stores only the
 * resolved icon, never "auto".
 */
const detectReviewerIcon = (
  url: string | undefined,
): ActionReviewerIcon | undefined =>
  url && urlMatchesDomain(url, "linkedin.com") ? "linkedin" : undefined;

export const REVIEWER_ICON_LABELS: Record<ActionReviewerIcon, string> = {
  linkedin: "LinkedIn",
};

const ICON_CHOICES: Record<string, ActionReviewerIcon> = {
  linkedin: "linkedin",
};

/** The choice "Auto" names: the icon the link gives, if any. */
export const detectedIconLabel = (url: string | undefined) => {
  const detected = detectReviewerIcon(url);
  return detected ? REVIEWER_ICON_LABELS[detected] : "none";
};

/**
 * "auto" whenever the stored icon is what detection would pick anyway, so an
 * explicit choice only sticks when it differs.
 */
export const reviewerIconChoice = (reviewer: ActionReviewerDto): string => {
  if (reviewer.icon === detectReviewerIcon(reviewer.url)) return "auto";
  return reviewer.icon ?? "none";
};

export const chooseReviewerIcon = (
  reviewer: ReviewerRow,
  choice: string,
): ReviewerRow => ({
  ...reviewer,
  icon:
    choice === "auto" ? detectReviewerIcon(reviewer.url) : ICON_CHOICES[choice],
});

/** In auto mode the icon keeps tracking the link. */
export const changeReviewerUrl = (
  reviewer: ReviewerRow,
  url: string,
): ReviewerRow => ({
  ...reviewer,
  url,
  icon:
    reviewer.icon === detectReviewerIcon(reviewer.url)
      ? detectReviewerIcon(url)
      : reviewer.icon,
});
