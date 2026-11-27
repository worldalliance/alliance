import type { ReactNode } from "react";
import { cn } from "./cn";

/** A key, or keys pressed together, as printed on the keyboard. */
export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface-2 px-1 text-caption font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
