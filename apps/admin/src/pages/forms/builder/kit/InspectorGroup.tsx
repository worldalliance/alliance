import { useId, type ReactNode } from "react";

/**
 * One group of an inspector panel's settings, under an optional heading. The
 * panel stacks its groups with a divider between them.
 */
export function InspectorGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <div
      role={title ? "group" : undefined}
      aria-labelledby={title ? headingId : undefined}
      className="flex min-w-0 flex-col gap-4 border-line not-first:border-t not-first:pt-5"
    >
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && (
            <h3 id={headingId} className="font-semibold">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-caption text-fg-muted">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
