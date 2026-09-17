import { cn } from "@alliance/shared/styles/util";
import type React from "react";
import { swatchGradient } from "../lib/identitySwatch";

export type IdentitySwatchProps = {
  seed: string;
  className?: string;
};

export const IdentitySwatch: React.FC<IdentitySwatchProps> = ({
  seed,
  className,
}) => (
  <span
    aria-hidden="true"
    style={{ backgroundImage: swatchGradient(seed) }}
    className={cn(
      "inline-block size-3 shrink-0 rounded-[3px] border border-black/10",
      className,
    )}
  />
);

export type IdentityChipProps = {
  seed: string;
  label: string;
  title?: string;
  className?: string;
};

export const IdentityChip: React.FC<IdentityChipProps> = ({
  seed,
  label,
  title,
  className,
}) => (
  <span
    title={title}
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700",
      className,
    )}
  >
    <IdentitySwatch seed={seed} className="size-2.5" />
    {label}
  </span>
);
