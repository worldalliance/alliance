import type React from "react";
import { cn } from "./cn";

/**
 * A native checkbox, so it submits with a form and reads `checked` like any
 * other; only its tint is the admin's.
 */
export function Checkbox({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded-sm accent-accent focus-ring disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
