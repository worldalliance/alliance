import type React from "react";
import { cn } from "./cn";

/**
 * A native radio, so a group of them shares a `name` and the browser gives
 * the arrow keys, one tab stop and form submission; only its tint is the
 * admin's.
 */
export function Radio({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="radio"
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-accent focus-ring disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
