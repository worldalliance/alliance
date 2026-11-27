import type { ReactNode } from "react";
import { cn } from "./cn";

/** What a list, table or panel shows in place of its content when it has none. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-card py-10 text-center",
        className,
      )}
    >
      <p className="font-medium text-fg">{title}</p>
      {description && <p className="max-w-md text-fg-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
