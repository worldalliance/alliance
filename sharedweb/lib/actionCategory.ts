import type { ActionCategory } from "@alliance/shared/client";
import {
  Cpu,
  HandCoins,
  Landmark,
  Leaf,
  Users,
  type LucideIcon,
} from "lucide-react";

export const ACTION_CATEGORY_DISPLAY: Record<
  ActionCategory,
  { label: string; Icon: LucideIcon }
> = {
  environment: { label: "Environmental destruction", Icon: Leaf },
  poverty: { label: "Extreme poverty", Icon: HandCoins },
  democracy: { label: "Democratic institutional decline", Icon: Landmark },
  technology: { label: "Dangerous technological development", Icon: Cpu },
  meta: { label: "Meta", Icon: Users },
};

// Safe: the Record literal above has exactly the ActionCategory keys.
export const ACTION_CATEGORIES = Object.keys(
  ACTION_CATEGORY_DISPLAY,
) as ActionCategory[];

export const sortActionCategories = (categories: readonly ActionCategory[]) =>
  ACTION_CATEGORIES.filter((category) => categories.includes(category));
