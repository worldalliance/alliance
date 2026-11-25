import type React from "react";
import { hashString } from "../lib/identitySwatch";
import Badge from "../ui/Badge";
import { cn } from "../ui/cn";

const CATEGORY_COLORS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
] as const;

// Two category colours split on the diagonal: 36 marks from six tokens. Marks
// repeat within a form, so one always sits beside its name.
const swatchBackground = (seed: string): string => {
  const hash = hashString(seed);
  const first = CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
  const second = CATEGORY_COLORS[(hash >>> 8) % CATEGORY_COLORS.length];
  return `linear-gradient(135deg, ${first} 50%, ${second} 50%)`;
};

export type IdentitySwatchProps = {
  seed: string;
  className?: string;
};

/** A mark that is the same for the same seed everywhere. It goes beside the thing's name, never alone. */
export const IdentitySwatch: React.FC<IdentitySwatchProps> = ({
  seed,
  className,
}) => (
  <span
    aria-hidden="true"
    style={{ backgroundImage: swatchBackground(seed) }}
    className={cn("inline-block size-3 shrink-0 rounded-sm", className)}
  />
);

export type IdentityChipProps = {
  seed: string;
  label: string;
  className?: string;
};

export const IdentityChip: React.FC<IdentityChipProps> = ({
  seed,
  label,
  className,
}) => (
  <Badge className={cn("self-auto", className)}>
    <span className="inline-flex items-center gap-1.5 text-fg">
      <IdentitySwatch seed={seed} className="size-2.5" />
      {label}
    </span>
  </Badge>
);
