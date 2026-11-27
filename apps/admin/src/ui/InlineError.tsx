import { type ReactNode, type Ref } from "react";
import { cn } from "./cn";

interface InlineErrorProps {
  message?: ReactNode;
  className?: string;
  children?: ReactNode;
  /** For moving focus to the message; makes it focusable by script only. */
  ref?: Ref<HTMLDivElement>;
}

export default function InlineError({
  message,
  className,
  children,
  ref,
}: InlineErrorProps) {
  if (!message) return null;

  return (
    <div
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      role="alert"
      className={cn("flex items-center gap-2 text-body text-danger", className)}
    >
      <div>{message}</div>
      {children}
    </div>
  );
}
