import type { ActionCategory } from "../client";

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  environment: "Environmental destruction",
  poverty: "Extreme poverty",
  democracy: "Democratic institutional decline",
  technology: "Dangerous technological development",
  meta: "Meta",
};

// Safe: the Record literal above has exactly the ActionCategory keys.
export const ACTION_CATEGORIES = Object.keys(
  ACTION_CATEGORY_LABELS,
) as ActionCategory[];

export const sortActionCategories = (categories: readonly ActionCategory[]) =>
  ACTION_CATEGORIES.filter((category) => categories.includes(category));
