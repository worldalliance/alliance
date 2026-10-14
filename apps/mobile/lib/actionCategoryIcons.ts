import type { ActionCategory } from "@alliance/shared/client";
import {
  Cpu,
  HandCoins,
  Landmark,
  Leaf,
  Users,
  type LucideIcon,
} from "lucide-react-native";

export const ACTION_CATEGORY_ICONS: Record<ActionCategory, LucideIcon> = {
  environment: Leaf,
  poverty: HandCoins,
  democracy: Landmark,
  technology: Cpu,
  meta: Users,
};
