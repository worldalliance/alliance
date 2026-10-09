import type { HeaderBlock } from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";

const LEVEL_SIZES = {
  1: "text-3xl",
  2: "text-2xl",
  3: "text-xl",
  4: "text-lg",
  5: "text-base",
  6: "",
} as const satisfies Record<NonNullable<HeaderBlock["level"]>, string>;

export const headerLevel = (block: HeaderBlock) => block.level || 2;

export const headerClassName = (block: HeaderBlock) =>
  cn("!font-semibold text-zinc-900", LEVEL_SIZES[headerLevel(block)]);
